import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Changes window geometry without recreating the player or its playback item.
@MainActor final class PlaybackOrientation: ObservableObject {
    @Published var fullscreen = false
    @Published var message = ""
    #if os(iOS)
    private weak var scene: UIWindowScene?
    private var previous: UIInterfaceOrientationMask = .portrait
    #endif
    func enter(landscape: Bool) {
        #if os(iOS)
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }) else { return }
        if !fullscreen {
            scene = window
            previous = window.coordinateSpace.bounds.width > window.coordinateSpace.bounds.height ? .landscape : .portrait
        }
        fullscreen = true
        message = ""
        window.requestGeometryUpdate(.iOS(interfaceOrientations: landscape ? .landscape : .portrait)) { [weak self] _ in
            Task { @MainActor in self?.message = "请旋转设备切换播放方向" }
        }
        #else
        fullscreen = true
        #endif
    }
    func exit() {
        guard fullscreen else { return }
        fullscreen = false
        message = ""
        #if os(iOS)
        scene?.requestGeometryUpdate(.iOS(interfaceOrientations: previous))
        scene = nil
        #endif
    }
}
