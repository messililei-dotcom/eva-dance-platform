import AVFoundation

/// Media audio is activated only after an explicit play action.
@MainActor enum CourseAudioSession {
    private static let queue = DispatchQueue(label: "cn.com.swod.course-audio")
    private static var revision = 0

    static func activate() async throws {
        #if os(iOS)
        revision += 1
        let request = revision
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async {
                do {
                    let session = AVAudioSession.sharedInstance()
                    try session.setCategory(.playback, mode: .moviePlayback)
                    try session.setActive(true)
                    continuation.resume()
                } catch { continuation.resume(throwing: error) }
            }
        }
        guard revision == request else { throw CancellationError() }
        #endif
    }

    static func deactivate() {
        #if os(iOS)
        revision += 1
        queue.async {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        #endif
    }
}
