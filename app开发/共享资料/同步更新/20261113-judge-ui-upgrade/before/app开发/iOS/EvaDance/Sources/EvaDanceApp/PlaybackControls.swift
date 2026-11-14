import SwiftUI

@MainActor final class PlaybackControls: ObservableObject {
    @Published private(set) var visible = true
    private var playing = false
    private var keepVisible = false
    private var interacting = false
    private var hideTask: Task<Void, Never>?
    private let hideDelay: UInt64

    init(hideDelay: UInt64 = 3_000_000_000) { self.hideDelay = hideDelay }

    func update(playing: Bool, keepVisible: Bool = false) {
        self.playing = playing; self.keepVisible = keepVisible
        cancel(); visible = !playing
    }
    func hide() { cancel(); visible = false }
    func reveal() { visible = true; schedule() }
    func tap() {
        if playing && visible && !keepVisible { cancel(); visible = false }
        else { reveal() }
    }
    func interaction(_ active: Bool) { interacting = active; reveal() }
    func cancel() { hideTask?.cancel(); hideTask = nil }
    private func schedule() {
        cancel()
        guard playing, !keepVisible, !interacting else { return }
        let delay = hideDelay
        hideTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: delay) } catch { return }
            guard let self, !Task.isCancelled, self.playing, !self.keepVisible, !self.interacting else { return }
            self.visible = false
        }
    }
    deinit { hideTask?.cancel() }
}
