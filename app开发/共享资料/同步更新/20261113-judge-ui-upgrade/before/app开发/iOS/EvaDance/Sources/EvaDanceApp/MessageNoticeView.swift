import SwiftUI
struct MessageNoticeView: View {
    @ObservedObject var notifications: AppNotifications
    var body: some View {
        if let notice = notifications.notice {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge")
                Text(notice).font(.subheadline)
                Spacer(minLength: 8)
                Button("关闭", systemImage: "xmark") { notifications.notice = nil }.labelStyle(.iconOnly)
            }.padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)).padding(.horizontal)
            .task(id: notice) { try? await Task.sleep(nanoseconds: 5_000_000_000); if !Task.isCancelled { notifications.notice = nil } }
        }
    }
}
