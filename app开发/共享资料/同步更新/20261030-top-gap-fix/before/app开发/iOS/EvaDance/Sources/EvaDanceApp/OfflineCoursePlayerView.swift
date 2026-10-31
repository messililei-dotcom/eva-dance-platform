import SwiftUI
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
    func onError(_ player: AliPlayer!, errorModel: AVPErrorModel!) { DispatchQueue.main.async { [weak self] in self?.pause(); self?.error = "安全缓存无法解密播放，请联网重新缓存" } }
    func onCurrentPositionUpdate(_ player: AliPlayer!, position: Int64) { DispatchQueue.main.async { [weak self] in self?.position = Double(position) / 1000 } }
    func pause() { player.pause(); playing = false }
    func toggle() { guard ready else { return }; if playing { pause() } else { player.start(); playing = true } }
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
    #if os(iOS) && !targetEnvironment(simulator) && canImport(AliyunPlayer)
    @StateObject private var model = OfflineCoursePlayer()
    private var record: CourseCacheRecord? { cache.visible.first { $0.id == lessonID } }
    var body: some View {
        VStack(spacing: 16) {
            OfflineSDKSurface(model: model).aspectRatio(16/9, contentMode: .fit)
                .overlay { if captured || scenePhase != .active || record.map({ !cache.usable($0) }) != false { Color.black } }
                .overlay(alignment: .topLeading) { Text("SWOD · 学习码 " + (session.credentials?.sessionId.suffix(8).uppercased() ?? "")).font(.caption).foregroundStyle(.white).padding(8).background(.black.opacity(0.4)) }
            Text(record?.title ?? "课程缓存已失效").font(.headline)
            Text(model.error).foregroundStyle(EvaBrand.red)
            if let record, record.recordID == loadedRecordID, cache.usable(record), !captured {
                Button(model.playing ? "暂停" : "播放") { model.toggle() }.frame(minHeight: 44).disabled(!model.ready)
                Slider(value: $model.position, in: 0...max(model.duration,1), onEditingChanged: { editing in if !editing { model.player.seek(toTime: Int64(model.position*1000), seekMode: AVP_SEEKMODE_INACCURATE) } }).accessibilityLabel("离线播放进度")
                Text("\(Int(model.position)) / \(Int(model.duration)) 秒").font(.caption.monospacedDigit())
            } else { Text("缓存授权待联网自动验证").foregroundStyle(.secondary) }
            Spacer()
        }.padding(12).evaPageChrome()
            .task {
                captured = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.contains { $0.screen.isCaptured }
                guard let record, cache.usable(record), let file = cache.file(record) else { return }
                loadedRecordID = record.recordID
                model.load(file, position: record.position)
                var ticks = 0
                while !Task.isCancelled {
                    do { try await Task.sleep(nanoseconds: 1_000_000_000) } catch { return }
                    guard let live = self.record, live.recordID == loadedRecordID, cache.usable(live) else { model.pause(); model.error = "缓存授权待联网自动验证"; continue }
                    if model.error == "缓存授权待联网自动验证" { model.error = "" }
                    ticks += 1
                    if ticks % 15 == 0 { cache.checkpoint(lessonID, position: model.position, duration: model.duration) }
                    if ticks % 60 == 0 { await cache.refresh() }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
                captured = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.contains { $0.screen.isCaptured }; if captured { model.pause() }
            }
            .onChange(of: scenePhase) { phase in if phase != .active { model.pause(); checkpoint() } else { Task { await cache.refresh() } } }
            .onDisappear { checkpoint(); model.destroy() }
    }
    private func checkpoint() { if record?.recordID == loadedRecordID { cache.checkpoint(lessonID, position: model.position, duration: model.duration) } }
    #else
    var body: some View { Text("安全离线播放需要已授权的真机版本").padding().evaPageChrome() }
    #endif
}
