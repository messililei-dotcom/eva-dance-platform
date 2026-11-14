import Foundation

public enum CoursePresentation {
    /// Match the mini-program's configured public display count, not concurrent viewers.
    public static func learnerText(_ row: JSONValue) -> String? {
        guard row["student_display_base"] != .null, row["total_students"] != .null else { return nil }
        let base = row["student_display_base"].number, students = row["total_students"].number
        guard base.isFinite, base >= 500, base <= 1000, base.rounded() == base,
              students.isFinite, students >= 0, students.rounded() == students, students < Double(Int.max) - 1000 else { return nil }
        return "\(Int(students + base))名学员"
    }

    public static func learningPercent(_ records: JSONValue) -> Int {
        guard !records.list.isEmpty else { return 0 }
        let total = records.list.reduce(0.0) { sum, row in
            let duration = row["duration"].number
            let watched = row["progress"].number
            let fraction = row["completed"].bool ? 1 : duration > 0 && watched.isFinite ? min(1, max(0, watched / duration)) : 0
            return sum + fraction
        }
        return Int((total / Double(records.list.count) * 100).rounded(.down))
    }

    /// Resume only a lesson in this catalog using the current member's server history.
    public static func startingLessonID(_ lessons: [JSONValue], progress: JSONValue) -> Int? {
        let ids = lessons.compactMap { Int($0["id"].text) }.filter { $0 > 0 }
        var selected = ids.first
        var latest = ""
        for record in progress.list {
            guard let id = Int(record["video_id"].text), ids.contains(id) else { continue }
            let playedAt = record["last_play_at"].text.replacingOccurrences(of: "T", with: " ")
            if !playedAt.isEmpty && playedAt > latest { latest = playedAt; selected = id }
        }
        return selected
    }
    public static func isAudio(_ name: String) -> Bool {
        name.hasPrefix("音频") || name.range(of: "\\.(m4a|mp3|aac|wav|flac|ogg)$", options: [.regularExpression, .caseInsensitive]) != nil
    }
    public static func price(_ row: JSONValue) -> String {
        if row["period_status"] == .null && row["is_free"].bool { return "免费" }
        let amount = row["promo_price"].number > 0 ? row["promo_price"].number : row["price"].number
        guard amount.isFinite, amount > 0 else { return "咨询价格" }
        return String(format: "¥%.2f", amount)
    }
    public static func originalPrice(_ row: JSONValue) -> String? {
        let original = row["price"].number, promo = row["promo_price"].number
        guard !row["is_free"].bool, promo > 0, original > promo else { return nil }
        return String(format: "原价 ¥%.2f", original)
    }
    public static func introduction(_ row: JSONValue) -> JSONValue {
        let copy = OfficialOfflineCopy.data
        let override = copy["periodOverrides"][row["source_id"].text]
        let matched = copy["courses"][copy["aliases"][row["group_key"].text].text]
        return override != .null ? override : matched
    }
    public static func description(_ row: JSONValue) -> String {
        let intro = introduction(row)["fullDescription"].text
        return (intro.isEmpty ? row["description"].text : intro).replacingOccurrences(of: "开课时间：[^｜\\n]+", with: "开课时间：以所选期次安排为准", options: .regularExpression)
    }
    public static func periods(_ rows: [JSONValue], for row: JSONValue) -> [JSONValue] {
        OfflineCatalog.periods(rows, for: row)
    }
    public static func grouped(_ rows: [JSONValue]) -> [JSONValue] {
        OfflineCatalog.grouped(rows)
    }
    public static func canPurchase(_ row: JSONValue, now: Date = Date()) -> Bool {
        guard ["active", "planned"].contains(row["period_status"].text), row["price"].number > 0, row["source_id"].number > 0 else { return false }
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 28800); formatter.dateFormat = "yyyy-MM-dd"
        let end = String(row["end_date"].text.prefix(10))
        return (end.isEmpty || end >= formatter.string(from: now)) && (row["capacity"].number <= 0 || row["remaining"].number > 0)
    }
    public static func catalog(_ units: JSONValue, progress: JSONValue) -> [JSONValue] {
        var rows: [JSONValue] = []
        for unit in units.list { for video in unit["videos"].list where video["id"].number > 0 {
            let checkpoint = progress.list.first { $0["video_id"].text == video["id"].text }
            let duration = checkpoint?["duration"].number ?? video["duration"].number
            let percent = checkpoint.map { $0["completed"].bool || (duration > 0 && $0["progress"].number >= duration) ? 100 : duration > 0 ? min(99, Int($0["progress"].number / duration * 100)) : 0 }
            rows.append(.object(["id": video["id"], "ordinal": .number(Double(rows.count + 1)), "name": .string(video.firstText("name").isEmpty ? unit["name"].text : video["name"].text), "subtitle": unit["name"], "mediaKind": .string(isAudio(video["name"].text) ? "audio" : "video"), "duration": .number(duration), "percent": percent.map { .number(Double($0)) } ?? .null]))
        }}
        return rows
    }
}
