import XCTest
import SwiftUI
import UIKit
import EvaCore
@testable import EvaDance

final class CourseEntrySurfaceTests: XCTestCase {
    #if DEBUG
    @MainActor func testEntryLoadsPlayerWithoutDirectoryTap() async throws {
        guard ProcessInfo.processInfo.environment["EVA_COURSE_ENTRY_QA"] == "1" else { throw XCTSkip("Requires isolated loopback navigation fixture") }
        let previous = ProcessInfo.processInfo.environment["EVA_API_BASE"]
        setenv("EVA_API_BASE", "http://127.0.0.1:19876/api/app/v1", 1)
        defer { if let previous { setenv("EVA_API_BASE", previous, 1) } else { unsetenv("EVA_API_BASE") } }
        let session = Session()
        XCTAssertTrue(session.isFixture)
        defer { TokenStore.delete() } // Only the DEBUG fixture service, before restoring the environment.
        // Fixture service/keychain namespace only; no SMS and no real learner credentials.
        try await session.loginWithPassword(phone: "13800000000", password: "fixture-only-password")
        let before: [String] = try await session.api.request("/qa/requests", token: session.token)
        let previousPlayRequests = before.filter { $0 == "/video/101/play" }.count
        let host = UIHostingController(rootView: NavigationStack {
            CourseStudyEntryView(id: 1, title: "本地导航测试").environmentObject(session)
        })
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return XCTFail("Missing simulator scene") }
        let oldKey = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene); window.rootViewController = host; window.makeKeyAndVisible()
        defer { window.isHidden = true; oldKey?.makeKeyAndVisible() }
        var opened = false
        for _ in 0..<40 {
            try await Task.sleep(nanoseconds: 100_000_000)
            let requests: [String] = try await session.api.request("/qa/requests", token: session.token)
            if requests.filter({ $0 == "/video/101/play" }).count > previousPlayRequests { opened = true; break }
        }
        XCTAssertTrue(opened, "The actual entry must instantiate PlayerView and request the latest lesson without a directory tap")
        try await Task.sleep(nanoseconds: 200_000_000)
        let attachment = XCTAttachment(image: UIGraphicsImageRenderer(bounds: host.view.bounds).image { _ in host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true) })
        attachment.name = "direct-entry-local-fixture-no-media-authority"; attachment.lifetime = .keepAlways; add(attachment)
    }
    #endif
}
