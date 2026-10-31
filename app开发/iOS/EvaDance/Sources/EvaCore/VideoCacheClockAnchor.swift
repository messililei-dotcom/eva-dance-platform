import Foundation

/// An elapsed clock is useful only within the same boot. An unknown boot fails closed.
public struct VideoCacheClockAnchor: Codable, Equatable {
    public let serverMS: Double
    public let elapsedMS: Double
    public let boot: String
    public init(serverMS: Double, elapsedMS: Double, boot: String) {
        self.serverMS = serverMS; self.elapsedMS = elapsedMS; self.boot = boot
    }
    public func now(elapsedMS current: Double, boot currentBoot: String) -> Double {
        guard !boot.isEmpty, boot == currentBoot, serverMS.isFinite, elapsedMS.isFinite,
              current.isFinite, current >= elapsedMS, elapsedMS >= 0 else { return .nan }
        return serverMS + current - elapsedMS
    }
}
