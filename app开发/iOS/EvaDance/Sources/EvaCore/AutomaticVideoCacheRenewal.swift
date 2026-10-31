import Foundation

/// The cache inventory supplies device-protected storage and a continuous-clock server-time anchor.
/// A lease can be extended only by an authenticated server response, never by a local timer.
@MainActor public final class AutomaticVideoCacheRenewal {
    public private(set) var lease: VideoCacheLease
    public private(set) var revoked = false
    private var busy = false
    private var lastAttempt = -Double.greatestFiniteMagnitude
    private var loop: Task<Void, Never>?
    private let trustedNow: () -> Double
    private let retryNow: () -> Double
    private let isOnline: () -> Bool
    private let isCurrent: () -> Bool
    private let renew: (VideoCacheLease) async throws -> VideoCacheLease
    private let persist: (VideoCacheLease) throws -> Void
    private let discard: () -> Void
    public init(lease: VideoCacheLease, trustedNow: @escaping () -> Double, retryNow: @escaping () -> Double, isOnline: @escaping () -> Bool,
                isCurrent: @escaping () -> Bool, renew: @escaping (VideoCacheLease) async throws -> VideoCacheLease,
                persist: @escaping (VideoCacheLease) throws -> Void, discard: @escaping () -> Void) {
        self.lease = lease; self.trustedNow = trustedNow; self.retryNow = retryNow; self.isOnline = isOnline; self.isCurrent = isCurrent
        self.renew = renew; self.persist = persist; self.discard = discard
    }
    public var canPlay: Bool {
        !revoked && isCurrent() && VideoCachePolicy.permits(lease, member: lease.member_id, session: lease.session_id,
            device: lease.device_id, lesson: lease.lesson_id, nowMS: trustedNow())
    }
    /// Called at foreground/network recovery as well as periodically. No manual renewal UI is needed.
    public func refresh() async {
        guard !revoked, !busy else { return }
        guard isCurrent() else { invalidate(); return }
        let now = trustedNow()
        let stamp = retryNow(), since = retryNow() - lastAttempt
        guard isOnline(), stamp.isFinite, since >= 60_000, !now.isFinite || now < lease.issued_at || now >= lease.expires_at - 21_600_000 || since >= 300_000 else { return }
        busy = true; lastAttempt = stamp; defer { busy = false }
        do {
            let next = try await renew(lease)
            guard !revoked, isCurrent() else { invalidate(); return }
            guard next.series_id == lease.series_id, next.material_version == lease.material_version, next.vod_video_id == lease.vod_video_id,
                VideoCachePolicy.permits(next, member: lease.member_id, session: lease.session_id,
                    device: lease.device_id, lesson: lease.lesson_id, nowMS: next.issued_at) else { invalidate(); return }
            try persist(next) // Must persist the new protected clock anchor before exposing the grant.
            guard isCurrent(), !revoked else { invalidate(); return }
            lease = next
        } catch APIError.denied { invalidate() }
          catch APIError.sessionExpired { invalidate() }
          catch APIError.cacheInvalid { invalidate() }
          catch { /* Network/5xx/storage errors never extend the old lease or interrupt it while still valid. */ }
    }
    public func start() {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                do { try await Task.sleep(nanoseconds: 60_000_000_000) } catch { return }
            }
        }
    }
    public func stop() { loop?.cancel(); loop = nil }
    private func invalidate() { revoked = true; stop(); discard() }
    deinit { loop?.cancel() }
}
