import XCTest
import EvaCore

final class CourseEntryTests: XCTestCase {
    private let lessons: [JSONValue] = [.object(["id": .number(11)]), .object(["id": .number(22)])]
    func testNewLearnerStartsAtFirstLesson() {
        XCTAssertEqual(CoursePresentation.startingLessonID(lessons, progress: .array([])), 11)
    }
    func testLatestServerHistoryWinsRegardlessOfCatalogOrder() throws {
        let progress = try JSONDecoder().decode(JSONValue.self, from: Data(#"[{"video_id":22,"last_play_at":"2026-10-30 09:30:00"},{"video_id":11,"last_play_at":"2026-10-29 10:00:00"}]"#.utf8))
        XCTAssertEqual(CoursePresentation.startingLessonID(lessons, progress: progress), 22)
    }
    func testForeignAndUnwatchedRowsCannotSelectALesson() throws {
        let progress = try JSONDecoder().decode(JSONValue.self, from: Data(#"[{"video_id":999,"last_play_at":"2026-10-31 09:30:00"},{"video_id":22,"last_play_at":null}]"#.utf8))
        XCTAssertEqual(CoursePresentation.startingLessonID(lessons, progress: progress), 11)
        XCTAssertNil(CoursePresentation.startingLessonID([], progress: progress))
    }
}
