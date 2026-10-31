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
            guard active, requestGeneration == generation, playbackAccount == session.accountID else { return }
            guard playback.authorized else { throw APIError.denied }
            qualities = playback.quality_options ?? []
            quality = selectedQuality ?? qualities.first(where: { $0.url == playback.play_url })?.value ?? qualities.first?.value ?? "auto"
            let raw = qualities.first(where: { $0.value == quality })?.url ?? playback.play_url
            guard let url = AppPolicy.secureMediaURL(raw) else { throw APIError.service("视频地址不可用，请联系课程管理员。") }
            let checkpoint = try await session.api.optionalProgress(lessonID: id, token: token)
            guard active, requestGeneration == generation, playbackAccount == session.accountID else { return }
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
            guard playbackAccount == session.accountID, session.token != nil else { stop(); failure = "账号已切换，请重新打开课程"; return }
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
    @State private var showSettings = false
    @State private var directoryQuery = ""
    @State private var directoryPage = 1
    @State private var tab = 0
    @State private var introduction = ""
    @ScaledMetric(relativeTo: .subheadline) private var ordinalSize = 30
    let lessonID: Int
    let title: String
    var playlist: [Lesson] = []
    var courseTitle = ""
    var seriesID: Int? = nil
    private var filteredLessons: [Lesson] {
        let query = directoryQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return playlist.filter { query.isEmpty || ($0.name + " " + ($0.subtitle ?? "")).localizedCaseInsensitiveContains(query) }
    }
    private var pages: Int { max(1, (filteredLessons.count + 49) / 50) }
    private var page: Int { min(directoryPage, pages) }
    private var visible: [Lesson] { Array(filteredLessons.dropFirst((page - 1) * 50).prefix(50)) }
    private var current: Lesson? { playlist.first { $0.id == lessonID } }
    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12) {
                    videoStage
                    VStack(alignment: .leading, spacing: 7) {
                        if CoursePresentation.isAudio(title) { Label("音频课程", systemImage: "waveform").font(.caption).foregroundStyle(.secondary) }
                        Text(title).font(.headline).fixedSize(horizontal: false, vertical: true)
                        if let subtitle = current?.subtitle, !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary) }
                        HStack {
                            Text(model.duration > 0 ? "学习进度 \(percent(model.position / model.duration * 100))" : current?.percent.map { "学习进度 \(percent($0))" } ?? "进度待同步")
                            if model.duration > 0 { Text("已看到 \(time(model.position))") }
                        }.font(.caption).foregroundStyle(.secondary)
                        if model.loading { ProgressView("正在获取播放权限") }
                        if let failure = model.failure {
                            Text(failure).font(.subheadline).foregroundStyle(EvaBrand.red)
                            Button("重新加载") { Task { await model.load(id: lessonID, session: session) } }.frame(minHeight: 44)
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(14).background(EvaBrand.surface)
                    HStack(spacing: 0) {
                        ForEach(0..<3) { index in
                            Button { tab = index } label: {
                                VStack(spacing: 0) {
                                    Text(index == 0 ? "目录(\(playlist.count)节)" : index == 1 ? "笔记" : "简介")
                                        .font(.subheadline.weight(tab == index ? .semibold : .regular)).frame(maxWidth: .infinity, minHeight: 48)
                                    Rectangle().fill(tab == index ? EvaBrand.red : .clear).frame(height: 2)
                                }.foregroundStyle(tab == index ? EvaBrand.red : .secondary)
                            }.buttonStyle(.plain).accessibilityAddTraits(tab == index ? .isSelected : [])
                        }
                    }.background(EvaBrand.surface).clipShape(RoundedRectangle(cornerRadius: 14)).padding(.horizontal, 12)
                    if tab == 0 {
                        VStack(spacing: 6) {
                            EvaSearchField(text: $directoryQuery, prompt: "搜索课节").onChange(of: directoryQuery) { _ in directoryPage = 1 }
                            HStack {
                                Button { directoryPage -= 1; proxy.scrollTo("directory", anchor: .top) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.disabled(page <= 1).accessibilityLabel("上一页课节")
                                Spacer(minLength: 0)
                                Text(filteredLessons.isEmpty ? "0 / 0" : "\((page - 1) * 50 + 1)–\(min(page * 50, filteredLessons.count)) / \(filteredLessons.count) · \(page)/\(pages)页").font(.caption.monospacedDigit())
                                Spacer(minLength: 0)
                                Button { directoryPage += 1; proxy.scrollTo("directory", anchor: .top) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.disabled(page >= pages).accessibilityLabel("下一页课节")
                            }.foregroundStyle(EvaBrand.red).background(EvaBrand.canvas, in: RoundedRectangle(cornerRadius: 10))
                            LazyVStack(spacing: 0) {
                                ForEach(visible) { lesson in
                                    if lesson.id == lessonID { directoryRow(lesson).accessibilityAddTraits(.isSelected) }
                                    else { NavigationLink { destination(lesson) } label: { directoryRow(lesson) }.buttonStyle(.plain) }
                                    Divider().padding(.leading, 52)
                                }
                            }
                            if visible.isEmpty { Text(playlist.isEmpty ? "请从课程目录打开课节以查看完整列表" : "未找到匹配课节").font(.subheadline).foregroundStyle(.secondary).padding(.vertical, 24) }
                        }.padding(12).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14)).padding(.horizontal, 12).id("directory")
                    } else if tab == 1 {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("记录本节练习心得").font(.headline)
                            Text("笔记与书签会记录当前播放位置，可在个人中心查看。").font(.subheadline).foregroundStyle(.secondary)
                            Button("写笔记 / 添加书签 · \(time(model.position))") { showNote = true }.frame(minHeight: 44).disabled(model.loading || model.failure != nil)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14)).padding(.horizontal, 12)
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(courseTitle.isEmpty ? title : courseTitle).font(.headline)
                            Text(introduction.isEmpty ? "暂无课程简介" : introduction).font(.body).foregroundStyle(.secondary).textSelection(.enabled)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14)).padding(.horizontal, 12)
                    }
                }.padding(.bottom, 16)
            }.background(EvaBrand.canvas)
        }.evaPageChrome()
        #if os(iOS)
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(EvaBrand.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        #endif
        .task {
            directoryPage = (playlist.firstIndex(where: { $0.id == lessonID }) ?? 0) / 50 + 1
            if let seriesID, let detail: JSONValue = try? await session.api.request("/public/series/\(seriesID)/detail") {
                introduction = plain(detail["rich_description"].text.isEmpty ? detail["description"].text : detail["rich_description"].text)
            }
        }
        .task { model.activate(); await model.load(id: lessonID, session: session); await model.monitor(id: lessonID, session: session) }
        .onChange(of: scenePhase) { phase in
            if phase != .active { model.endHold(); model.player.pause(); model.playing = false; Task { await model.save(id: lessonID, session: session) } }
        }
        .onChange(of: holdTouchActive) { active in if !active { model.endHold() } }
        .onDisappear { model.stop(); Task { await model.save(id: lessonID, session: session) } }
        .sheet(isPresented: $showNote) { LessonNoteView(lessonID: lessonID, timestamp: model.position).environmentObject(session) }
        .sheet(isPresented: $showSettings) {
            NavigationStack {
                Form {
                    Toggle("镜面练习", isOn: $mirror)
                    Toggle("循环本节", isOn: $model.loop)
                    Picker("播放速度", selection: $model.speed) { ForEach([Float(0.75), 1, 1.25, 1.5], id: \.self) { rate in Text("\(rate, specifier: "%.3g") 倍").tag(rate) } }
                        .onChange(of: model.speed) { speed in model.endHold(); if model.playing { model.player.rate = speed } }
                    if !model.qualities.isEmpty {
                        Picker("清晰度", selection: $model.quality) { ForEach(model.qualities) { Text($0.label).tag($0.value) } }.disabled(model.loading)
                            .onChange(of: model.quality) { value in guard !model.loading else { return }; Task { await model.load(id: lessonID, session: session, selectedQuality: value) } }
                    }
                }.navigationTitle("播放设置").navigationBarTitleDisplayMode(.inline).toolbar { Button("完成") { showSettings = false } }
            }.presentationDetents([.medium, .large])
        }
    }
    private var videoStage: some View {
        VideoPlayer(player: model.player)
            .scaleEffect(x: mirror ? -1 : 1, y: 1).allowsHitTesting(false).accessibilityHidden(true)
            .aspectRatio(16 / 9, contentMode: .fit).background(.black)
            .overlay {
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .simultaneousGesture(DragGesture(minimumDistance: 0).updating($holdTouchActive) { _, active, _ in active = true }
                        .onChanged { value in model.beginHold(); if max(abs(value.translation.width), abs(value.translation.height)) > 12 { model.endHold(resetTracking: false) } }.onEnded { _ in model.endHold() })
                    .accessibilityHidden(true)
            }
            .overlay(alignment: .topTrailing) {
                HStack { if model.holdingSpeed { Text("2 倍播放 · 松手恢复").font(.caption) }; Button { showSettings = true } label: { Image(systemName: "slider.horizontal.3").frame(width: 44, height: 44) }.accessibilityLabel("播放设置") }.foregroundStyle(.white).background(.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 10)).padding(8)
            }
            .overlay(alignment: .bottom) {
                VStack(spacing: 0) {
                    HStack {
                        if let index = playlist.firstIndex(where: { $0.id == lessonID }), index > 0 { NavigationLink { destination(playlist[index - 1]) } label: { Text("上一节").frame(minWidth: 60, minHeight: 44) } }
                        Spacer(minLength: 0)
                        Button { model.toggle(); if !model.playing { Task { await model.save(id: lessonID, session: session) } } } label: { Image(systemName: model.playing ? "pause.fill" : "play.fill").frame(width: 48, height: 44) }.accessibilityLabel(model.playing ? "暂停" : "播放").disabled(model.loading || model.failure != nil)
                        Spacer(minLength: 0)
                        if let index = playlist.firstIndex(where: { $0.id == lessonID }), index + 1 < playlist.count { NavigationLink { destination(playlist[index + 1]) } label: { Text("下一节").frame(minWidth: 60, minHeight: 44) } }
                    }
                    HStack(spacing: 8) {
                        Text(time(model.position)).font(.caption.monospacedDigit())
                        Slider(value: Binding(get: { model.position }, set: { value in model.position = value; model.player.seek(to: CMTime(seconds: value, preferredTimescale: 600)) }), in: 0...max(model.duration, 1), onEditingChanged: { editing in if !editing { Task { await model.save(id: lessonID, session: session) } } }).accessibilityLabel("播放进度").disabled(model.loading || model.failure != nil)
                        Text(time(model.duration)).font(.caption.monospacedDigit())
                    }.frame(minHeight: 36)
                }.padding(.horizontal, 12).foregroundStyle(.white).tint(.white).background(LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
            }
    }
    private func directoryRow(_ lesson: Lesson) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text("\((playlist.firstIndex(where: { $0.id == lesson.id }) ?? 0) + 1)").font(.subheadline.bold().monospacedDigit()).foregroundStyle(lesson.id == lessonID ? EvaBrand.onAccent : .white).frame(minWidth: ordinalSize, minHeight: ordinalSize).background(lesson.id == lessonID ? EvaBrand.red : Color.secondary, in: Circle())
            VStack(alignment: .leading, spacing: 7) {
                Text(lesson.name).font(.body).fixedSize(horizontal: false, vertical: true).foregroundStyle(.primary)
                Text((lesson.duration ?? 0) > 0 ? time(lesson.duration ?? 0) : "时长待更新").font(.caption).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, alignment: .leading)
            Text(lesson.id == lessonID && model.duration > 0 ? percent(model.position / model.duration * 100) : lesson.percent.map(percent) ?? "待同步").font(.caption.monospacedDigit()).foregroundStyle(lesson.id == lessonID ? EvaBrand.red : .secondary)
        }.padding(.horizontal, 8).padding(.vertical, 16).frame(minHeight: 80).background(lesson.id == lessonID ? EvaBrand.softAccent : .clear).accessibilityElement(children: .combine)
    }
    private func destination(_ lesson: Lesson) -> some View {
        let updated = playlist.map { row in row.id == lessonID && model.duration > 0 ? Lesson(id: row.id, name: row.name, duration: model.duration, subtitle: row.subtitle, percent: model.position / model.duration * 100) : row }
        return PlayerView(lessonID: lesson.id, title: lesson.name, playlist: updated, courseTitle: courseTitle, seriesID: seriesID).id(lesson.id)
    }
    private func percent(_ value: Double) -> String { "\(Int(min(100, max(0, value.isFinite ? value : 0))))%" }
    private func time(_ value: Double) -> String {
        guard value.isFinite && value >= 0 else { return "0:00" }
        return String(format: "%d:%02d", Int(value) / 60, Int(value) % 60)
    }
}
