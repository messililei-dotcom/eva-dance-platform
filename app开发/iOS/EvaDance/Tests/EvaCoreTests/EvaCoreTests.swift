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
        for path in ["/public/series", "/public/series/1/courses", "/public/offline-courses", "/events/2"] {
            XCTAssertTrue(AppPolicy.isSharedPublicRead(path,method:"GET",hasToken:false))
            XCTAssertFalse(AppPolicy.isSharedPublicRead(path,method:"POST",hasToken:false))
            XCTAssertFalse(AppPolicy.isSharedPublicRead(path,method:"GET",hasToken:true))
        }
        for path in ["/auth/login", "/member/profile", "/public/series/1/progress", "/events/2/register", "/video/1/play", "/public/../member/profile"] {
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

}


@main struct Checks {
    static func main() async throws {
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
        print("15 contract checks; failures=\(failures)")
        if failures > 0 { exit(1) }
    }
}
