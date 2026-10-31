import SwiftUI
import Network
import EvaCore

@MainActor final class CourseCacheStore: ObservableObject {
    @Published private(set) var records: [CourseCacheRecord] = []
    @Published var message = ""
    @Published private(set) var downloading: Int?
    unowned private let session: Session
    private var renewals: [Int: AutomaticVideoCacheRenewal] = [:]
    private let monitor = NWPathMonitor()
    private var loop: Task<Void, Never>?
    private var online = true
    private var generation = 0
    #if os(iOS) && !targetEnvironment(simulator)
    private let driver = AliyunSecureCacheDriver()
    #endif
    let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("course-cache", isDirectory: true)
    init(session: Session) {
        self.session = session
        if let data = CourseCacheVault.read("inventory"), let value = try? JSONDecoder().decode([CourseCacheRecord].self, from: data) { records = value }
        // An interrupted download is never represented as a completed file.
        for i in records.indices where records[i].state != "ready" { records[i].state = "paused"; records[i].relativeFile = "" }
        monitor.pathUpdateHandler = { [weak self] path in Task { @MainActor in self?.online = path.status == .satisfied; if path.status == .satisfied { await self?.refresh() } } }
        monitor.start(queue: DispatchQueue(label: "SWOD.cache.network"))
        loop = Task { [weak self] in
            while !Task.isCancelled { await self?.refresh(); do { try await Task.sleep(nanoseconds: 60_000_000_000) } catch { return } }
        }
    }
    var visible: [CourseCacheRecord] { records.filter { current($0.lease) } }
    private func current(_ lease: VideoCacheLease) -> Bool { session.accountID == lease.member_id && session.credentials?.sessionId == lease.session_id }
    func usable(_ record: CourseCacheRecord) -> Bool {
        guard current(record.lease), let device = try? CourseCacheVault.device(), record.state == "ready", file(record) != nil else { return false }
        return VideoCachePolicy.permits(record.lease, member: record.lease.member_id, session: record.lease.session_id, device: device, lesson: record.id,
            nowMS: record.anchor.now(elapsedMS: CourseCacheVault.elapsed(), boot: CourseCacheVault.boot()))
    }
    func file(_ record: CourseCacheRecord) -> URL? {
        let relative = record.relativeFile
        guard !relative.isEmpty, !relative.hasPrefix("/"), !relative.split(separator: "/").contains("..") else { return nil }
        let target = root.appendingPathComponent(relative).resolvingSymlinksInPath()
        guard target.path.hasPrefix(root.resolvingSymlinksInPath().path + "/"), FileManager.default.fileExists(atPath: target.path) else { return nil }
        return target
    }
    private func persist() throws { try CourseCacheVault.write(JSONEncoder().encode(records), account: "inventory") }
    func purge() {
        generation += 1
        #if os(iOS) && !targetEnvironment(simulator)
        driver.stop()
        #endif
        downloading = nil; renewals.values.forEach { $0.stop() }; renewals.removeAll(); records = []
        // Revoke protected metadata before removing ciphertext. Orphans cannot become playable.
        try? persist(); try? FileManager.default.removeItem(at: root)
    }
    func remove(_ id: Int) {
        if downloading == id {
            generation += 1
            #if os(iOS) && !targetEnvironment(simulator)
            driver.stop()
            #endif
            downloading = nil
        }
        renewals.removeValue(forKey: id)?.stop()
        records.removeAll { $0.id == id }; try? persist()
        try? FileManager.default.removeItem(at: root.appendingPathComponent(String(id)))
    }
    func pause(_ id: Int) {
        guard downloading == id else { return }; generation += 1
        #if os(iOS) && !targetEnvironment(simulator)
        driver.stop()
        #endif
        downloading = nil
        if let at = records.firstIndex(where: { $0.id == id }) { records[at].state = "paused" }
        try? persist()
    }
    func refresh() async {
        guard session.token != nil else { return }
        let stale = records.filter { !current($0.lease) }.map(\.id); stale.forEach(remove)
        // Server limit is 20 requests/min/session. Bound inventory to 12 items below.
        for record in visible where record.state == "ready" {
            if renewals[record.id] == nil {
                var stamp: Double = 0
                let owner = record.lease
                let renewal = AutomaticVideoCacheRenewal(lease: owner,
                    trustedNow: { [weak self] in self?.records.first(where: { $0.id == record.id })?.anchor.now(elapsedMS: CourseCacheVault.elapsed(), boot: CourseCacheVault.boot()) ?? .nan },
                    retryNow: CourseCacheVault.elapsed, isOnline: { [weak self] in self?.online == true },
                    isCurrent: { [weak self] in self?.current(owner) == true && self?.records.contains(where: { $0.recordID == record.recordID }) == true },
                    renew: { [weak self] old in
                        guard let self else { throw CancellationError() }; stamp = CourseCacheVault.elapsed()
                        let grant = try await self.authorize(old.lesson_id, action: "renew", version: old.material_version)
                        return grant.lease
                    }, persist: { [weak self] next in
                        guard let self, let at = self.records.firstIndex(where: { $0.recordID == record.recordID }), self.current(next) else { throw CancellationError() }
                        let old = self.records[at]; self.records[at].lease = next
                        self.records[at].anchor = VideoCacheClockAnchor(serverMS: next.issued_at, elapsedMS: stamp, boot: CourseCacheVault.boot())
                        do { try self.persist() } catch { self.records[at] = old; throw error }
                    }, discard: { [weak self] in if self?.records.contains(where: { $0.recordID == record.recordID }) == true { self?.remove(record.id) } })
                renewals[record.id] = renewal
            }
            await renewals[record.id]?.refresh()
            if online { await syncProgress(record.id) }
        }
    }
    private func authorize(_ id: Int, action: String, version: String = "") async throws -> CourseCacheAuthorization {
        guard let token = session.token else { throw APIError.sessionExpired }
        return try await session.api.request("/video/\(id)/cache-authorization", token: token, method: "POST",
            body: JSONSerialization.data(withJSONObject: ["action": action, "device_id": try CourseCacheVault.device(), "material_version": version]))
    }
    func download(_ id: Int, title: String, course: String) async {
        guard downloading == nil else { message = "请等待当前课节缓存完成，或先取消任务"; return }
        guard AliyunSecureCacheDriver.configured else { message = "安全缓存授权尚未配置完成，请先在线观看"; return }
        guard records.count < 12 || records.contains(where: { $0.id == id }) else { message = "最多缓存 12 节，请先删除不需要的缓存"; return }
        let version = generation; downloading = id; message = "正在验证缓存权限"
        let stamp = CourseCacheVault.elapsed()
        do {
            let grant = try await authorize(id, action: "download")
            guard version == generation, current(grant.lease), let playAuth = grant.credential?.play_auth else { throw CancellationError() }
            downloading = nil
            remove(id) // Invalidate old metadata and remove only this lesson's files.
            downloading = id; let active = generation
            let anchor = VideoCacheClockAnchor(serverMS: grant.lease.issued_at, elapsedMS: stamp, boot: CourseCacheVault.boot())
            var record = CourseCacheRecord(lease: grant.lease, title: title, course: course, state: "downloading", anchor: anchor)
            if let token = session.token, let progress = try? await session.api.optionalProgress(lessonID: id, token: token) { record.position = progress.progress ?? 0; record.revision = progress.revision ?? 0 }
            guard active == generation, current(grant.lease) else { throw CancellationError() }
            records.append(record); try persist()
            #if os(iOS) && !targetEnvironment(simulator)
            let used = CourseCacheVault.bytes(root)
            let available = (try? root.deletingLastPathComponent().deletingLastPathComponent().resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage) ?? 0
            let limit = min(grant.maxBytes, 2_147_483_648 - used, available - 104_857_600)
            try driver.start(vodID: grant.lease.vod_video_id, playAuth: playAuth, directory: root.appendingPathComponent(String(id)), maximumBytes: limit,
                allowed: { [weak self] in
                    guard let self, self.generation == active, self.current(grant.lease) else { return false }
                    let live = self.records.first(where: { $0.id == id })
                    return live != nil && VideoCachePolicy.permits(live!.lease, member: grant.lease.member_id, session: grant.lease.session_id,
                        device: grant.lease.device_id, lesson: id, nowMS: live!.anchor.now(elapsedMS: CourseCacheVault.elapsed(), boot: CourseCacheVault.boot()))
                }, progress: { [weak self] percent in
                    guard let self, self.generation == active, let at = self.records.firstIndex(where: { $0.id == id }) else { return }
                    self.records[at].percent = min(99, max(0, percent))
                }, finished: { [weak self] result in
                    guard let self, self.generation == active, self.current(grant.lease), let at = self.records.firstIndex(where: { $0.id == id }) else { return }
                    self.downloading = nil
                    switch result {
                    case .success(let url):
                        self.records[at].relativeFile = String(url.path.dropFirst(self.root.path.count + 1))
                        self.records[at].bytes = CourseCacheVault.bytes(self.root.appendingPathComponent(String(id)))
                        self.records[at].state = "ready"; self.records[at].percent = 100
                        do { try self.persist(); self.message = "缓存完成"; Task { await self.refresh() } }
                        catch { self.remove(id); self.message = "缓存无法安全保存，请重试" }
                    case .failure(let error): self.remove(id); self.message = error.localizedDescription
                    }
                })
            #else
            _ = playAuth; throw APIError.service("模拟器不支持安全离线解密，请使用真机")
            #endif
        } catch {
            if version == generation { downloading = nil; if records.first(where: { $0.id == id })?.state != "ready" { remove(id) }; message = error.localizedDescription }
        }
    }
    func checkpoint(_ id: Int, position: Double, duration: Double) {
        guard let at = records.firstIndex(where: { $0.id == id }), usable(records[at]), let safe = AppPolicy.safeProgress(position: position, duration: duration) else { return }
        records[at].position = safe["progress"] ?? position; records[at].duration = duration; records[at].pendingProgress = true
        do { try persist() } catch { message = "本机学习进度保存失败，请重试" }
    }
    private func syncProgress(_ id: Int) async {
        guard let record = records.first(where: { $0.id == id }), record.pendingProgress, usable(record), let token = session.token else { return }
        do {
            let result: ProgressRecord = try await session.api.request("/video/\(id)/progress", token: token, method: "POST", body: JSONSerialization.data(withJSONObject: ["progress": record.position, "duration": record.duration, "revision": Double(record.revision)]))
            guard current(record.lease), let at = records.firstIndex(where: { $0.recordID == record.recordID }), records[at].position == record.position else { return }
            records[at].revision = result.revision ?? record.revision; records[at].pendingProgress = false; try persist()
        } catch APIError.progressConflict {
            guard let newer = try? await session.api.optionalProgress(lessonID: id, token: token), current(record.lease),
                  let at = records.firstIndex(where: { $0.recordID == record.recordID }), records[at].position == record.position else { return }
            records[at].revision = newer.revision ?? record.revision; records[at].position = newer.progress ?? record.position
            records[at].duration = newer.duration ?? record.duration; records[at].pendingProgress = false; try? persist()
        } catch { /* Keep an account-scoped protected outbox. Never overwrite another device's newer revision. */ }
    }
    deinit { monitor.cancel(); loop?.cancel() }
}
