import Foundation

public enum CoursePresentation {
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
        let key = row.firstText("group_key", "name")
        return rows.filter { $0.firstText("group_key", "name") == key }
    }
    public static func grouped(_ rows: [JSONValue]) -> [JSONValue] {
        var seen = Set<String>()
        return rows.filter { seen.insert($0.firstText("group_key", "name")).inserted }
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
            rows.append(.object(["id": video["id"], "ordinal": .number(Double(rows.count + 1)), "name": .string(unit["name"].text), "duration": .number(duration), "percent": percent.map { .number(Double($0)) } ?? .null]))
        }}
        return rows
    }
}
