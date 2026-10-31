import XCTest
@testable import EvaDance

final class PlaybackControlsTests: XCTestCase {
    @MainActor
    func testPlayingHidesThenTapReveals() async throws {
        let controls = PlaybackControls(hideDelay: 20_000_000)
        controls.update(playing: true)
        try await Task.sleep(nanoseconds: 70_000_000)
        XCTAssertFalse(controls.visible)
        controls.tap()
        XCTAssertTrue(controls.visible)
        controls.cancel()
    }
    @MainActor
    func testPauseCancelsPendingHide() async throws {
        let controls = PlaybackControls(hideDelay: 20_000_000)
        controls.update(playing: true)
        controls.update(playing: false)
        try await Task.sleep(nanoseconds: 70_000_000)
        XCTAssertTrue(controls.visible)
        controls.tap()
        XCTAssertTrue(controls.visible)
    }
    @MainActor
    func testScrubbingPinsControlsAndRestartsTimeout() async throws {
        let controls = PlaybackControls(hideDelay: 20_000_000)
        controls.update(playing: true)
        controls.interaction(true)
        try await Task.sleep(nanoseconds: 70_000_000)
        XCTAssertTrue(controls.visible)
        controls.interaction(false)
        try await Task.sleep(nanoseconds: 70_000_000)
        XCTAssertFalse(controls.visible)
    }
    @MainActor
    func testVoiceOverControlsDoNotDisappear() async throws {
        let controls = PlaybackControls(hideDelay: 20_000_000)
        controls.update(playing: true, keepVisible: true)
        try await Task.sleep(nanoseconds: 70_000_000)
        controls.tap()
        XCTAssertTrue(controls.visible)
    }
}
