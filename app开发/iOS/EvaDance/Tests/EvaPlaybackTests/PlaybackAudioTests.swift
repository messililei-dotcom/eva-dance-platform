import XCTest
import AVFAudio
import AVFoundation
@testable import EvaDance

final class PlaybackAudioTests: XCTestCase {
    @MainActor
    func testExplicitCoursePlayUsesMediaAudioSession() async throws {
        let audio = AVAudioSession.sharedInstance()
        // Reproduce a non-media category, which follows the silent switch.
        try audio.setCategory(.ambient)
        let model = LessonPlayer()
        model.loading = false
        model.toggle()
        defer { model.stop() }
        for _ in 0..<50 {
            if model.playing || model.failure != nil { break }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertTrue(model.playing)
        XCTAssertEqual(audio.category, .playback, "Course audio must play with the Ring/Silent switch enabled")
        XCTAssertEqual(audio.mode, .moviePlayback)
        XCTAssertFalse(model.player.isMuted)
        XCTAssertEqual(model.player.volume, 1)
    }

    @MainActor
    func testAudioTrackActuallyAdvancesWithoutMutedPlayer() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".wav")
        defer { try? FileManager.default.removeItem(at: url) }
        var pcm = Data()
        for i in 0..<44_100 {
            var sample = Int16(sin(Double(i) * 2 * .pi * 440 / 22_050) * 200).littleEndian
            withUnsafeBytes(of: &sample) { pcm.append(contentsOf: $0) }
        }
        var wave = Data("RIFF".utf8)
        func u32(_ value: UInt32) { var n = value.littleEndian; withUnsafeBytes(of: &n) { wave.append(contentsOf: $0) } }
        func u16(_ value: UInt16) { var n = value.littleEndian; withUnsafeBytes(of: &n) { wave.append(contentsOf: $0) } }
        u32(UInt32(36 + pcm.count)); wave.append(Data("WAVEfmt ".utf8)); u32(16)
        u16(1); u16(1); u32(22_050); u32(44_100); u16(2); u16(16)
        wave.append(Data("data".utf8)); u32(UInt32(pcm.count)); wave.append(pcm)
        try wave.write(to: url)
        let asset = AVURLAsset(url: url)
        let tracks = try await asset.loadTracks(withMediaType: .audio)
        XCTAssertEqual(tracks.count, 1)
        let model = LessonPlayer()
        model.player.replaceCurrentItem(with: AVPlayerItem(asset: asset))
        model.loading = false
        model.toggle()
        defer { model.stop() }
        for _ in 0..<50 {
            if model.player.currentTime().seconds > 0.1 { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertGreaterThan(model.player.currentTime().seconds, 0.1)
        XCTAssertNil(model.failure)
        XCTAssertFalse(model.player.isMuted)
        XCTAssertEqual(AVAudioSession.sharedInstance().category, .playback)
    }

    @MainActor
    func testLeavingBeforeAudioActivationDoesNotStartPlayback() async throws {
        let model = LessonPlayer()
        model.loading = false
        model.toggle()
        model.stop()
        try await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertFalse(model.playing)
        XCTAssertEqual(model.player.rate, 0)
        XCTAssertNil(model.failure)
    }
}
