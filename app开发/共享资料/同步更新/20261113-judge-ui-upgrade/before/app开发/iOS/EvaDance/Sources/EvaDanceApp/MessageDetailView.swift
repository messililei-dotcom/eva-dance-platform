import SwiftUI
import EvaCore

struct MessageDetailView: View {
    @EnvironmentObject var session: Session
    let recipientID: String
    @State private var message: InboxMessage?
    @State private var failure: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let message {
                    Text(message.title).font(.title2.bold())
                    Text(message.createdAt).font(.caption).foregroundStyle(.secondary)
                    Text(message.content).textSelection(.enabled)
                } else if let failure {
                    Text(failure); Button("重试") { Task { await load() } }
                } else { ProgressView("正在加载消息") }
            }.frame(maxWidth: .infinity, alignment: .leading).padding()
        }.evaPageChrome().task(id: recipientID) { await load() }
    }
    private func load() async {
        guard let member = session.accountID, let token = session.token else { failure = "请登录后查看消息"; return }
        failure = nil
        do {
            let value: InboxMessage = try await session.api.request("/member/messages/\(recipientID)", token: token)
            guard session.accountID == member, !Task.isCancelled else { return }
            message = value
            let _: Empty = try await session.api.request("/member/messages/\(recipientID)/read", token: token, method: "PATCH", body: Data("{}".utf8))
            await session.notifications.refresh()
        } catch { if session.accountID == member { failure = error.localizedDescription } }
    }
}
