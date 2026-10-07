import SwiftUI
import EvaCore

enum EvaBrand {
    static let red = Color(red: 0.624, green: 0.114, blue: 0.125)
    static let gold = Color(red: 0.725, green: 0.588, blue: 0.322)
    static let gradient = LinearGradient(colors: [red, gold], startPoint: .topLeading, endPoint: .bottomTrailing)
}
struct BrandHeader: View {
    let title: String
    let subtitle: String
    var icon = "sparkles"
    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: icon).font(.title2).frame(width: 38, height: 38)
                .background(.white.opacity(0.15), in: Circle()).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.headline)
                Text(subtitle).font(.caption).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }.padding(12).foregroundStyle(.white).frame(maxWidth: .infinity, alignment: .leading)
            .background(EvaBrand.gradient, in: RoundedRectangle(cornerRadius: 18))
    }
}
struct CourseHero: View {
    let course: JSONValue
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 16).fill(EvaBrand.gradient)
            if let url = AppPolicy.secureMediaURL(course["cover_image"].text) {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color.clear }
            }
            LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: 5) {
                Text(course["category"].text.isEmpty ? "精选课程" : course["category"].text).font(.caption.bold())
                Text(course["name"].text).font(.headline).lineLimit(2)
                Text("\(course["total_courses"].text) 节 · \(course["teacher"].text)").font(.subheadline)
            }.padding(12).foregroundStyle(.white)
        }.frame(height: 165).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}
struct CourseCarousel: View {
    let courses: [SiteRow]
    var body: some View {
        #if os(iOS)
        TabView {
            ForEach(courses) { row in NavigationLink { PublicCourseView(row: row.value) } label: { CourseHero(course: row.value).padding(.horizontal, 3).padding(.bottom, 22) }.buttonStyle(.plain) }
        }.tabViewStyle(.page(indexDisplayMode: .automatic)).frame(height: 190)
        #else
        ScrollView(.horizontal) { HStack { ForEach(courses) { row in NavigationLink { PublicCourseView(row: row.value) } label: { CourseHero(course: row.value).frame(width: 340) }.buttonStyle(.plain) } } }
        #endif
    }
}

/// Compact phone navigation, with touch targets and Dynamic Type kept intact.
struct CompactLearningLayout: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        content.navigationBarTitleDisplayMode(.inline)
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 44)
            .environment(\.defaultMinListHeaderHeight, 24)
        #else
        content.listStyle(.plain)
        #endif
    }
}
extension View {
    func evaCompactLayout() -> some View { modifier(CompactLearningLayout()) }
}
struct LearningShortcuts: View {
    var body: some View {
        HStack(spacing: 5) {
            NavigationLink { AuthGate { CoursesView() } } label: { shortcut("继续学习", "play.circle") }
            NavigationLink { AuthGate { StudyAssistantView() } } label: { shortcut("学习助手", "sparkles") }
            NavigationLink { UnifiedSearchView() } label: { shortcut("全站搜索", "magnifyingglass") }
        }.buttonStyle(.plain)
    }
    private func shortcut(_ title: String, _ icon: String) -> some View {
        VStack(spacing: 5) { Image(systemName: icon).foregroundStyle(EvaBrand.red); Text(title).font(.caption) }
            .frame(maxWidth: .infinity, minHeight: 48).padding(.vertical, 4)
            .background(EvaBrand.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
    }
}
