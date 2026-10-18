import Foundation

/// Flexible transport for legacy optional fields. Screens explicitly select the fields they display.
public enum JSONValue: Codable, Equatable {
    case object([String: JSONValue]), array([JSONValue]), string(String), number(Double), bool(Bool), null
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    public subscript(_ key: String) -> JSONValue { if case .object(let v) = self { return v[key] ?? .null }; return .null }
    public var text: String {
        switch self {
        case .string(let v): return v
        case .number(let v): return v.isFinite ? (v.rounded() == v ? String(format: "%.0f", v) : String(v)) : ""
        case .bool(let v): return v ? "是" : "否"
        default: return ""
        }
    }
    public var number: Double { if case .number(let n) = self { return n }; return Double(text) ?? 0 }
    public var bool: Bool { if case .bool(let b) = self { return b }; return number != 0 }
    public var list: [JSONValue] { if case .array(let a) = self { return a }; return [] }
    public func firstText(_ keys: String...) -> String { keys.lazy.map { self[$0].text }.first { !$0.isEmpty } ?? "" }
    public var rows: [SiteRow] { scopedRows("") }
    public func scopedRows(_ namespace: String) -> [SiteRow] { list.enumerated().map { SiteRow(value: $0.element, fallback: $0.offset, namespace: namespace) } }
}
public struct SiteRow: Identifiable {
    public let value: JSONValue
    public let id: String
    public let listID: String
    public init(value: JSONValue, fallback: Int = 0, namespace: String = "") {
        self.value = value
        self.id = value.firstText("id", "playerId", "video_id", "sessionId").isEmpty ? "row-\(fallback)" : value.firstText("id", "playerId", "video_id", "sessionId")
        self.listID = namespace + ":" + self.id
    }
}
public struct CartLine: Equatable {
    public let id: String
    public let priceFen: Int
    public let quantity: Int
    public let stock: Int
    public init(id: String, priceFen: Int, quantity: Int, stock: Int) { self.id=id; self.priceFen=priceFen; self.quantity=quantity; self.stock=stock }
}
public enum CartPolicy {
    public static func total(_ lines: [CartLine]) -> Int? {
        guard lines.count <= 30, Set(lines.map(\.id)).count == lines.count else { return nil }
        var sum = 0
        for line in lines {
            guard !line.id.isEmpty, line.priceFen > 0, (1...99).contains(line.quantity), line.quantity <= line.stock else { return nil }
            let (item, overflow) = line.priceFen.multipliedReportingOverflow(by: line.quantity)
            let (next, sumOverflow) = sum.addingReportingOverflow(item)
            guard !overflow, !sumOverflow else { return nil }; sum = next
        }
        return sum
    }
}
