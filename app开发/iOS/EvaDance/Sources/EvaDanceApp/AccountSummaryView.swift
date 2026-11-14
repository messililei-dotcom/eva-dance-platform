import SwiftUI
import EvaCore

struct AccountSummaryView: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let profile: JSONValue
    let ready: Bool

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: typeSize.isAccessibilitySize ? 2 : 4), spacing: 8) {
            NavigationLink { CoursesView() } label: { AccountShortcutView(title: "线上课", icon: "book.closed") }
            NavigationLink { OfflineScheduleView() } label: { AccountShortcutView(title: "线下课", icon: "calendar") }
            NavigationLink { MyCompetitionsView() } label: { AccountShortcutView(title: "我的比赛", icon: "trophy") }
            NavigationLink { CertificatesView() } label: { AccountShortcutView(title: "我的证书", icon: "rosette") }
        }
    }

}
