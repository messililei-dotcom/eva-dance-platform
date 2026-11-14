import XCTest
import SwiftUI
import UIKit
import AVKit
@testable import EvaDance

final class PlaybackSurfaceTests: XCTestCase {
    @MainActor
    func testFullscreenKeepsThePlaybackItemAndModelState() {
        let model = LessonPlayer()
        let item = AVPlayerItem(url: URL(string: "https://example.com/fixture.m3u8")!)
        model.player.replaceCurrentItem(with: item)
        model.position = 42; model.speed = 1.5; model.playing = true
        let orientation = PlaybackOrientation()
        orientation.enter(landscape: true)
        XCTAssertTrue(orientation.fullscreen)
        orientation.enter(landscape: false)
        XCTAssertTrue(orientation.fullscreen)
        orientation.exit()
        XCTAssertFalse(orientation.fullscreen)
        XCTAssertTrue(model.player.currentItem === item)
        XCTAssertEqual(model.position, 42)
        XCTAssertEqual(model.speed, 1.5)
        XCTAssertTrue(model.playing)
    }
    @MainActor
    func testActualSurfaceVisibleHiddenAndRevealed() async throws {
        let model = LessonPlayer()
        model.loading = false
        let controls = PlaybackControls(hideDelay: 80_000_000)
        let surface = LessonVideoSurface(model: model, controls: controls, mirror: false,
            blockedMessage: nil, canPlay: true,
            onSettings: {}, orientation: PlaybackOrientation(), onSave: {}, previous: { EmptyView() }, next: { EmptyView() })
        let host = UIHostingController(rootView: VStack(spacing: 16) {
            Text("播放控制界面测试 · 非课程内容").font(.caption)
            surface
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top).padding(.top, 70).background(Color.gray.opacity(0.08)))
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return XCTFail("No simulator scene") }
        let oldKey = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; oldKey?.makeKeyAndVisible(); controls.cancel() }
        func capture(_ name: String) {
            host.view.setNeedsLayout(); host.view.layoutIfNeeded()
            let image = UIGraphicsImageRenderer(bounds: host.view.bounds).image { _ in
                host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
            }
            let attachment = XCTAttachment(image: image)
            attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
        }
        try await Task.sleep(nanoseconds: 100_000_000)
        capture("controls-visible-test-canvas")
        model.playing = true
        controls.update(playing: true)
        try await Task.sleep(nanoseconds: 400_000_000)
        XCTAssertFalse(controls.visible)
        capture("controls-hidden-test-canvas")
        controls.tap(); controls.interaction(true)
        XCTAssertTrue(controls.visible)
        try await Task.sleep(nanoseconds: 100_000_000)
        capture("controls-revealed-test-canvas")
    }
}
