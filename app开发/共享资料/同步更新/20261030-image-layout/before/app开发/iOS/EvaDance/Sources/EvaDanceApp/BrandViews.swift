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
    static let canvas = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? .systemGroupedBackground : UIColor(red: 246 / 255, green: 247 / 255, blue: 249 / 255, alpha: 1)
    })
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
    @ScaledMetric(relativeTo: .title2) private var badgeSize = 36
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
        }.padding(.vertical, 6).frame(maxWidth: .infinity, alignment: .leading)
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
private struct CompactListInsets: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        if #available(iOS 17.0, *) {
            content.contentMargins(.top, 4, for: .scrollContent).listSectionSpacing(12)
        } else { content }
        #else
        content
        #endif
    }
}
struct CompactLearningLayout: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        content.navigationBarTitleDisplayMode(.inline)
            .listStyle(.insetGrouped)
            .modifier(CompactListInsets())
            .scrollContentBackground(.hidden)
            .background(EvaBrand.canvas)
            .environment(\.defaultMinListRowHeight, 48)
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
            NavigationLink { AuthGate { CoursesView() } } label: { shortcut("我的课程", "book") }
            NavigationLink { AuthGate { OfflineScheduleView() } } label: { shortcut("课时与核销", "calendar") }
            NavigationLink { AuthGate { MyCompetitionsView() } } label: { shortcut("报名与成绩", "trophy") }
        }.buttonStyle(.plain)
    }
    private func shortcut(_ title: String, _ icon: String, primary: Bool = false) -> some View {
        let layout = typeSize.isAccessibilitySize ? AnyLayout(HStackLayout(spacing: 16)) : AnyLayout(VStackLayout(spacing: 9))
        return layout { Image(systemName: icon).font(.title3); Text(title).font(.subheadline.weight(.medium)) }
            .foregroundStyle(primary ? EvaBrand.onAccent : EvaBrand.red)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(primary ? EvaBrand.red : EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14))
            .contentShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityElement(children: .combine)
    }
}

/// A single content-first treatment for the five native destinations.
struct EvaHomeLayout: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        let page = content.navigationBarTitleDisplayMode(.inline).background(EvaBrand.canvas)
        // An empty inset can reserve the full viewport in an optimized build.
        // Install this diagnostic bar only when it actually has content.
        #if DEBUG
        if ProcessInfo.processInfo.environment["EVA_API_BASE"] != nil {
            page.safeAreaInset(edge: .top, spacing: 0) {
                    Text("本地测试数据，非真实课程").font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
        } else { page }
        #else
        page
        #endif
        #else
        content.background(EvaBrand.canvas)
        #endif
    }
}
extension View {
    func evaHomeLayout() -> some View { modifier(EvaHomeLayout()) }
    func evaSearch(text: Binding<String>, prompt: String) -> some View {
        VStack(spacing: 6) {
            EvaSearchField(text: text, prompt: prompt).padding(.horizontal, 16).padding(.top, 4)
            self
        }.background(EvaBrand.canvas)
    }
    @ViewBuilder func evaPageChrome(root: Bool = false) -> some View {
        #if os(iOS)
        self.navigationTitle("").navigationBarTitleDisplayMode(.inline)
            .toolbar(root ? .hidden : .visible, for: .navigationBar)
        #else
        self.navigationTitle("")
        #endif
    }
}

struct EvaSearchField: View {
    @Binding var text: String
    let prompt: String
    @FocusState private var focused: Bool
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
            TextField(prompt, text: $text).font(.subheadline).autocorrectionDisabled()
                .focused($focused).submitLabel(.search).onSubmit { focused = false }
                .accessibilityLabel(prompt)
            if !text.isEmpty {
                Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    .frame(minWidth: 44, minHeight: 44).accessibilityLabel("清空搜索")
            }
        }.padding(.horizontal, 12).frame(maxWidth: 760, minHeight: 44)
            .background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}
