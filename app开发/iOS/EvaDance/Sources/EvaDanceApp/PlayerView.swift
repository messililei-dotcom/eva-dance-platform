import SwiftUI
import AVKit
import EvaCore

@MainActor final class LessonPlayer: ObservableObject {
    let player = AVPlayer()
    @Published var position: Double = 0
    @Published var duration: Double = 0
    @Published var playing = false
    @Published var loading = true
    @Published var failure: String?
    @Published var qualities: [Quality] = []
    @Published var quality = "auto"
    @Published var speed: Float = 1
    @Published var holdingSpeed = false
    private var holdTask: Task<Void, Never>?
    private var holdTracking = false
    func beginHold() {
        guard !holdTracking else { return }
        holdTracking = true
        guard playing, player.rate > 0 else { return }
        holdTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 400_000_000) } catch { return }
            guard let self, self.playing, self.player.rate > 0, !Task.isCancelled else { return }
            self.holdingSpeed = true; self.player.rate = 2
        }
    }
    func endHold(resetTracking: Bool = true) {
        holdTask?.cancel(); holdTask = nil
        if holdingSpeed, player.rate > 0 { player.rate = speed }
        holdingSpeed = false
        if resetTracking { holdTracking = false }
    }
    @Published var loop = false
    private var active = true
    private var generation = 0
    private var saving = false
    private var revision = 0
    private var playbackAccount: Int?
    func activate() { active = true }
    func stop() { endHold(); active = false; generation += 1; player.pause(); playing = false }
    func load(id: Int, session: Session, selectedQuality: String? = nil) async {
        endHold()
        generation += 1; let requestGeneration = generation
        loading = true; failure = nil; player.pause(); playing = false
        let resume = selectedQuality == nil ? nil : player.currentTime().seconds
        do {
            guard let token = session.token else { throw APIError.sessionExpired }
            playbackAccount = session.accountID
            let playback: Playback = try await session.api.request("/video/\(id)/play", token: token)
            guard active, requestGeneration == generation else { return }
            guard playback.authorized else { throw APIError.denied }
            qualities = playback.quality_options ?? []
            quality = selectedQuality ?? qualities.first?.value ?? "auto"
            let raw = qualities.first(where: { $0.value == quality })?.url ?? playback.play_url
            guard let url = AppPolicy.secureMediaURL(raw) else { throw APIError.service("视频地址不可用，请联系课程管理员。") }
            let checkpoint = try await session.api.optionalProgress(lessonID: id, token: token)
            guard active, requestGeneration == generation else { return }
            revision = checkpoint?.revision ?? 0
            player.replaceCurrentItem(with: AVPlayerItem(url: url))
            let saved = checkpoint?.progress ?? 0
            let completed = (checkpoint?.duration ?? 0) > 0 && saved >= (checkpoint?.duration ?? 0)
            let target = resume ?? (completed ? 0 : saved)
            if target.isFinite && target > 0 { await player.seek(to: CMTime(seconds: target, preferredTimescale: 600)) }
            // Stay paused until the learner explicitly starts playback.
        } catch { failure = error.localizedDescription; session.handle(error) }
        if requestGeneration == generation { loading = false }
    }
    func toggle() {
        endHold()
        guard !loading, failure == nil else { return }
        if playing { player.pause() } else { player.playImmediately(atRate: speed) }
        playing.toggle()
    }
    func save(id: Int, session: Session) async {
        guard !saving, let token = session.token, playbackAccount == session.accountID,
              let progress = AppPolicy.safeProgress(position: player.currentTime().seconds, duration: player.currentItem?.duration.seconds ?? 0) else { return }
        saving = true; defer { saving = false }
        do {
            var payload = progress; payload["revision"] = Double(revision)
            let saved: ProgressRecord = try await session.api.request("/video/\(id)/progress", token: token, method: "POST", body: JSONSerialization.data(withJSONObject: payload))
            revision = saved.revision ?? revision
        } catch { failure = "学习记录同步失败：\(error.localizedDescription)"; endHold(); player.pause(); playing = false; session.handle(error) }
    }
    func monitor(id: Int, session: Session) async {
        var ticks = 0
        while !Task.isCancelled && active {
            do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { return }
            guard active else { return }
            let p = player.currentTime().seconds
            let d = player.currentItem?.duration.seconds ?? 0
            if p.isFinite { position = p }
            if d.isFinite { duration = d }
            if player.currentItem?.status == .failed {
                failure = "视频暂时无法播放，请重试。"; endHold(); player.pause(); playing = false
            }
            if duration > 0 && position >= duration - 0.3 && playing {
                endHold()
                if loop { await save(id: id, session: session); if failure == nil { await player.seek(to: .zero); player.playImmediately(atRate: speed) } }
                else { playing = false; await save(id: id, session: session) }
            }
            ticks += 1
            if ticks % 15 == 0 && playing { await save(id: id, session: session) }
            if ticks % 60 == 0 && playing && playbackAccount == session.accountID {
                do {
                    let result: Playback = try await session.api.request("/video/\(id)/play", token: session.token)
                    guard result.authorized else { throw APIError.denied }
                } catch { endHold(); player.pause(); playing = false; failure = error.localizedDescription; session.handle(error) }
            }
        }
    }
}
struct PlayerView: View {
    @EnvironmentObject var session: Session
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var model = LessonPlayer()
    @GestureState private var holdTouchActive = false
    @State private var mirror = false
    @State private var showNote = false
    let lessonID: Int
    let title: String
    var playlist: [Lesson] = []
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                VideoPlayer(player: model.player)
                    .scaleEffect(x: mirror ? -1 : 1, y: 1)
                    .allowsHitTesting(false)
                    .accessibilityLabel("课程视频画面")
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .background(.black)
                    .overlay {
                        Rectangle().fill(.clear).contentShape(Rectangle())
                            .simultaneousGesture(DragGesture(minimumDistance: 0)
                                .updating($holdTouchActive) { _, active, _ in active = true }
                                .onChanged { value in
                                    model.beginHold()
                                    if max(abs(value.translation.width), abs(value.translation.height)) > 12 { model.endHold(resetTracking: false) }
                                }
                                .onEnded { _ in model.endHold() })
                            .accessibilityHidden(true)
                    }
                    .overlay(alignment: .top) {
                        if model.holdingSpeed { Text("2 倍播放 · 松手恢复").font(.caption).padding(8).foregroundStyle(.white).allowsHitTesting(false) }
                    }
                if model.loading { ProgressView("正在获取播放权限") }
                if let failure = model.failure {
                    Text(failure).foregroundStyle(.red)
                    Button("重新加载") { Task { await model.load(id: lessonID, session: session) } }
                }
                Slider(value: Binding(get: { model.position }, set: { value in
                    model.position = value
                    model.player.seek(to: CMTime(seconds: value, preferredTimescale: 600))
                }), in: 0...max(model.duration, 1), onEditingChanged: { editing in
                    if !editing { Task { await model.save(id: lessonID, session: session) } }
                }).accessibilityLabel("播放进度").disabled(model.loading)
                HStack {
                    Text(time(model.position)).monospacedDigit()
                    Spacer()
                    Button {
                        model.toggle()
                        if !model.playing { Task { await model.save(id: lessonID, session: session) } }
                    } label: { Label(model.playing ? "暂停" : "播放", systemImage: model.playing ? "pause.fill" : "play.fill") }
                        .frame(minWidth: 80, minHeight: 44).disabled(model.loading || model.failure != nil)
                    Spacer()
                    Text(time(model.duration)).monospacedDigit()
                }
                Button("写笔记 / 添加收藏") { showNote = true }
                Toggle("镜面练习", isOn: $mirror)
                Toggle("循环本节", isOn: $model.loop)
                Picker("播放速度", selection: $model.speed) {
                    ForEach([Float(0.75), 1, 1.25, 1.5], id: \.self) { rate in Text("\(rate, specifier: "%.3g") 倍").tag(rate) }
                }.onChange(of: model.speed) { speed in model.endHold(); if model.playing { model.player.rate = speed } }
                if !model.qualities.isEmpty {
                    Picker("清晰度", selection: $model.quality) {
                        ForEach(model.qualities) { Text($0.label).tag($0.value) }
                    }.disabled(model.loading)
                    .onChange(of: model.quality) { value in
                        guard !model.loading else { return }
                        Task { await model.load(id: lessonID, session: session, selectedQuality: value) }
                    }
                }
                if let index = playlist.firstIndex(where: { $0.id == lessonID }) {
                    HStack {
                        if index > 0 { nextLink(playlist[index - 1], text: "上一节") }
                        Spacer()
                        if index + 1 < playlist.count { nextLink(playlist[index + 1], text: "下一节") }
                    }
                }
            }.padding()
        }.evaCompactLayout().navigationTitle(title)
        .task { model.activate(); await model.load(id: lessonID, session: session); await model.monitor(id: lessonID, session: session) }
        .onChange(of: scenePhase) { phase in
            if phase != .active { model.endHold(); model.player.pause(); model.playing = false; Task { await model.save(id: lessonID, session: session) } }
        }
        .onChange(of: holdTouchActive) { active in if !active { model.endHold() } }
        .onDisappear { model.stop(); Task { await model.save(id: lessonID, session: session) } }
        .sheet(isPresented: $showNote) { LessonNoteView(lessonID: lessonID, timestamp: model.position).environmentObject(session) }
    }
    private func nextLink(_ lesson: Lesson, text: String) -> some View {
        NavigationLink(text) { PlayerView(lessonID: lesson.id, title: lesson.name, playlist: playlist).id(lesson.id) }
    }
    private func time(_ value: Double) -> String {
        guard value.isFinite && value >= 0 else { return "0:00" }
        return String(format: "%d:%02d", Int(value) / 60, Int(value) % 60)
    }
}
