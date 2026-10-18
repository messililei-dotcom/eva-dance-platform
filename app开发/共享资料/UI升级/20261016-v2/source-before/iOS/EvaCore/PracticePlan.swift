import Foundation

/// Transparent on-device planning; never invents a course, entitlement or completion event.
public enum PracticePlan {
    public static func minutes(_ requested: Int) -> [Int] {
        let total = min(60, max(10, requested))
        let warmup = max(2, total / 5)
        let review = max(2, total / 5)
        return [warmup, total - warmup - review, review]
    }
    public static func matches(_ value: JSONValue, query: String, fields: [String]) -> Bool {
        let words = query.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return true }
        let text = fields.map { value[$0].text }.joined(separator: " ")
        return words.allSatisfy { text.localizedCaseInsensitiveContains($0) }
    }
}
