import SwiftUI
import AVKit
import EvaCore
#if os(iOS)
import MediaPlayer
#endif

@MainActor final class PlaybackAdjustments: ObservableObject {
    @Published private(set) var message = ""
    private var initial: Double = 0
    private var brightnessGesture = false
    private var dismissTask: Task<Void, Never>?
    #if os(iOS)
    let volumeView = MPVolumeView(frame: .zero)
    private weak var screen: UIScreen?
    private var originalBrightness: CGFloat?
    #endif

    func begin(left: Bool, player: AVPlayer) {
        brightnessGesture = left
        #if os(iOS)
        let activeScreen = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?.screen
        screen = activeScreen
        if left {
            if originalBrightness == nil { originalBrightness = activeScreen?.brightness }
            initial = Double(activeScreen?.brightness ?? 0.5)
        } else {
            initial = Double(volumeView.subviews.compactMap { $0 as? UISlider }.first?.value ?? player.volume)
        }
        #else
        initial = left ? 0.5 : Double(player.volume)
        #endif
    }

    func change(translation: CGFloat, height: CGFloat, player: AVPlayer) {
        let value = PlaybackGesturePolicy.level(initial: initial, translation: Double(translation), height: Double(height), minimum: brightnessGesture ? 0.05 : 0)
        #if os(iOS)
        if brightnessGesture { screen?.brightness = CGFloat(value) }
        else if let slider = volumeView.subviews.compactMap({ $0 as? UISlider }).first {
            slider.setValue(Float(value), animated: false)
            slider.sendActions(for: .valueChanged)
        } else { player.volume = Float(value) }
        #else
        if !brightnessGesture { player.volume = Float(value) }
        #endif
        message = "\(brightnessGesture ? "亮度" : "音量") \(Int((value * 100).rounded()))%"
        dismissTask?.cancel()
    }

    func end() {
        dismissTask?.cancel()
        dismissTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 900_000_000) } catch { return }
            self?.message = ""
        }
    }

    func restoreBrightness() {
        #if os(iOS)
        if let originalBrightness { screen?.brightness = originalBrightness }
        originalBrightness = nil
        #endif
        dismissTask?.cancel(); message = ""
    }
}

#if os(iOS)
struct PlaybackSystemVolume: UIViewRepresentable {
    let view: MPVolumeView
    func makeUIView(context: Context) -> MPVolumeView { view.showsRouteButton = false; return view }
    func updateUIView(_ uiView: MPVolumeView, context: Context) {}
}
#endif
