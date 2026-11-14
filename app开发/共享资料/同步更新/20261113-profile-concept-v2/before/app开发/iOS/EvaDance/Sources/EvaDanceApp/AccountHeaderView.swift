import SwiftUI
import EvaCore

struct AccountHeaderView: View {
    @EnvironmentObject var session: Session
    @ObservedObject var notifications: AppNotifications
    let profile: JSONValue
    let ready: Bool
    @ScaledMetric(relativeTo: .title) private var avatarSize = 64

    var body: some View {
        HStack(spacing: 14) {
            ArtworkImage(url: AppPolicy.secureMediaURL(profile.firstText("avatar_url", "wx_avatar_url")), symbol: "person.crop.circle.fill", label: "个人头像", ratio: nil)
                .frame(width: avatarSize, height: avatarSize).clipShape(Circle())
            VStack(alignment: .leading, spacing: 6) {
                Text(session.token == nil ? "欢迎来到伊娃东方舞" : ready ? displayName : "我的学习空间")
                    .font(.title3.bold()).lineLimit(2).foregroundStyle(.primary)
                Text(session.token == nil ? "登录后同步课程与个人资料" : ready ? identity : "资料与学习账号同步")
                    .font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }.frame(maxWidth: .infinity, alignment: .leading)
            if session.token != nil {
                NavigationLink { MessagesView() } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "bell").font(.title3).accessibilityHidden(true)
                        Text(notifications.unread > 0 ? "\(min(notifications.unread, 99))\(notifications.unread > 99 ? "+" : "") 未读" : "通知").font(.footnote)
                    }.foregroundStyle(EvaBrand.red).frame(minWidth: 48, minHeight: 48)
                }.accessibilityLabel("通知，\(notifications.unread)条未读")
            }
        }.padding(.vertical, 16)
    }

    private var displayName: String {
        let name = profile.firstText("wx_nickname", "wx_name", "name")
        return name.isEmpty ? "我的学习空间" : name
    }

    private var identity: String {
        let phone = profile["phone"].text
        let masked = phone.count == 11 ? String(phone.prefix(3)) + "****" + String(phone.suffix(4)) : "学习账号"
        let level = profile["level"].text
        return level.isEmpty ? masked : "\(level) · \(masked)"
    }
}
