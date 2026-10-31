import XCTest

/// Uses the real native screens. No account, order, SMS, or production write.
final class RootLayoutTests: XCTestCase {
    @MainActor
    func testRootPagesStartNearSafeArea() {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        let roots = [
            ("线上学院", "伊娃东方舞"),
            ("线下课", "搜索课程或期次"),
            ("赛事", "搜索赛事或地点"),
            ("商城", "搜索商品")
        ]
        for (tab, anchor) in roots {
            let button = app.tabBars.buttons[tab]
            XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing tab: \(tab)")
            button.tap()
            let first = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", anchor)).firstMatch
            XCTAssertTrue(first.waitForExistence(timeout: 10), "Missing first content: \(anchor)")
            let frame = first.frame
            print("LAYOUT_METRIC \(tab) firstY=\(frame.minY) height=\(frame.height) window=\(app.frame)")
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = "root-\(tab)"
            screenshot.lifetime = .keepAlways
            add(screenshot)
            XCTAssertLessThan(frame.minY - app.frame.minY, 170, "Large blank area above \(tab)")
            XCTAssertGreaterThan(frame.minY, 30, "Content overlaps status/camera area on \(tab)")
        }
    }

    @MainActor
    func testReturningFromDetailsKeepsContentAtTop() {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        app.tabBars.buttons["个人中心"].tap()
        XCTAssertTrue(app.buttons["login.close"].waitForExistence(timeout: 5))
        let loginShot = XCTAttachment(screenshot: app.screenshot())
        loginShot.name = "login-sheet"
        loginShot.lifetime = .keepAlways
        add(loginShot)
        let loginHeader = app.staticTexts["舞者成长系统"].firstMatch
        XCTAssertLessThan(loginHeader.frame.minY - app.buttons["login.close"].frame.minY, 300, "Large blank area in login sheet")
        app.buttons["login.close"].tap()
        app.tabBars.buttons["商城"].tap()
        let help = app.buttons["我的订单"]
        XCTAssertTrue(help.waitForExistence(timeout: 5))
        help.tap()
        let detailShot = XCTAttachment(screenshot: app.screenshot())
        detailShot.name = "information-detail"
        detailShot.lifetime = .keepAlways
        add(detailShot)
        app.navigationBars.buttons.firstMatch.tap()
        app.tabBars.buttons["线上学院"].tap()
        let first = app.staticTexts["伊娃东方舞"].firstMatch
        XCTAssertTrue(first.waitForExistence(timeout: 5))
        print("LAYOUT_RETURN firstY=\(first.frame.minY)")
        XCTAssertLessThan(first.frame.minY, 170, "Root retained navigation/header gap after returning")
        let returned = XCTAttachment(screenshot: app.screenshot())
        returned.name = "root-after-return"
        returned.lifetime = .keepAlways
        add(returned)
    }

    @MainActor
    func testGuestAccountTabOpensLoginAndCancelKeepsOriginalTab() {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        let shop = app.tabBars.buttons["商城"]
        XCTAssertTrue(shop.waitForExistence(timeout: 10))
        shop.tap()
        for _ in 0..<2 {
            app.tabBars.buttons["个人中心"].tap()
            XCTAssertTrue(app.buttons["login.close"].waitForExistence(timeout: 5), "Guest account tap must present login directly")
            XCTAssertTrue(app.textFields["login.phone"].exists)
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "guest-account-direct-login"; shot.lifetime = .keepAlways; add(shot)
            app.buttons["login.close"].tap()
            let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.buttons["login.close"])
            XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 5), .completed)
            XCTAssertTrue(shop.isSelected, "Cancel should preserve the original public tab")
            XCTAssertFalse(app.buttons["login.close"].exists, "Cancel must not reopen login")
        }
    }

    @MainActor
    func testCourseSearchClearAndGuestOwnedFilter() {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launch()
        let search = app.textFields["搜索课程、老师或分类"].firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap(); search.typeText("__no_matching_course__\n")
        let clear = app.buttons["清空搜索"].firstMatch
        XCTAssertTrue(clear.waitForExistence(timeout: 5)); clear.tap()
        XCTAssertEqual(search.value as? String, "")
        let filter = app.buttons["course.filter"].firstMatch
        XCTAssertTrue(filter.waitForExistence(timeout: 5)); filter.tap()
        let owned = app.buttons["已解锁"].firstMatch
        XCTAssertTrue(owned.waitForExistence(timeout: 5)); owned.tap()
        XCTAssertTrue(app.buttons["login.close"].waitForExistence(timeout: 5))
        app.buttons["login.close"].tap()
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.buttons["login.close"])
        XCTAssertEqual(XCTWaiter.wait(for: [gone], timeout: 5), .completed)
        XCTAssertTrue(app.tabBars.buttons["线上学院"].isSelected)
    }

    #if DEBUG
    @MainActor
    func testCourseDetailKeepsContentNearTop() {
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN"]
        app.launchEnvironment["EVA_API_BASE"] = "http://127.0.0.1:18765/api/app/v1"
        app.launch()
        let course = app.buttons.containing(.staticText, identifier: "东方舞基础训练").firstMatch
        XCTAssertTrue(course.waitForExistence(timeout: 10))
        course.tap()
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "course-detail"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        let title = app.staticTexts["东方舞基础训练"].firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        print("LAYOUT_DETAIL titleY=\(title.frame.minY)")
        XCTAssertLessThan(title.frame.minY, 350, "Large blank area before course content")
    }
    #endif
}
