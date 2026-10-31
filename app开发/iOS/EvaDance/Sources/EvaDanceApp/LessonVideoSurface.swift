import SwiftUI
import AVKit

@MainActor struct LessonVideoSurface<Previous: View, Next: View>: View {
    @ObservedObject var model: LessonPlayer
    @ObservedObject var controls: PlaybackControls
    let mirror: Bool
    let watermark: String
    let blockedMessage: String?
    let canPlay: Bool
    var onSettings: () -> Void
    var onSave: () -> Void
    @ViewBuilder var previous: () -> Previous
    @ViewBuilder var next: () -> Next
    @GestureState private var holdTouchActive = false
    @State private var surfaceTouchStarted: Date?
    @State private var surfaceTouchMoved = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        CourseVideoCanvas(player: model.player)
            .scaleEffect(x: mirror ? -1 : 1, y: 1).allowsHitTesting(false).accessibilityHidden(true)
            .aspectRatio(16 / 9, contentMode: .fit).background(.black)
            .overlay {
                Button { controls.tap() } label: { Rectangle().fill(.clear).contentShape(Rectangle()) }
                    .buttonStyle(.plain).accessibilityLabel("显示播放控制").accessibilityIdentifier("player.surface")
                    .accessibilityAction(named: "播放或暂停") { if canPlay { model.toggle() } }
                    .highPriorityGesture(DragGesture(minimumDistance: 0).updating($holdTouchActive) { _, active, _ in active = true }
                        .onChanged { value in
                            if surfaceTouchStarted == nil { surfaceTouchStarted = Date(); surfaceTouchMoved = false }
                            model.beginHold()
                            if max(abs(value.translation.width), abs(value.translation.height)) > 12 { surfaceTouchMoved = true; model.endHold(resetTracking: false) }
                        }.onEnded { value in
                            let held = model.holdingSpeed || Date().timeIntervalSince(surfaceTouchStarted ?? Date()) >= 0.4
                            let moved = surfaceTouchMoved
                            model.endHold(); surfaceTouchStarted = nil
                            if !held && !moved { controls.tap() }
                        })
            }
            .overlay {
                if blockedMessage != nil {
                    Color.black.overlay { Text(blockedMessage ?? "").font(.subheadline).foregroundStyle(.white).padding() }
                }
            }
            .overlay(alignment: .topLeading) {
                Text(watermark).font(.caption2.monospacedDigit()).foregroundStyle(.white.opacity(0.8)).padding(6).background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 6)).padding(8).allowsHitTesting(false)
            }
            .overlay(alignment: .topTrailing) {
                HStack {
                    if model.holdingSpeed { Text("2 倍播放 · 松手恢复").font(.caption) }
                    if controls.visible { Button { onSettings() } label: { Image(systemName: "slider.horizontal.3").frame(width: 44, height: 44) }.accessibilityLabel("播放设置").accessibilityIdentifier("player.settings") }
                }.foregroundStyle(.white).background(.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 10)).padding(8)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: controls.visible)
            }
            .overlay(alignment: .bottom) {
                if controls.visible {
                VStack(spacing: 0) {
                    HStack {
                        previous()
                        Spacer(minLength: 0)
                        Button { guard canPlay else { return }; let wasPlaying = model.playing; model.toggle(); if wasPlaying { onSave() } } label: { Image(systemName: model.playing ? "pause.fill" : "play.fill").frame(width: 48, height: 44) }.accessibilityLabel(model.playing ? "暂停" : "播放").disabled(model.loading || model.failure != nil)
                        Spacer(minLength: 0)
                        next()
                    }
                    HStack(spacing: 8) {
                        Text(time(model.position)).font(.caption.monospacedDigit())
                        Slider(value: Binding(get: { model.position }, set: { value in model.position = value; model.player.seek(to: CMTime(seconds: value, preferredTimescale: 600)) }), in: 0...max(model.duration, 1), onEditingChanged: { editing in controls.interaction(editing); if !editing { onSave() } }).accessibilityLabel("播放进度").disabled(model.loading || model.failure != nil)
                        Text(time(model.duration)).font(.caption.monospacedDigit())
                    }.frame(minHeight: 36)
                }.padding(.horizontal, 12).foregroundStyle(.white).tint(.white).background(LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
                    .transition(.opacity).accessibilityIdentifier("player.controls")
                }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: controls.visible)
            .onChange(of: holdTouchActive) { active in if !active { model.endHold() } }
    }
    private func time(_ value: Double) -> String {
        guard value.isFinite && value >= 0 else { return "0:00" }
        return String(format: "%d:%02d", Int(value) / 60, Int(value) % 60)
    }
}
