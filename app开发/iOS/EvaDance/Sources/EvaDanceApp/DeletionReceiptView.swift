import SwiftUI
import EvaCore

struct DeletionReceiptView: View {
    @EnvironmentObject var session: Session
    let receipt: LocalDeletionReceipt
    @State private var result = JSONValue.null
    @State private var error: String?
    @State private var loading = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Form {
            Section("注销处理结果") {
                if loading { ProgressView("正在查询") }
                if !result["id"].text.isEmpty {
                    LabeledContent("申请编号", value: result["id"].text)
                    LabeledContent("处理状态", value: result["status"].text == "completed" ? "已完成" : "处理中")
                    Text(result["notice"].text)
                    if result["overdue"].bool { Text("处理已超过内部截止时间，请联系平台核查。").foregroundStyle(.red) }
                    if let completed = Double(result["completedAt"].text), completed > 0 {
                        LabeledContent("完成时间") { Text(Date(timeIntervalSince1970: completed / 1000), format: .dateTime) }
                    }
                }
                if let error { Text(error).foregroundStyle(.red) }
                Button("刷新处理结果") { Task { await load() } }.disabled(loading)
            }
            if !result["retention"].list.isEmpty {
                Section("依法留存明细") {
                    ForEach(result["retention"].rows) { row in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(row.value["scope"].text).font(.headline)
                            Text(row.value["basis"].text)
                            if let expiry = Double(row.value["expiresAt"].text) {
                                Text("保存至：" + Date(timeIntervalSince1970: expiry / 1000).formatted(date: .numeric, time: .omitted))
                            }
                        }
                    }
                }
            }
            Section("完成通知") {
                Text("处理完成后，平台会在此回执中提供完成时间和结果通知。退出账号后也可从“我的 → 注销进度与结果”查看，无需重新登录。请保留本机回执。")
                Text("如无法查看回执，可拨打 13548955558 联系平台核查。请勿向他人提供短信验证码。")
            }
        }
        .evaCompactLayout().evaPageChrome()
        .task { await load() }
        .onChange(of: scenePhase) { phase in if phase == .active { Task { await load() } } }
    }
    private func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let body = try JSONSerialization.data(withJSONObject: ["receiptToken": receipt.token, "acknowledge": true])
            let response: JSONValue = try await session.transport.request("/account-deletion-receipt", method: "POST", body: body)
            result = response
            error = nil
        } catch {
            self.error = "暂未查到结果或网络不可用。申请可能尚未提交成功；请返回申请页面重试，或稍后刷新。"
        }
    }
}
