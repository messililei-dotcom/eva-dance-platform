import SwiftUI
import AVFoundation
#if os(iOS) && !targetEnvironment(simulator) && canImport(AliyunPlayer)
import AliyunPlayer

@MainActor final class OfflineCoursePlayer: NSObject, ObservableObject, AVPDelegate {
    let player = AliPlayer()!
    @Published var position: Double = 0
    @Published var duration: Double = 0
    @Published var ready = false
    @Published var playing = false
    @Published var error = ""
    private var initial: Double = 0
    private var audioActivated = false
    private var audioTask: Task<Void, Never>?
    private var playRequest = 0
    func load(_ file: URL, position: Double) {
        initial = position; player.delegate = self
        AliPlayer.setEnableLog(false); AliPrivateService.initKey(Bundle.main.path(forResource: "encryptedApp", ofType: "dat"))
        let source = AVPUrlSource(); source.playerUrl = file
        player.setUrlSource(source); player.prepare()
    }
    func onPlayerEvent(_ player: AliPlayer!, eventType: AVPEventType) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if eventType == AVPEventPrepareDone { self.duration = Double(player.duration) / 1000; self.ready = true; player.seek(toTime: Int64(self.initial * 1000), seekMode: AVP_SEEKMODE_INACCURATE) }
            if eventType == AVPEventCompletion { self.playing = false }
        }
    }
    func onError(_ player: AliPlayer!, errorModel: AVPErrorModel!) { DispatchQueue.main.async { [weak self] in self?.pause(); self?.error = "安全离线内容无法解密播放，请联网重新下载" } }
    func onCurrentPositionUpdate(_ player: AliPlayer!, position: Int64) { DispatchQueue.main.async { [weak self] in self?.position = Double(position) / 1000 } }
    func pause() {
        player.pause(); playing = false; playRequest += 1
        if audioActivated || audioTask != nil { CourseAudioSession.deactivate() }
        audioTask?.cancel(); audioTask = nil; audioActivated = false
    }
    func toggle() {
        guard ready else { return }
        if playing || audioTask != nil { pause() }
        else {
            playRequest += 1
            let request = playRequest
            audioTask = Task { [weak self] in
                guard let self, !Task.isCancelled, self.playRequest == request else { return }
                do {
                    try await CourseAudioSession.activate()
                    guard !Task.isCancelled, self.playRequest == request else { return }
                    self.audioTask = nil; self.audioActivated = true; self.player.start(); self.playing = true
                } catch {
                    guard self.playRequest == request else { return }
                    self.audioTask = nil
                    if !(error is CancellationError) { self.error = "无法启用课程声音，请稍后重新播放。" }
                }
            }
        }
    }
    func destroy() { pause(); player.stop(); player.destroy() }
}

struct OfflineSDKSurface: UIViewRepresentable {
    let model: OfflineCoursePlayer
    func makeUIView(context: Context) -> UIView { let view = UIView(); view.backgroundColor = .black; model.player.playerView = view; return view }
    func updateUIView(_ view: UIView, context: Context) {}
}
#endif

struct OfflineCoursePlayerView: View {
    @ObservedObject var cache: CourseCacheStore
    let lessonID: Int
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject var session: Session
    @State private var captured = false
    @State private var loadedRecordID = ""
    @StateObject private var orientation = PlaybackOrientation()
    #if os(iOS) && !targetEnvironment(simulator) && canImport(AliyunPlayer)
    @StateObject private var model = OfflineCoursePlayer()
    private var record: CourseCacheRecord? { cache.visible.first { $0.id == lessonID } }
    var body: some View {
        VStack(spacing: 16) {
            OfflineSDKSurface(model: model).aspectRatio(16/9, contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: orientation.fullscreen ? .infinity : nil).background(.black)
                .overlay { if captured || scenePhase != .active || record.map({ !cache.usable($0) }) != false { Color.black } }
            HStack {
                Menu("横竖屏 / 全屏") {
                    Button("横屏全屏") { orientation.enter(landscape: true) }
                    Button("竖屏全屏") { orientation.enter(landscape: false) }
                    if orientation.fullscreen { Button("退出全屏") { orientation.exit() } }
                }.frame(minHeight: 44)
                if orientation.fullscreen { Button(model.playing ? "暂停" : "播放") { model.toggle() }.disabled(!model.ready) }
            }
            if !orientation.message.isEmpty { Text(orientation.message).font(.caption) }
            if !orientation.fullscreen {
            Text(record?.title ?? "离线观看已失效").font(.headline)
            Text(model.error).foregroundStyle(EvaBrand.red)
            if let record, record.recordID == loadedRecordID, cache.usable(record), !captured {
                Button(model.playing ? "暂停" : "播放") { model.toggle() }.frame(minHeight: 44).disabled(!model.ready)
                Slider(value: $model.position, in: 0...max(model.duration,1), onEditingChanged: { editing in if !editing { model.player.seek(toTime: Int64(model.position*1000), seekMode: AVP_SEEKMODE_INACCURATE) } }).accessibilityLabel("离线播放进度")
                Text("\(Int(model.position)) / \(Int(model.duration)) 秒").font(.caption.monospacedDigit())
            } else { Text("离线观看授权待联网自动验证").foregroundStyle(.secondary) }
            Spacer()
            }
        }.padding(orientation.fullscreen ? 0 : 12).evaPageChrome()
            .toolbar(orientation.fullscreen ? .hidden : .visible, for: .navigationBar)
            .toolbar(.hidden, for: .tabBar)
            .statusBarHidden(orientation.fullscreen)
            .task {
                captured = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.contains { $0.screen.isCaptured }
                guard let record, cache.usable(record), let file = cache.file(record) else { return }
                loadedRecordID = record.recordID
                model.load(file, position: record.position)
                var ticks = 0
                while !Task.isCancelled {
                    do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { return }
                    guard let live = self.record, live.recordID == loadedRecordID, cache.usable(live) else { model.pause(); model.error = "离线观看授权待联网自动验证"; continue }
                    if model.error == "离线观看授权待联网自动验证" { model.error = "" }
                    ticks += 1
                    if ticks % 15 == 0 { cache.checkpoint(lessonID, position: model.position, duration: model.duration) }
                    if ticks % 60 == 0 { await cache.refresh() }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
                captured = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.contains { $0.screen.isCaptured }; if captured { model.pause() }
            }
            .onChange(of: scenePhase) { phase in if phase != .active { model.pause(); checkpoint() } else { Task { await cache.refresh() } } }
            .onDisappear { orientation.exit(); checkpoint(); model.destroy() }
    }
    private func checkpoint() { if record?.recordID == loadedRecordID { cache.checkpoint(lessonID, position: model.position, duration: model.duration) } }
    #else
    var body: some View { Text("安全离线播放需要已授权的真机版本").padding().evaPageChrome() }
    #endif
}
