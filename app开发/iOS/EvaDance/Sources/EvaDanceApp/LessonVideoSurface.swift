import SwiftUI
import AVKit
import EvaCore

@MainActor struct LessonVideoSurface<Previous: View, Next: View>: View {
    @ObservedObject var model: LessonPlayer
    @ObservedObject var controls: PlaybackControls
    let mirror: Bool
    let blockedMessage: String?
    let canPlay: Bool
    var onSettings: () -> Void
    @ObservedObject var orientation: PlaybackOrientation
    var onSave: () -> Void
    @ViewBuilder var previous: () -> Previous
    @ViewBuilder var next: () -> Next
    @GestureState private var holdTouchActive = false
    @State private var surfaceTouchStarted: Date?
    @State private var surfaceTouchMoved = false
    @State private var adjusting = false
    @StateObject private var adjustments = PlaybackAdjustments()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        CourseVideoCanvas(player: model.player)
            .scaleEffect(x: mirror ? -1 : 1, y: 1).allowsHitTesting(false).accessibilityHidden(true)
            .aspectRatio(16 / 9, contentMode: .fit).background(.black)
            .overlay {
                GeometryReader { geometry in
                Button { controls.tap() } label: { Rectangle().fill(.clear).contentShape(Rectangle()) }
                    .buttonStyle(.plain).accessibilityLabel("显示播放控制").accessibilityIdentifier("player.surface")
                    .accessibilityAction(named: "播放或暂停") { if canPlay { model.toggle() } }
                    .highPriorityGesture(DragGesture(minimumDistance: 0).updating($holdTouchActive) { _, active, _ in active = true }
                        .onChanged { value in
                            if surfaceTouchStarted == nil {
                                surfaceTouchStarted = Date(); surfaceTouchMoved = false; adjusting = false
                                adjustments.begin(left: value.startLocation.x < geometry.size.width / 2, player: model.player)
                            }
                            if !adjusting { model.beginHold() }
                            if max(abs(value.translation.width), abs(value.translation.height)) > 12 { surfaceTouchMoved = true; model.endHold(resetTracking: false) }
                            if adjusting || PlaybackGesturePolicy.isVertical(x: value.translation.width, y: value.translation.height) {
                                adjusting = true; controls.hide()
                                adjustments.change(translation: value.translation.height, height: geometry.size.height, player: model.player)
                            }
                        }.onEnded { value in
                            let held = model.holdingSpeed || Date().timeIntervalSince(surfaceTouchStarted ?? Date()) >= 0.4
                            let moved = surfaceTouchMoved
                            model.endHold(); surfaceTouchStarted = nil
                            if adjusting { adjustments.end(); if model.playing { controls.hide() } else { controls.reveal() }; adjusting = false }
                            if !held && !moved { controls.tap() }
                        })
                }
            }
            .overlay {
                if blockedMessage != nil {
                    Color.black.overlay { Text(blockedMessage ?? "").font(.subheadline).foregroundStyle(.white).padding() }
                }
            }
            .overlay(alignment: .center) {
                if controls.visible && !model.playing {
                    Button { if canPlay { model.toggle() } } label: {
                        Image(systemName: "play.fill").font(.system(size: 32)).frame(width: 64, height: 64)
                    }.foregroundStyle(.white).background(.black.opacity(0.25), in: Circle())
                        .accessibilityLabel("播放").disabled(model.loading || model.failure != nil)
                }
            }
            .overlay(alignment: .topTrailing) {
                if controls.visible {
                    HStack(spacing: 0) {
                    Button { onSettings() } label: { Image(systemName: "ellipsis").font(.title3).frame(width: 44, height: 44) }
                        .foregroundStyle(.white).padding(4).accessibilityLabel("播放设置").accessibilityIdentifier("player.settings")
                    }
                }
            }
            .overlay(alignment: .bottom) {
                if controls.visible {
                    VStack(spacing: 0) {
                        Slider(value: Binding(get: { model.position }, set: { value in
                            model.position = value; model.player.seek(to: CMTime(seconds: value, preferredTimescale: 600))
                        }), in: 0...max(model.duration, 1), onEditingChanged: { editing in
                            controls.interaction(editing); if !editing { onSave() }
                        }).frame(maxWidth: .infinity).accessibilityLabel("播放进度").disabled(model.loading || model.failure != nil)
                        HStack(spacing: 4) {
                            Button {
                                guard canPlay else { return }; let wasPlaying = model.playing
                                model.toggle(); if wasPlaying { onSave() }
                            } label: { Image(systemName: model.playing ? "pause.fill" : "play.fill").frame(width: 44, height: 44) }
                            .accessibilityLabel(model.playing ? "暂停" : "播放").disabled(model.loading || model.failure != nil)
                            previous()
                            next()
                            Spacer(minLength: 4)
                            Text(time(model.position) + " / " + time(model.duration)).font(.caption.monospacedDigit()).lineLimit(1)
                            Menu {
                                Button("横屏全屏") { model.endHold(); orientation.enter(landscape: true) }
                                Button("竖屏全屏") { model.endHold(); orientation.enter(landscape: false) }
                                if orientation.fullscreen { Button("退出全屏") { orientation.exit() } }
                            } label: {
                                Image(systemName: orientation.fullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right").frame(width: 44, height: 44)
                            }.accessibilityLabel("横竖屏与全屏")
                        }
                    }.padding(.horizontal, 10).foregroundStyle(.white).tint(.white)
                        .background(LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
                        .transition(.opacity).accessibilityIdentifier("player.controls")
                }
            }
            #if os(iOS)
            .background { PlaybackSystemVolume(view: adjustments.volumeView).frame(width: 1, height: 1).opacity(0.01).allowsHitTesting(false).accessibilityHidden(true) }
            #endif
            .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: controls.visible)
            .onDisappear { adjustments.restoreBrightness() }
            .onChange(of: scenePhase) { phase in if phase != .active { adjustments.restoreBrightness() } }
            .onChange(of: holdTouchActive) { active in if !active { model.endHold() } }
    }
    private func time(_ value: Double) -> String {
        guard value.isFinite && value >= 0 else { return "0:00" }
        return String(format: "%d:%02d", Int(value) / 60, Int(value) % 60)
    }
}
