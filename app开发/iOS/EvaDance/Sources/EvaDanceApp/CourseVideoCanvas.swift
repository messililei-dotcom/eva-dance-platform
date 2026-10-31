import SwiftUI
import AVKit

#if os(iOS)
/// The app owns the controls; suppress AVKit's second, independent control layer.
struct CourseVideoCanvas: UIViewControllerRepresentable {
    let player: AVPlayer
    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.showsPlaybackControls = false
        controller.videoGravity = .resizeAspect
        return controller
    }
    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player { controller.player = player }
        controller.showsPlaybackControls = false
    }
}
#else
struct CourseVideoCanvas: View {
    let player: AVPlayer
    var body: some View { VideoPlayer(player: player) }
}
#endif
