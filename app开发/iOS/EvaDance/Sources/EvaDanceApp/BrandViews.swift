import SwiftUI
import EvaCore
#if os(iOS)
import UIKit
#endif

enum EvaBrand {
    #if os(iOS)
    static let red = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 1, green: 0.67, blue: 0.66, alpha: 1) : UIColor(red: 0.624, green: 0.114, blue: 0.125, alpha: 1)
    })
    #else
    static let red = Color(red: 0.624, green: 0.114, blue: 0.125)
    #endif
    static let gold = Color(red: 0.725, green: 0.588, blue: 0.322)
    static let gradient = LinearGradient(colors: [red, gold], startPoint: .topLeading, endPoint: .bottomTrailing)
    #if os(iOS)
    static let canvas = Color(uiColor: .systemGroupedBackground)
    static let surface = Color(uiColor: .secondarySystemGroupedBackground)
    static let onAccent = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? .black : .white })
    #else
    static let canvas = Color.gray.opacity(0.06)
    static let surface = Color(nsColor: .controlBackgroundColor)
    static let onAccent = Color.white
    #endif
    static let softAccent = red.opacity(0.07)
}
struct BrandHeader: View {
    @ScaledMetric(relativeTo: .title2) private var badgeSize = 44
    let title: String
    let subtitle: String
    var icon = "sparkles"
    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: icon).font(.title2).foregroundStyle(EvaBrand.red)
                .frame(width: badgeSize, height: badgeSize).background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.title3.bold()).foregroundStyle(.primary)
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }.padding(.vertical, 10).frame(maxWidth: .infinity, alignment: .leading)
    }
}
struct CourseHero: View {
    let course: JSONValue
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: 16).fill(EvaBrand.gradient)
            if let url = AppPolicy.secureMediaURL(course["cover_image"].text) {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color.clear }
                    .frame(height: 165).clipped()
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
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(EvaBrand.canvas)
            .environment(\.defaultMinListRowHeight, 52)
            .environment(\.defaultMinListHeaderHeight, 24)
        #else
        content.listStyle(.inset)
        #endif
    }
}
extension View {
    func evaCompactLayout() -> some View { modifier(CompactLearningLayout()) }
}
struct LearningShortcuts: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 10))
        layout {
            NavigationLink { AuthGate { CoursesView() } } label: { shortcut("继续学习", "play.fill", primary: true) }
            NavigationLink { AuthGate { StudyAssistantView() } } label: { shortcut("学习助手", "sparkles") }
            NavigationLink { UnifiedSearchView() } label: { shortcut("全站搜索", "magnifyingglass") }
        }.buttonStyle(.plain)
    }
    private func shortcut(_ title: String, _ icon: String, primary: Bool = false) -> some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(HStackLayout(spacing: 16)) : AnyLayout(VStackLayout(spacing: 9))
        return layout { Image(systemName: icon).font(.title3); Text(title).font(.subheadline.weight(.medium)) }
            .foregroundStyle(primary ? EvaBrand.onAccent : EvaBrand.red)
            .frame(maxWidth: .infinity, minHeight: 80).padding(.vertical, 4)
            .background(primary ? EvaBrand.red : EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14))
            .contentShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityElement(children: .combine)
    }
}

/// A single content-first treatment for the five native destinations.
struct EvaHomeLayout: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        content.navigationBarTitleDisplayMode(.large).background(EvaBrand.canvas)
            .toolbar {
                #if DEBUG
                if ProcessInfo.processInfo.environment["EVA_API_BASE"] != nil {
                    ToolbarItem(placement: .navigationBarTrailing) { Text("测试数据").font(.caption2).foregroundStyle(.secondary).accessibilityLabel("本地测试数据，非真实课程") }
                }
                #endif
            }
        #else
        content.background(EvaBrand.canvas)
        #endif
    }
}
extension View {
    func evaHomeLayout() -> some View { modifier(EvaHomeLayout()) }
    @ViewBuilder func evaSearch(text: Binding<String>, prompt: String) -> some View {
        #if os(iOS)
        searchable(text: text, placement: .navigationBarDrawer(displayMode: .always), prompt: prompt)
        #else
        searchable(text: text, prompt: prompt)
        #endif
    }
}
