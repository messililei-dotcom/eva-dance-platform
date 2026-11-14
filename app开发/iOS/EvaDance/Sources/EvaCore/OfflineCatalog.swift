import Foundation
public enum OfflineCatalog {
    public static func key(_ row: JSONValue) -> String {
        row.firstText("group_key", "name").trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).lowercased()
    }
    private static func year(_ row: JSONValue) -> Int {
        let text = ["start_date", "end_date", "subtitle"].map { row[$0].text }.joined(separator: " ")
        let regex = try! NSRegularExpression(pattern: "20[0-9]{2}")
        return regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { Range($0.range, in: text).flatMap { Int(text[$0]) } }.max() ?? 0
    }
    public static func periods(_ rows: [JSONValue], for row: JSONValue) -> [JSONValue] {
        rows.filter { key($0) == key(row) }.sorted { a, b in
            if year(a) != year(b) { return year(a) > year(b) }
            let ad = String(a.firstText("start_date", "end_date").trimmingCharacters(in: .whitespacesAndNewlines).prefix(10)), bd = String(b.firstText("start_date", "end_date").trimmingCharacters(in: .whitespacesAndNewlines).prefix(10))
            if ad != bd { return ad > bd }
            return a["id"].number > b["id"].number
        }
    }
    public static func periodLabel(_ row: JSONValue) -> String {
        let start = String(row["start_date"].text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(10)), end = String(row["end_date"].text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(10))
        if !start.isEmpty { return start + (!end.isEmpty && end != start ? " 至 " + end : "") }
        let subtitle = row["subtitle"].text.trimmingCharacters(in: .whitespacesAndNewlines)
        return !subtitle.isEmpty && subtitle.lowercased() != "offline" ? subtitle : "期次待公布"
    }
    public static func grouped(_ rows: [JSONValue]) -> [JSONValue] {
        var seen = Set<String>()
        return rows.compactMap { row in
            guard !key(row).isEmpty, seen.insert(key(row)).inserted else { return nil }
            let entries = periods(rows, for: row)
            guard let first = entries.first, case .object(var value) = first else { return nil }
            value["offline_period_count"] = .number(Double(entries.count))
            value["offline_latest_period"] = .string(periodLabel(first))
            value["offline_student_count"] = .number(entries.map { $0["group_total_students"] == .null ? $0["total_students"].number : $0["group_total_students"].number }.max() ?? 0)
            value["offline_min_price"] = .number(entries.map { $0["price"].number }.filter { $0 > 0 && $0.isFinite }.min() ?? 0)
            if first["cover_image"].text.isEmpty { value["cover_image"] = entries.first { !$0["cover_image"].text.isEmpty }?["cover_image"] ?? .string("") }
            value["offline_search_text"] = .string(entries.map { entry in ["name","subtitle","teacher","category","start_date","end_date"].map { entry[$0].text }.joined(separator: " ") }.joined(separator: " "))
            return .object(value)
        }
    }
    public static func price(_ row: JSONValue) -> String {
        let price = row["offline_min_price"].number > 0 ? row["offline_min_price"].number : row["price"].number
        guard price.isFinite, price > 0 else { return "咨询价格" }
        let value = String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), price).replacingOccurrences(of: "\\.00$", with: "", options: .regularExpression).replacingOccurrences(of: "(\\.\\d*[1-9])0+$", with: "$1", options: .regularExpression)
        return "¥" + value + (row["offline_period_count"].number > 1 ? "起" : "")
    }
}
