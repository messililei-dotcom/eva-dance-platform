import Foundation
import EvaCore

var failures = 0
func XCTFail(_ message: String = "断言失败") { failures += 1; print("FAIL: \(message)") }
func XCTAssertTrue(_ value: Bool) { if !value { XCTFail() } }
func XCTAssertFalse(_ value: Bool) { XCTAssertTrue(!value) }
func XCTAssertNil<T>(_ value: T?) { XCTAssertTrue(value == nil) }
func XCTAssertNotNil<T>(_ value: T?) { XCTAssertTrue(value != nil) }
func XCTAssertEqual<T: Equatable>(_ lhs: T, _ rhs: T) { if lhs != rhs { XCTFail("\(lhs) != \(rhs)") } }

final class StubProtocol: URLProtocol {
    static var response: (Int, String) = (200, "{}")
    static var lastRequest: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lastRequest = request
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: Self.response.0, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.response.1.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
final class EvaCoreTests {
    func client(_ json: String, status: Int = 200) -> APIClient {
        StubProtocol.response = (status, json)
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [StubProtocol.self]
        return APIClient(session: URLSession(configuration: config))
    }
    func testAuthorizedSeriesAndHeaders() async throws {
        let api = client(#"{"success":true,"data":[{"series_id":7,"series_name":"东方舞基础"}]}"#)
        let result: [Series] = try await api.request("/member/authorized-series", token: "fixture-token")
        XCTAssertEqual(result.first?.id, 7)
        XCTAssertEqual(StubProtocol.lastRequest?.value(forHTTPHeaderField: "x-client-platform"), "ios")
        XCTAssertEqual(StubProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer fixture-token")
    }
    func testCourseIDsRemainSeparateFromLessonIDs() async throws {
        let api = client(#"{"success":true,"data":[{"id":12,"name":"新课名","videos":[{"id":99,"name":"素材名","duration":30}]}]}"#)
        let result: [CourseUnit] = try await api.request("/public/series/7/courses")
        XCTAssertEqual(result.first?.id, 12); XCTAssertEqual(result.first?.videos.first?.id, 99)
    }
    func testNullableProgressIsValid() async throws {
        let result = try await client(#"{"success":true,"data":null}"#).optionalProgress(lessonID: 99, token: "fixture")
        XCTAssertNil(result)
    }
    func testMalformedProgressIsNotSwallowed() async {
        do {
            _ = try await client(#"{"success":true,"data":{"progress":"bad"}}"#).optionalProgress(lessonID: 99, token: "fixture")
            XCTFail("Malformed data must not be interpreted as no checkpoint")
        } catch { XCTAssertTrue(error is DecodingError) }
    }
    func testExpiredSessionAndDeniedEntitlement() async {
        for status in [401, 403] {
            do { let _: Empty = try await client("{}", status: status).request("/video/99/play"); XCTFail() }
            catch APIError.sessionExpired { XCTAssertEqual(status, 401) }
            catch APIError.denied { XCTAssertEqual(status, 403) }
            catch { XCTFail("Wrong error: \(error)") }
        }
    }
    func testTopLevelSuccessAndBusinessFailure() async throws {
        let _: Empty = try await client(#"{"success":true,"completed":true}"#).request("/video/99/progress", method: "POST")
        do { let _: Empty = try await client(#"{"success":false,"message":"测试拒绝"}"#).request("/send-code"); XCTFail() }
        catch APIError.service(let message) { XCTAssertEqual(message, "测试拒绝") }
    }
    func testInboxRecipientIdentityAndPagination() async throws {
        let page: InboxPage = try await client(#"{"success":true,"data":{"items":[{"id":"8","recipientId":"51","title":"课程更新","content":"新课节","status":"unread","createdAt":"2026-10-02"}],"unreadCount":1,"nextCursor":51,"hasMore":true}}"#).request("/member/messages")
        XCTAssertEqual(page.items[0].recipientId, "51"); XCTAssertTrue(page.hasMore); XCTAssertEqual(page.nextCursor, 51)
        let _: Empty = try await client(#"{"success":true,"data":{"changed":1}}"#).request("/member/messages/51/read", method: "PATCH")
        XCTAssertEqual(StubProtocol.lastRequest?.httpMethod, "PATCH")
    }
    func testSafeMediaAndCertificateLinks() {
        XCTAssertNotNil(AppPolicy.paymentURL("https://openapi.alipay.com/gateway.do?app_id=test"))
        XCTAssertNotNil(AppPolicy.paymentURL("https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb"))
        XCTAssertNil(AppPolicy.paymentURL("https://openapi.alipay.com.evil.example/pay"))
        XCTAssertNil(AppPolicy.paymentURL("http://openapi.alipay.com/pay"))
        XCTAssertNil(AppPolicy.paymentURL("https://user@openapi.alipay.com/pay"))
        XCTAssertNil(AppPolicy.paymentURL("https://openapi.alipay.com:8443/pay"))
        XCTAssertNil(AppPolicy.secureMediaURL(""))
        XCTAssertNil(AppPolicy.secureMediaURL("http://vod.swod.com.cn/a.mp4"))
        XCTAssertNil(AppPolicy.secureMediaURL("file:///tmp/video"))
        XCTAssertNil(AppPolicy.secureMediaURL("https://user:pass@vod.swod.com.cn/a"))
        XCTAssertNotNil(AppPolicy.secureMediaURL("https://vod.swod.com.cn/a.mp4?signature=fixture"))
        XCTAssertNil(AppPolicy.certificateURL("https://evil.example/certificates/1"))
        XCTAssertNotNil(AppPolicy.certificateURL("https://www.swod.com.cn/certification?no=EVA-1"))
        XCTAssertNotNil(AppPolicy.certificatePreviewURL("/api/certificates/12/render.svg?no=EVA-1"))
        XCTAssertNil(AppPolicy.certificatePreviewURL("https://evil.example/api/certificates/12/render.svg?no=EVA-1"))
        XCTAssertNil(AppPolicy.certificatePreviewURL("/api/certificates/12/render.svg"))
        XCTAssertNil(AppPolicy.certificatePreviewURL("/api/certificates/12/render.svg/evil?no=EVA-1"))
    }
    func testProgressRejectsNonFiniteAndClamps() {
        XCTAssertNil(AppPolicy.safeProgress(position: .nan, duration: 30))
        XCTAssertNil(AppPolicy.safeProgress(position: 2, duration: .infinity))
        XCTAssertNil(AppPolicy.safeProgress(position: -1, duration: 30))
        XCTAssertEqual(AppPolicy.safeProgress(position: 50, duration: 30)?["progress"], 30)
    }
    func testNoUnapprovedPurchasesOrDownloads() {
        XCTAssertFalse(AppPolicy.supportsDigitalPurchase); XCTAssertFalse(AppPolicy.supportsOfflineDownload)
    }
    func testFlexibleFieldsAndMissingValues() throws {
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(#"{"id":12,"name":"测试","optional":null,"stock":"5","items":[{"id":"p1"}]}"#.utf8))
        XCTAssertEqual(value["id"].text,"12"); XCTAssertEqual(value["stock"].number,5)
        XCTAssertEqual(value["missing"].text,""); XCTAssertEqual(value["optional"],.null)
        XCTAssertEqual(value["items"].rows.first?.id,"p1")
        let groups = value["items"].scopedRows("groups")
        let sessions = value["items"].scopedRows("sessions")
        XCTAssertTrue(groups[0].listID != sessions[0].listID)
        XCTAssertEqual(groups[0].id, sessions[0].id)
    }
    func testCartRejectsInvalidStockOverflowAndDuplicateIDs() {
        XCTAssertEqual(CartPolicy.total([CartLine(id:"p1",priceFen:1999,quantity:2,stock:2)]),3998)
        XCTAssertNil(CartPolicy.total([CartLine(id:"p1",priceFen:1999,quantity:3,stock:2)]))
        XCTAssertNil(CartPolicy.total([CartLine(id:"p1",priceFen:Int.max,quantity:2,stock:2)]))
        XCTAssertNil(CartPolicy.total([CartLine(id:"p1",priceFen:1,quantity:0,stock:2)]))
        let line=CartLine(id:"p1",priceFen:1,quantity:1,stock:2)
        XCTAssertNil(CartPolicy.total([line,line]))
    }
    func testSharedPlatformPublicRoutesNeverForwardPrivateRequests() {
        for path in ["/public/series", "/public/series/1/courses", "/public/offline-courses", "/events/2", "/events/2/groups/3", "/events/2/groups/3/players/4"] {
            XCTAssertTrue(AppPolicy.isSharedPublicRead(path,method:"GET",hasToken:false))
            XCTAssertFalse(AppPolicy.isSharedPublicRead(path,method:"POST",hasToken:false))
            XCTAssertFalse(AppPolicy.isSharedPublicRead(path,method:"GET",hasToken:true))
        }
        for path in ["/auth/login", "/member/profile", "/public/series/1/progress", "/events/2/register", "/events/2/judge", "/events/2/groups/0", "/events/2/groups/3/players/4/edit", "/video/1/play", "/public/../member/profile"] {
            XCTAssertFalse(AppPolicy.isSharedPublicRead(path,method:"GET",hasToken:false))
        }
        XCTAssertEqual(AppPolicy.apiBase.host,AppPolicy.publicAPIBase.host)
    }
    func testPracticePlanBoundariesAndSearch() throws {
        for requested in [-1, 10, 20, 30, 45, 60, Int.max] {
            let stages = PracticePlan.minutes(requested)
            XCTAssertEqual(stages.reduce(0,+), min(60,max(10,requested)))
            XCTAssertTrue(stages.allSatisfy { $0 > 0 })
        }
        let course = try JSONDecoder().decode(JSONValue.self, from: Data(#"{"name":"东方舞基础","teacher":"Eva"}"#.utf8))
        XCTAssertTrue(PracticePlan.matches(course,query:"基础 eva",fields:["name","teacher"]))
        XCTAssertFalse(PracticePlan.matches(course,query:"基础 未存在老师",fields:["name","teacher"]))
        XCTAssertTrue(PracticePlan.matches(course,query:"  ",fields:["name"]))
    }
    func testNativeLoginDTOAndBusinessErrors() async throws {
        let result: Login = try await client(#"{"success":true,"data":{"token":"fixture-access","refreshToken":"fixture-refresh","expiresAt":1234,"memberId":7,"sessionId":"fixture-session"}}"#).request("/auth/login",method:"POST")
        XCTAssertEqual(result.memberId,7); XCTAssertEqual(result.refreshToken,"fixture-refresh")
        do { let _:Empty = try await client(#"{"success":false,"message":"重复报名"}"#,status:409).request("/events/1/register",method:"POST");XCTFail() }
        catch APIError.service(let message) {XCTAssertEqual(message,"重复报名")}
        let resultWithoutData:JSONValue = try await client(#"{"success":true}"#).request("/notes/1",method:"DELETE")
        XCTAssertEqual(resultWithoutData,.null)
    }

    func testMultipartMusicRejectsIdentityAndSanitizesHeaders() throws {
        let upload = try MultipartMusic(fields: ["name": "参赛学员", "performanceTitle": "曲目"], filename: "test\r\n\".mp3", music: Data("ID3-fixture-music".utf8))
        let body = String(decoding: upload.body, as: UTF8.self)
        XCTAssertTrue(upload.contentType.hasPrefix("multipart/form-data; boundary=EvaMusic-"))
        XCTAssertTrue(body.contains("filename=\"test.mp3\""))
        XCTAssertTrue(body.contains("name=\"performanceTitle\""))
        do { _ = try MultipartMusic(fields: ["member_id": "999"], filename: "test.mp3", music: Data([1])); XCTFail() } catch { }
        do { _ = try MultipartMusic(fields: [:], filename: "test.exe", music: Data([1])); XCTFail() } catch { }
        do { _ = try MultipartMusic(fields: [:], filename: "test.mp3", music: Data()); XCTFail() } catch { }
    }

}


private func checkLoginInputsAndCarrierEvents() {
    XCTAssertEqual(LoginInputPolicy.phone(" +86 138-0000-0000 "), "13800000000")
    XCTAssertTrue(LoginInputPolicy.validPhone("+86 138 0000 0000"))
    for bad in ["1380000000", "23800000000", "13800000000x", "１３８００００００００", "13800000000/1"] {
        XCTAssertFalse(LoginInputPolicy.validPhone(bad))
    }
    for bad in ["1", "12345", "1234567", "12a456", "１２３４５６"] { XCTAssertFalse(LoginInputPolicy.validCode(bad)) }
    XCTAssertTrue(LoginInputPolicy.validCode(" 123456\n"))
    for method in LoginMethod.allCases {
        XCTAssertFalse(LoginInputPolicy.canSubmit(method, phone: "13800000000", code: "123456", password: "secret", agreed: false, busy: false, carrierReady: true))
        XCTAssertFalse(LoginInputPolicy.canSubmit(method, phone: "13800000000", code: "123456", password: "secret", agreed: true, busy: true, carrierReady: true))
    }
    XCTAssertFalse(LoginInputPolicy.canSubmit(.carrier, phone: "", code: "", password: "", agreed: true, busy: false, carrierReady: false))
    XCTAssertTrue(LoginInputPolicy.canSubmit(.carrier, phone: "", code: "", password: "", agreed: true, busy: false, carrierReady: true))
    XCTAssertFalse(LoginInputPolicy.canSubmit(.sms, phone: "13800000000", code: "1", password: "", agreed: true, busy: false, carrierReady: true))
    XCTAssertTrue(LoginInputPolicy.canSubmit(.sms, phone: "13800000000", code: "123456", password: "", agreed: true, busy: false, carrierReady: false))
    XCTAssertFalse(LoginInputPolicy.canSubmit(.password, phone: "13800000000", code: "", password: "", agreed: true, busy: false, carrierReady: false))
    let now = Date(timeIntervalSince1970: 1000)
    XCTAssertEqual(LoginInputPolicy.resendSeconds(sentAt: now, now: now), 60)
    XCTAssertEqual(LoginInputPolicy.resendSeconds(sentAt: now, now: now.addingTimeInterval(59.1)), 1)
    XCTAssertEqual(LoginInputPolicy.resendSeconds(sentAt: now, now: now.addingTimeInterval(60)), 0)
    XCTAssertEqual(LoginInputPolicy.resendSeconds(sentAt: now.addingTimeInterval(30), now: now), 60)
    for code in ["600001", "700002", "700003", "700004", "700006", "700007", "700008", "700009"] {
        XCTAssertEqual(CarrierTokenEvent.parse(code: code, token: "ignored-operator-token"), .progress)
    }
    for code in ["700000", "700001", "700010", "700020"] { XCTAssertEqual(CarrierTokenEvent.parse(code: code, token: nil), .cancelled) }
    for code in ["600002", "600007", "600008", "600015", "unknown"] { XCTAssertEqual(CarrierTokenEvent.parse(code: code, token: nil), .failed) }
    XCTAssertEqual(CarrierTokenEvent.parse(code: "600000", token: nil), .failed)
    XCTAssertEqual(CarrierTokenEvent.parse(code: "600000", token: "short"), .failed)
    XCTAssertEqual(CarrierTokenEvent.parse(code: "600000", token: "operator-token\ninvalid"), .failed)
    XCTAssertEqual(CarrierTokenEvent.parse(code: "600000", token: "operator-test-token"), .token("operator-test-token"))
    print("Login input, consent, cooldown and operator event checks passed")
}

private func checkEventPresentation() {
    let hidden: JSONValue = .object(["playerCount": .null, "groupCount": .number(0)])
    XCTAssertNil(EventPresentation.count(hidden, "playerCount"))
    XCTAssertEqual(EventPresentation.count(hidden, "groupCount"), 0)
    XCTAssertEqual(EventPresentation.aggregate([hidden], participant: true), "未公开")
    XCTAssertEqual(EventPresentation.aggregate([hidden], participant: false), "—")
    XCTAssertEqual(EventPresentation.aggregate([.object(["playerCount": .number(4), "approvedPlayerCount": .number(0)])], participant: true), "0")
    let now = ISO8601DateFormatter().date(from: "2026-11-29T12:00:00Z")!
    let open: JSONValue = .object(["registrationStatus": .string("open"), "endDate": .string("2026-11-29")])
    XCTAssertEqual(EventPresentation.state(open, now: now), "报名中")
    XCTAssertEqual(EventPresentation.state(open, now: now.addingTimeInterval(14_401)), "已结束")
    XCTAssertEqual(EventPresentation.state(.object(["status": .string("cancelled"), "registrationStatus": .string("open")]), now: now), "已取消")
    XCTAssertEqual(EventPresentation.state(.object(["registrationStatus": .string("open"), "registrationStart": .string("2026-12-01")]), now: now), "报名未开始")
    XCTAssertEqual(EventPresentation.state(.object(["registrationStatus": .string("open"), "registrationEnd": .string("2026-11-28")]), now: now), "报名已截止")
    XCTAssertEqual(EventPresentation.dateRange(.object(["startDate": .string("2026-11-29"), "endDate": .string("2026-11-29")])), "2026-11-29")
    XCTAssertEqual(EventPresentation.state(.object(["registrationStatus": .string("open"), "registrationStart": .string("2026-11-29 21:00:00")]), now: now), "报名未开始")
    XCTAssertEqual(EventPresentation.state(.object(["registrationStatus": .string("open"), "registrationEnd": .string("2026-11-29 19:59:59")]), now: now), "报名已截止")
    print("Event count privacy, zero totals, date range and registration boundary checks passed")
}

@main struct Checks {
    static func main() async throws {
        checkEventPresentation()
        checkLoginInputsAndCarrierEvents()
        let suite = EvaCoreTests()
        try await suite.testAuthorizedSeriesAndHeaders()
        try await suite.testCourseIDsRemainSeparateFromLessonIDs()
        try await suite.testNullableProgressIsValid()
        await suite.testMalformedProgressIsNotSwallowed()
        await suite.testExpiredSessionAndDeniedEntitlement()
        try await suite.testTopLevelSuccessAndBusinessFailure()
        try await suite.testInboxRecipientIdentityAndPagination()
        suite.testSafeMediaAndCertificateLinks()
        suite.testProgressRejectsNonFiniteAndClamps()
        suite.testNoUnapprovedPurchasesOrDownloads()
        try suite.testFlexibleFieldsAndMissingValues()
        suite.testCartRejectsInvalidStockOverflowAndDuplicateIDs()
        try await suite.testNativeLoginDTOAndBusinessErrors()
        try suite.testPracticePlanBoundariesAndSearch()
        suite.testSharedPlatformPublicRoutesNeverForwardPrivateRequests()
        try suite.testMultipartMusicRejectsIdentityAndSanitizesHeaders()
        XCTAssertEqual(CompetitionRecord.result(.object(["resultPublished":.bool(false),"totalScore":.number(99),"awardName":.string("冠军")])), "成绩待公示")
        XCTAssertEqual(CompetitionRecord.result(.object(["resultPublished":.string("true"),"totalScore":.number(99)])), "成绩待公示")
        XCTAssertEqual(CompetitionRecord.result(.object(["resultPublished":.bool(true),"totalScore":.number(0),"rankNo":.number(2)])), "第2名 · 0分")
        XCTAssertEqual(CompetitionRecord.result(.object(["resultPublished":.bool(true),"totalScore":.null])), "成绩已公示")
        XCTAssertEqual(CompetitionRecord.audit("pending"), "待审核")
        XCTAssertEqual(CompetitionRecord.paid("pending"), "待确认")
        let priced: JSONValue = .object(["price":.number(2980),"promo_price":.number(499),"is_free":.number(0)])
        XCTAssertEqual(CoursePresentation.price(priced),"¥499.00")
        XCTAssertEqual(CoursePresentation.originalPrice(priced),"原价 ¥2980.00")
        XCTAssertEqual(CoursePresentation.price(.object(["is_free":.number(1),"price":.number(99)])),"免费")
        XCTAssertEqual(CoursePresentation.price(.object(["is_free":.number(1),"price":.number(0),"period_status":.string("active")])),"咨询价格")
        let offline: JSONValue = .object(["source_id":.number(266),"group_key":.string("埃及titoseif大师系统班"),"period_status":.string("planned"),"price":.number(5980),"end_date":.string("2099-12-30")])
        XCTAssertTrue(CoursePresentation.canPurchase(offline))
        XCTAssertTrue(CoursePresentation.description(offline).contains("Mejance"))
        XCTAssertTrue(CoursePresentation.description(offline).contains("以所选期次安排为准"))
        XCTAssertFalse(CoursePresentation.canPurchase(.object(["source_id":.number(1),"period_status":.string("completed"),"price":.number(99)])))
        let catalog: JSONValue = .array([.object(["name":.string("修改后的课节"),"videos":.array([.object(["id":.number(11),"duration":.number(100)])])])])
        let checkpoints: JSONValue = .array([.object(["video_id":.number(11),"progress":.number(100),"duration":.number(100)])])
        let lessons = CoursePresentation.catalog(catalog,progress:checkpoints)
        XCTAssertEqual(lessons[0]["name"].text,"修改后的课节")
        XCTAssertEqual(lessons[0]["percent"].number,100)
        print("Course pricing, period availability, official introductions and catalog progress checks passed")
        XCTAssertEqual(ProductPresentation.price(.object(["priceFen":.number(16900)])), "¥169.00")
        XCTAssertEqual(ProductPresentation.price(.object(["priceFen":.number(0)])), "¥0.00")
        for invalid: JSONValue in [.null,.number(-1),.number(1.5),.number(.nan),.string("16900")] {
            XCTAssertEqual(ProductPresentation.price(.object(["priceFen":invalid])), "价格待确认")
            XCTAssertEqual(ProductPresentation.stock(.object(["stock":invalid])), "库存待确认")
        }
        XCTAssertEqual(ProductPresentation.stock(.object(["stock":.number(0)])), "暂时售罄")
        XCTAssertEqual(ProductPresentation.stock(.object(["stock":.number(39)])), "库存 39")
        let audioCatalog: JSONValue = .array([.object(["name":.string("第1课"),"videos":.array([.object(["id":.number(2543),"name":.string("音频-东方舞的历史发展.m4a")])])])])
        let audio = CoursePresentation.catalog(audioCatalog, progress:.null)[0]
        XCTAssertEqual(audio["name"].text, "音频-东方舞的历史发展.m4a")
        XCTAssertEqual(audio["mediaKind"].text, "audio")
        XCTAssertEqual(audio["subtitle"].text, "第1课")
        let cacheJSON = #"{"member_id":1,"session_id":"session","device_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","lesson_id":10,"series_id":30,"vod_video_id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","material_version":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","issued_at":1000,"expires_at":86401000,"mode":"aliyun-secure"}"#
        var cacheLease = try JSONDecoder().decode(VideoCacheLease.self, from: Data(cacheJSON.utf8))
        XCTAssertTrue(VideoCachePolicy.permits(cacheLease, member: 1, session: "session", device: cacheLease.device_id, lesson: 10, nowMS: 1001))
        XCTAssertFalse(VideoCachePolicy.permits(cacheLease, member: 2, session: "session", device: cacheLease.device_id, lesson: 10, nowMS: 1001))
        XCTAssertFalse(VideoCachePolicy.permits(cacheLease, member: 1, session: "other", device: cacheLease.device_id, lesson: 10, nowMS: 1001))
        XCTAssertFalse(VideoCachePolicy.permits(cacheLease, member: 1, session: "session", device: cacheLease.device_id, lesson: 11, nowMS: 1001))
        for now in [999.0, 86401000.0, .nan, .infinity] { XCTAssertFalse(VideoCachePolicy.permits(cacheLease, member: 1, session: "session", device: cacheLease.device_id, lesson: 10, nowMS: now)) }
        cacheLease.expires_at += 1
        XCTAssertFalse(VideoCachePolicy.permits(cacheLease, member: 1, session: "session", device: cacheLease.device_id, lesson: 10, nowMS: 1001))
        XCTAssertTrue(VideoCachePolicy.shouldRenew(cacheLease, nowMS: 301000, lastAttemptMS: 1000, online: true))
        XCTAssertFalse(VideoCachePolicy.shouldRenew(cacheLease, nowMS: 301000, lastAttemptMS: 1000, online: false))
        try await checkAutomaticRenewal(JSONDecoder().decode(VideoCacheLease.self, from: Data(cacheJSON.utf8)))
        print("Offline lease identity, 24h expiry and automatic renewal recovery checks passed")
        let clockAnchor = VideoCacheClockAnchor(serverMS: 1000, elapsedMS: 2000, boot: "boot-1")
        XCTAssertEqual(clockAnchor.now(elapsedMS: 86_402_000, boot: "boot-1"), 86_401_000)
        XCTAssertTrue(clockAnchor.now(elapsedMS: 3000, boot: "boot-2").isNaN)
        XCTAssertTrue(clockAnchor.now(elapsedMS: 1000, boot: "boot-1").isNaN)
        XCTAssertTrue(VideoCacheClockAnchor(serverMS: 1000, elapsedMS: 2000, boot: "").now(elapsedMS: 3000, boot: "").isNaN)
        print("Offline elapsed-clock reboot and rollback checks passed")
        let learningRecords: JSONValue = .array([
            .object(["progress": .number(50), "duration": .number(100)]),
            .object(["completed": .number(1)]),
            .object(["progress": .number(0), "duration": .number(100)])
        ])
        XCTAssertEqual(CoursePresentation.learningPercent(learningRecords), 50)
        XCTAssertEqual(CoursePresentation.learningPercent(.array([])), 0)
        XCTAssertEqual(CoursePresentation.learningPercent(.array([.object(["progress": .number(-5), "duration": .number(100)])])), 0)
        XCTAssertEqual(CoursePresentation.learningPercent(.array([.object(["progress": .number(200), "duration": .number(100)])])), 100)
        print("Course-level progress aggregation checks passed")
        XCTAssertFalse(PlaybackGesturePolicy.isVertical(x: 60, y: 20))
        XCTAssertFalse(PlaybackGesturePolicy.isVertical(x: 0, y: 8))
        XCTAssertTrue(PlaybackGesturePolicy.isVertical(x: 4, y: -40))
        XCTAssertEqual(PlaybackGesturePolicy.level(initial: 0.5, translation: -400, height: 200), 1)
        XCTAssertEqual(PlaybackGesturePolicy.level(initial: 0.5, translation: 400, height: 200, minimum: 0.05), 0.05)
        XCTAssertEqual(PlaybackGesturePolicy.level(initial: 0.5, translation: 400, height: 200), 0)
        print("Playback gesture direction and clamp checks passed")
        let timedNotes: [JSONValue] = [.object(["id": .number(1), "timestamp_seconds": .number(10), "content": .string("测试笔记")])]
        XCTAssertTrue(NoteDanmakuPolicy.visible(timedNotes, at: 9.99).isEmpty)
        XCTAssertEqual(NoteDanmakuPolicy.visible(timedNotes, at: 10).count, 1)
        XCTAssertEqual(NoteDanmakuPolicy.visible(timedNotes, at: 17.99).count, 1)
        XCTAssertTrue(NoteDanmakuPolicy.visible(timedNotes, at: 18).isEmpty)
        XCTAssertTrue(NoteDanmakuPolicy.visible(timedNotes, at: .nan).isEmpty)
        XCTAssertEqual(NoteDanmakuPolicy.visible(timedNotes, at: 12), NoteDanmakuPolicy.visible(timedNotes, at: 12))
        XCTAssertEqual(NoteDanmakuPolicy.visible(Array(repeating: timedNotes[0], count: 8), at: 11).count, 3)
        XCTAssertTrue(NoteDanmakuPolicy.visible([.object(["timestamp_seconds": .number(-1), "content": .string("拒绝无效时间")])], at: 0).isEmpty)
        print("Note overlay time boundary, seeking, pause and density checks passed")
        let offlineSample = try JSONDecoder().decode(JSONValue.self, from: Data(#"[{"id":1,"group_key":"  SAMPLE   Course ","name":"课程","start_date":"2027-01-01","price":100.5,"group_total_students":7,"cover_image":"cover"},{"id":2,"group_key":"sample course","name":"课程","subtitle":"2028年","price":200,"group_total_students":7}]"#.utf8))
        let summary = OfflineCatalog.grouped(offlineSample.list)
        XCTAssertEqual(summary.count, 1)
        XCTAssertEqual(summary[0]["id"].number, 2)
        XCTAssertEqual(summary[0]["offline_period_count"].number, 2)
        XCTAssertEqual(summary[0]["offline_student_count"].number, 7)
        XCTAssertEqual(summary[0]["offline_latest_period"].text, "2028年")
        XCTAssertEqual(summary[0]["cover_image"].text, "cover")
        XCTAssertEqual(OfflineCatalog.price(summary[0]), "¥100.5起")
        XCTAssertEqual(offlineSample.list[0]["offline_period_count"], .null)
        let offlineFixturePath = ProcessInfo.processInfo.environment["SWOD_OFFLINE_FIXTURE"]
        if let offlineFixturePath {
            let fixture = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: URL(fileURLWithPath: offlineFixturePath)))
            let groups = OfflineCatalog.grouped(fixture["rows"].list)
            XCTAssertEqual(groups.count, fixture["expected"].list.count)
            for (group, expected) in zip(groups, fixture["expected"].list) {
                for key in ["id", "offline_period_count", "offline_latest_period", "offline_student_count", "offline_min_price", "cover_image"] { XCTAssertEqual(group[key], expected[key]) }
                XCTAssertEqual(OfflineCatalog.price(group), expected["priceText"].text)
            }
            print("Offline live catalog and edge fixtures match mini-program: \(groups.count) grouped courses")
        }
        print("22 contract checks; failures=\(failures)")
        if failures > 0 { exit(1) }
    }
}

@MainActor func checkAutomaticRenewal(_ initial: VideoCacheLease) async throws {
    var now = 1001.0, stamp = 0.0, online = true, calls = 0, saves = 0, discarded = 0, mode = "ok"
    let keeper = AutomaticVideoCacheRenewal(lease: initial, trustedNow: { now }, retryNow: { stamp }, isOnline: { online }, isCurrent: { true }, renew: { old in
        calls += 1
        if mode == "network" { throw APIError.service("network") }
        if mode == "denied" { throw APIError.denied }
        var next = old; next.issued_at = now; next.expires_at = now + 86400000; return next
    }, persist: { _ in saves += 1 }, discard: { discarded += 1 })
    await keeper.refresh(); XCTAssertEqual(calls,1); XCTAssertEqual(saves,1)
    let expiry = keeper.lease.expires_at
    mode = "network"; now += 301000; stamp += 301000; await keeper.refresh()
    XCTAssertEqual(keeper.lease.expires_at,expiry); XCTAssertTrue(keeper.canPlay)
    now = expiry + 1; stamp += 86400000; online = false; await keeper.refresh(); XCTAssertFalse(keeper.canPlay); XCTAssertEqual(calls,2)
    online = true; mode = "ok"; stamp += 301000; await keeper.refresh(); XCTAssertTrue(keeper.canPlay); XCTAssertEqual(saves,2)
    mode = "denied"; stamp += 301000; now += 301000; await keeper.refresh(); XCTAssertFalse(keeper.canPlay); XCTAssertEqual(discarded,1)
}
