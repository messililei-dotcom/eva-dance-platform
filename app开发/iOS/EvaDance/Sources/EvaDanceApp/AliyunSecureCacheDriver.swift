import Foundation
#if os(iOS) && !targetEnvironment(simulator) && canImport(AliyunPlayer) && canImport(AliyunMediaDownloader)
import AliyunPlayer
import AliyunMediaDownloader

/// Media I/O only. The caller must validate the device-protected lease before every callback/start.
final class AliyunSecureCacheDriver: NSObject, AMDDelegate {
    private var downloader: AliMediaDownloader?
    private var guardTimer: Timer?
    private var allowed: () -> Bool = { false }
    private var finished: (Result<URL, Error>) -> Void = { _ in }
    private var progress: (Int) -> Void = { _ in }
    private var maximumBytes: Int64 = 0
    private var directoryPath = ""
    static var configured: Bool {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "AlivcLicenseKey") as? String, !key.isEmpty,
              let cert = Bundle.main.object(forInfoDictionaryKey: "AlivcLicenseFile") as? String else { return false }
        return Bundle.main.url(forResource: cert, withExtension: nil) != nil && Bundle.main.url(forResource: "encryptedApp", withExtension: "dat") != nil
    }
    func start(vodID: String, playAuth: String, directory: URL, maximumBytes: Int64,
               allowed: @escaping () -> Bool, progress: @escaping (Int) -> Void,
               finished: @escaping (Result<URL, Error>) -> Void) throws {
        guard Thread.isMainThread, Self.configured, allowed(), !playAuth.isEmpty, maximumBytes > 0 else { throw failure("安全离线观看尚未开放") }
        stop(); self.allowed = allowed; self.progress = progress; self.finished = finished; self.maximumBytes = maximumBytes
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].standardizedFileURL.path + "/"
        guard directory.standardizedFileURL.path.hasPrefix(root) else { throw failure("离线目录无效") }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        directoryPath = directory.resolvingSymlinksInPath().path + "/"
        var target = directory; var values = URLResourceValues(); values.isExcludedFromBackup = true; try target.setResourceValues(values)
        AliPlayer.setEnableLog(false)
        AliPrivateService.initKey(Bundle.main.path(forResource: "encryptedApp", ofType: "dat"))
        let worker = AliMediaDownloader()!; downloader = worker; worker.delegate = self; worker.setSaveDirectory(directory.path)
        let source = AVPVidAuthSource(); source.vid = vodID; source.playAuth = playAuth
        guardTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in guard let self else { return }; if !self.allowed() { self.fail("离线观看授权待联网更新") }
            else if CourseCacheVault.bytes(URL(fileURLWithPath: self.directoryPath)) > self.maximumBytes { self.fail("下载超出容量限制，请删除不需要的离线内容") } }
        worker.prepare(withPlayAuth: source)
    }
    func onPrepared(_ downloader: AliMediaDownloader!, mediaInfo info: AVPMediaInfo!) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.downloader === downloader else { return }; guard self.allowed() else { self.fail("离线观看授权已变化"); return }
            let tracks = (info.tracks ?? []).filter { ["m3u8", "mp4"].contains($0.vodFormat.lowercased()) && $0.vodFileSize > 0 && $0.vodFileSize <= self.maximumBytes }
            guard let track = tracks.sorted(by: { $0.vodFileSize < $1.vodFileSize }).first else { self.fail("没有可安全下载的清晰度或剩余空间不足"); return }
            downloader.selectTrack(track.trackIndex); downloader.start()
        }
    }
    func onDownloadingProgress(_ downloader: AliMediaDownloader!, percentage percent: Int32) { DispatchQueue.main.async { [weak self] in guard let self, self.downloader === downloader else { return }; if self.allowed() { self.progress(Int(percent)) } else { self.fail("离线观看授权待联网更新") } } }
    func onProcessingProgress(_ downloader: AliMediaDownloader!, percentage percent: Int32) {}
    func onError(_ downloader: AliMediaDownloader!, errorModel: AVPErrorModel!) { DispatchQueue.main.async { [weak self] in guard let self, self.downloader === downloader else { return }; self.fail("安全下载失败，请联网重试") } }
    func onCompletion(_ downloader: AliMediaDownloader!) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.downloader === downloader else { return }; guard self.allowed(), let path = downloader.downloadedFilePath else { self.fail("离线观看授权已变化"); return }
            let file = URL(fileURLWithPath: path).resolvingSymlinksInPath()
            let root = self.directoryPath
            guard file.path.hasPrefix(root), let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size > 0, CourseCacheVault.bytes(URL(fileURLWithPath: root)) <= self.maximumBytes else { self.fail("离线文件无效或超出容量限制"); return }
            do { try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: file.path) } catch { self.fail("无法安全保存离线内容"); return }
            let callback = self.finished; self.stop(); callback(.success(file))
        }
    }
    func stop() { guardTimer?.invalidate(); guardTimer = nil; downloader?.stop(); downloader?.destroy(); downloader = nil; allowed = { false }; finished = { _ in }; progress = { _ in } }
    private func failure(_ text: String) -> Error { NSError(domain: "SWODSecureCache", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    private func fail(_ text: String) { let callback = finished; downloader?.deleteFile(); stop(); callback(.failure(failure(text))) }
    deinit { guardTimer?.invalidate(); downloader?.stop(); downloader?.destroy() }
}
#else
/// Apple Silicon simulator uses the system online player; no unencrypted download fallback.
enum AliyunSecureCacheDriver { static let configured = false }
#endif
