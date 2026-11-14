import SwiftUI
import EvaCore

enum EventUI {
    static func score(_ value: JSONValue) -> String {
        guard value != .null, !value.text.isEmpty, let score = Double(value.text), score.isFinite else { return "—" }
        return String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), score).replacingOccurrences(of: "\\.?0+$", with: "", options: .regularExpression)
    }
    static func rank(_ row: JSONValue) -> String {
        let rank = EventPresentation.count(row,"rankNo") ?? 0
        return rank == 1 ? "冠军" : rank == 2 ? "亚军" : rank == 3 ? "季军" : rank > 0 ? "第\(rank)名" : "成绩待公示"
    }
    static func matches(_ row: JSONValue, query: String) -> Bool {
        query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || ["name","playerName","groupName","category","ageRange","danceType","playerNo","organization","teacher"].map { row[$0].text }.joined(separator: " ").localizedCaseInsensitiveContains(query.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    static func count(_ row: JSONValue, key: String, fallback: Int) -> String { EventPresentation.count(row, key).map(String.init) ?? String(fallback) }
}
struct EventPageStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View { content.background(scheme == .dark ? EvaBrand.field : Color(red: 0.98, green: 0.976, blue: 0.965)) }
}
extension View { func eventPage() -> some View { modifier(EventPageStyle()) } }
struct EventSection<Content: View>: View {
    var title: String = ""
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 14) { if !title.isEmpty { Text(title).font(.title3.bold()) }; content }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14)) }
}
struct EventInfoRow: View {
    let label: String, value: String
    var highlight = false
    var body: some View { VStack(spacing: 10) { HStack(alignment: .firstTextBaseline, spacing: 16) { Text(label).foregroundStyle(.secondary); Spacer(); Text(value).foregroundStyle(highlight ? EvaBrand.red : Color.primary).multilineTextAlignment(.trailing).fixedSize(horizontal: false, vertical: true) }; Divider() }.font(.subheadline) }
}
struct EventAvatar: View {
    let row: JSONValue
    var size: CGFloat = 44
    var body: some View { ZStack { Circle().fill(EvaBrand.softAccent); if let url = AppPolicy.secureMediaURL(row["avatarUrl"].text) { AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Text(String(row.firstText("name","playerName").prefix(1))).foregroundStyle(EvaBrand.red) } } else { Text(String(row.firstText("name","playerName").prefix(1))).font(.headline).foregroundStyle(EvaBrand.red) } }.frame(width: size, height: size).clipShape(Circle()).accessibilityHidden(true) }
}
struct EventPersonRow: View {
    let row: JSONValue
    var result = false
    var body: some View { HStack(spacing: 10) {
        if result { VStack(spacing: 4) { Group { if row["rankNo"].number > 0 && row["rankNo"].number <= 3 { Image(systemName: "trophy.fill").foregroundStyle(EvaBrand.gold) } else { Text(row["rankNo"].number > 0 ? row["rankNo"].text : "—").font(.headline).foregroundStyle(.secondary) } }; Text(EventUI.rank(row)).font(.caption).foregroundStyle(.secondary) }.frame(minWidth: 48) }
        EventAvatar(row: row)
        VStack(alignment: .leading, spacing: 5) { Text(row.firstText("name","playerName")).font(.headline).foregroundStyle(.primary); Text([row["groupName"].text, row["playerNo"].text.isEmpty ? "" : "编号 " + row["playerNo"].text, row.firstText("organization","teacher")].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }.frame(maxWidth: .infinity, alignment: .leading)
        if result { VStack(alignment: .trailing, spacing: 4) { Text(EventUI.score(row["publishedTotal"])).font(.headline).foregroundStyle(EvaBrand.red); Text("最终得分").font(.caption).foregroundStyle(.secondary) } }
        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
    }.frame(minHeight: 64).padding(.vertical, 6) }
}
struct EventPages: View {
    @Binding var page: Int
    let total: Int
    var size = 20
    private var pages: Int { max(1, Int(ceil(Double(total) / Double(size)))) }
    var body: some View { if pages > 1 { HStack { Button("上一页") { page = max(1,page-1) }.disabled(page <= 1); Spacer(); Text("\(min(page,pages)) / \(pages) · \(total) 条").font(.subheadline).foregroundStyle(.secondary); Spacer(); Button("下一页") { page = min(pages,page+1) }.disabled(page >= pages) }.frame(minHeight: 44) } }
}
