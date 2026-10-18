import Foundation

public enum CompetitionRecord {
    public static func result(_ row: JSONValue) -> String {
        guard row["resultPublished"] == .bool(true) else { return "成绩待公示" }
        let award = row["awardName"].text
        let rank = row["rankNo"].number
        let label = !award.isEmpty ? award : rank > 0 ? "第\(row["rankNo"].text)名" : "成绩已公示"
        let score = row["totalScore"].text
        return label + (score.isEmpty ? "" : " · \(score)分")
    }
    public static func audit(_ value: String) -> String {
        ["pending":"待审核", "approved":"审核通过", "rejected":"未通过"][value] ?? (value.isEmpty ? "待审核" : value)
    }
    public static func paid(_ value: String) -> String {
        ["unpaid":"待缴费", "pending":"待确认", "paid":"已缴费", "refunded":"已退款"][value] ?? value
    }
}
