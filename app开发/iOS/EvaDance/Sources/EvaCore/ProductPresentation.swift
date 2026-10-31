import Foundation
public enum ProductPresentation {
    private static func valid(_ value: JSONValue) -> Double? {
        guard case .number(let number) = value, number.isFinite, number >= 0,
              number <= 9007199254740991, number.rounded() == number else { return nil }
        return number
    }
    public static func price(_ row: JSONValue) -> String {
        guard let amount = valid(row["priceFen"]) else { return "价格待确认" }
        return String(format: "¥%.2f", locale: Locale(identifier: "en_US_POSIX"), amount / 100)
    }
    public static func stock(_ row: JSONValue) -> String {
        guard let stock = valid(row["stock"]) else { return "库存待确认" }
        return stock == 0 ? "暂时售罄" : String(format: "库存 %.0f", locale: Locale(identifier: "en_US_POSIX"), stock)
    }
}
