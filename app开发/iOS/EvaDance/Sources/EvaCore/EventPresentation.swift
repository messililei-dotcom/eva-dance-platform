import Foundation

public enum EventPresentation {
    public static func count(_ row: JSONValue, _ keys: String...) -> Int? {
        for key in keys {
            let value = row[key]
            if case .null = value { continue }
            guard let number = Double(value.text), number.isFinite, number >= 0, number.rounded() == number,
                  number < Double(Int.max) else { continue }
            return Int(number)
        }
        return nil
    }
    public static func aggregate(_ rows: [JSONValue], participant: Bool) -> String {
        var total = 0
        for row in rows {
            let value = participant ? count(row, "approvedPlayerCount", "playerCount") : count(row, "rankingCount", "scoreCount")
            guard let value, value <= Int.max - total else { return participant ? "未公开" : "—" }
            total += value
        }
        return String(total)
    }
    public static func dateRange(_ row: JSONValue) -> String {
        let start = String(row.firstText("startDate", "start_date").prefix(10))
        let end = String(row.firstText("endDate", "end_date").prefix(10))
        return start.isEmpty ? "时间待定" : end.isEmpty || start == end ? start : "\(start) 至 \(end)"
    }
    private static func date(_ value: String, end: Bool = false) -> Date? {
        guard !value.isEmpty else { return nil }
        if value.count == 10 {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(identifier: "Asia/Shanghai")
            formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
            guard let parsed = formatter.date(from: value) else { return nil }
            return end ? parsed.addingTimeInterval(86_400 - 0.001) : parsed
        }
        let formatter = ISO8601DateFormatter()
        if let parsed = formatter.date(from: value) { return parsed }
        formatter.formatOptions.insert(.withFractionalSeconds)
        if let parsed = formatter.date(from: value) { return parsed }
        let local = DateFormatter()
        local.locale = Locale(identifier: "en_US_POSIX")
        local.timeZone = TimeZone(identifier: "Asia/Shanghai")
        local.dateFormat = "yyyy-MM-dd HH:mm:ss"; local.isLenient = false
        return local.date(from: value.replacingOccurrences(of: "T", with: " "))
    }
    public static func state(_ row: JSONValue, now: Date = .now) -> String {
        if row["status"].text == "cancelled" { return "已取消" }
        if row["status"].text == "finished" || date(row.firstText("endDate", "end_date"), end: true).map({ $0 < now }) == true { return "已结束" }
        let start = date(row["registrationStart"].text), end = date(row["registrationEnd"].text, end: true)
        if let start, start > now { return "报名未开始" }
        if let end, end < now { return "报名已截止" }
        return row["registrationStatus"].text == "open" ? "报名中" : "报名未开放"
    }
}
