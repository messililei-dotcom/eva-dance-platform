import SwiftUI
import EvaCore
import AVFoundation

/// Staff credentials stay in memory and never replace or reuse a member session.
@MainActor final class StaffSession: ObservableObject {
    @Published private(set) var credentials: StaffLogin?
    let api = APIClient(baseURL: StaffPolicy.apiBase)
    func login(username: String, password: String) async throws { credentials = try await api.staffLogin(username: username, password: password) }
    func clear() { credentials = nil }
}
@MainActor final class StaffData: ObservableObject {
    @Published var data: JSONValue = .null
    @Published var busy = false
    @Published var error: String?
    func load(_ path: String, staff: StaffSession) async {
        _ = await send(path, method: "GET", staff: staff)
    }
    func send(_ path: String, method: String = "POST", body: [String: Any] = [:], staff: StaffSession) async -> JSONValue? {
        guard !busy, let token = staff.credentials?.token else { return nil }
        busy = true; error = nil; defer { busy = false }
        do {
            let result: JSONValue = try await staff.api.request(path, token: token, method: method, body: method == "GET" ? nil : JSONSerialization.data(withJSONObject: body))
            guard staff.credentials?.token == token else { return nil }
            data = result; return result
        } catch {
            guard staff.credentials?.token == token else { return nil }
            self.error = error.localizedDescription
            if case APIError.sessionExpired = error { staff.clear() }
            return nil
        }
    }
}
struct StaffStatus: View {
    @ObservedObject var store: StaffData
    var retry: () -> Void
    var body: some View {
        if store.busy { ProgressView("正在同步平台记录…") }
        if let error = store.error { Text(error).foregroundStyle(.red); Button("重新加载", action: retry).disabled(store.busy) }
    }
}
struct StaffEventRootView: View {
    @StateObject private var staff = StaffSession()
    var body: some View {
        Group {
            if staff.credentials != nil { StaffCompetitionsView() }
            else { StaffLoginView() }
        }.environmentObject(staff)
        .toolbar { if staff.credentials != nil { Button("退出管理") { staff.clear() } } }
    }
}
struct StaffLoginView: View {
    @EnvironmentObject var staff: StaffSession
    @State private var username = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        Form {
            Text("使用数字化平台的工作人员账号。赛事管理员仅能管理本人拥有的赛事。")
            TextField("工作人员账号", text: $username).autocorrectionDisabled()
            SecureField("密码", text: $password)
            Button("登录赛事管理") { Task {
                busy = true; error = nil; defer { busy = false; password = "" }
                do { try await staff.login(username: username.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
                catch { self.error = error.localizedDescription }
            } }.disabled(busy || username.isEmpty || password.isEmpty)
            if busy { ProgressView() }
            if let error { Text(error).foregroundStyle(.red) }
        }.evaCompactLayout().navigationTitle("工作人员登录")
    }
}
struct StaffCompetitionsView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    @State private var query = ""
    var body: some View {
        List {
            StaffStatus(store: store) { Task { await load() } }
            ForEach(store.data.rows.filter { PracticePlan.matches($0.value, query: query, fields: ["name", "code", "location"]) }) { row in
                NavigationLink { StaffCompetitionView(event: row.value) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.value["name"].text).font(.headline)
                        Text("\(row.value["startDate"].text) · \(row.value["location"].text)").font(.caption)
                        Text("\(row.value["groupCount"].text) 组 · \(row.value["playerCount"].text) 条报名").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }.evaCompactLayout().navigationTitle("赛事管理").searchable(text: $query, prompt: "搜索赛事名称、编号或地点")
            .task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/event/competitions", staff: staff) }
}
struct StaffCompetitionView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let event: JSONValue
    @State private var operation: String?
    var body: some View {
        List {
            Text(event["name"].text).font(.headline)
            NavigationLink("报名和音乐 · 节目汇总") { StaffEntriesView(eventID: event["id"].text) }
            NavigationLink("选手汇总 · 一人多项报名") { StaffEntriesView(eventID: event["id"].text, contestants: true) }
            NavigationLink("组别管理与出场顺序") { StaffGroupsView(eventID: event["id"].text) }
            NavigationLink("赛程") { StaffRecordView(title: "赛程", path: "/event/competitions/\(event["id"].text)", fields: ["startDate", "endDate", "location", "registrationStatus"]) }
            Section("报名与公示") {
                Button("开放报名") { operation = "openRegistration" }
                Button("关闭报名") { operation = "closeRegistration" }
                Button("公开报名信息") { operation = "showRegistration" }
                Button("隐藏报名信息") { operation = "hideRegistration" }
                Button("公开评委评分") { operation = "showJudgeScores" }
                Button("隐藏评委评分") { operation = "hideJudgeScores" }
            }.disabled(store.busy)
            StaffStatus(store: store) { }
        }.evaCompactLayout().navigationTitle("赛事工作台")
        .confirmationDialog("确认修改此赛事的报名或公示设置？", isPresented: Binding(get: {operation != nil}, set: {if !$0 {operation = nil}})) {
            if let operation { Button("确认修改") { Task { _ = await store.send("/event/competitions/\(event["id"].text)", method: "PATCH", body: ["action": operation], staff: staff); self.operation = nil } } }
        }
    }
}
struct StaffGroupsView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let eventID: String
    @State private var query = ""
    var body: some View {
        List {
            StaffStatus(store: store) { Task { await load() } }
            ForEach(store.data.rows.filter { PracticePlan.matches($0.value, query: query, fields: ["name"]) }) { row in
                NavigationLink { StaffGroupView(eventID: eventID, group: row.value) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.value["name"].text).fixedSize(horizontal: false, vertical: true)
                        Text("\(row.value["playerCount"].text) 条报名 · ¥\(String(format: "%.2f", row.value["registrationFee"].number))").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }.evaCompactLayout().navigationTitle("组别管理").searchable(text: $query, prompt: "搜索完整组别名称")
            .task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/event/groups?competitionId=\(eventID)", staff: staff) }
}
struct StaffGroupView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let eventID: String
    let group: JSONValue
    @State private var confirm = false
    @State private var done = ""
    var body: some View {
        List {
            Text(group["name"].text).font(.headline)
            NavigationLink("报名、音乐与出场顺序") { StaffEntriesView(eventID: eventID, groupID: group["id"].text) }
            Button("随机安排本组出场顺序") { confirm = true }.disabled(store.busy)
            Text("重新编排只修改本组有效报名的出场顺序，选手编号与节目编号保持独立。").font(.caption)
            if !done.isEmpty { Text(done) }
            StaffStatus(store: store) { }
        }.evaCompactLayout().navigationTitle("组别工作台")
        .confirmationDialog("重新随机安排“\(group["name"].text)”的出场顺序？", isPresented: $confirm) {
            Button("确认重新编排") { Task {
                if let result = await store.send("/event/players/batch", method: "PATCH", body: ["action": "randomize_sequence", "competitionId": Int(eventID) ?? 0, "groupId": Int(group["id"].text) ?? 0], staff: staff) { done = "已编排 \(result["updated"].text) 条报名，请打开报名列表查看。" }
            } }
        }
    }
}
struct StaffEntriesView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let eventID: String
    var groupID = ""
    var contestants = false
    @State private var query = ""
    @State private var csv: URL?
    var rows: [SiteRow] {
        let list = store.data[contestants ? "contestants" : "players"].rows
        return list.filter { (groupID.isEmpty || $0.value["groupId"].text == groupID || $0.value["entries"].list.contains { $0["groupId"].text == groupID }) && PracticePlan.matches($0.value, query: query, fields: ["name", "phone", "organization", "groupName", "performanceTitle", "musicName", "contestantNumber", "programNumber"]) }
    }
    var body: some View {
        List {
            Text("共 \(store.data["contestants"].list.count) 名选手 · \(store.data["players"].list.count) 个节目").font(.caption)
            Text("先按完整报名记录编号，再搜索筛选；一人可有多条报名。").font(.caption).foregroundStyle(.secondary)
            StaffStatus(store: store) { Task { await load() } }
            ForEach(rows) { row in
                if contestants {
                    Section("\(row.value["contestantNumber"].text) · \(row.value["name"].text)") {
                        Text("\(row.value["entries"].list.count) 项报名 · 合计报名费 ¥\(String(format: "%.2f", row.value["totalRegistrationFee"].number))")
                        ForEach(row.value["entries"].rows) { entry in NavigationLink(entry.value["groupName"].text + " · " + entry.value["programNumber"].text) { StaffPlayerView(id: entry.id) } }
                    }
                } else {
                    NavigationLink { StaffPlayerView(id: row.id) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(row.value["programNumber"].text) · \(row.value["name"].text)").font(.headline)
                            Text(row.value["groupName"].text).fixedSize(horizontal: false, vertical: true)
                            Text("\(row.value["contestantNumber"].text) · 出场顺序 \(row.value["sequenceNo"].text) · \(statusLabel(row.value["paidStatus"].text))").font(.caption)
                            Text(row.value["musicName"].text.isEmpty ? "未关联音乐" : "音乐：" + row.value["musicName"].text).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            if let csv { ShareLink("分享当前报名表 CSV", item: csv) }
        }.evaCompactLayout().navigationTitle(contestants ? "选手汇总" : "报名和音乐").searchable(text: $query, prompt: "搜索姓名、编号、组别或音乐")
            .task { await load() }.refreshable { await load() }
            .toolbar { if !contestants { Button("导出") { exportCSV() }.disabled(store.busy || rows.isEmpty) } }
            .onDisappear { if let csv { try? FileManager.default.removeItem(at: csv); self.csv = nil } }
    }
    private func load() async { await store.load("/event/entry-summary?competitionId=\(eventID)", staff: staff) }
    private func exportCSV() {
        let fields = ["programNumber", "contestantNumber", "name", "groupName", "sequenceNo", "performanceTitle", "musicName", "registrationFee", "paidStatus"]
        let header = ["节目编号", "选手编号", "姓名", "完整组别名称", "出场顺序", "节目名称", "音乐", "报名费", "缴费状态"].map(StaffPolicy.csvCell).joined(separator: ",")
        let text = "\u{FEFF}" + ([header] + rows.map { row in fields.map { StaffPolicy.csvCell(row.value[$0].text) }.joined(separator: ",") }).joined(separator: "\r\n")
        do {
            if let csv { try? FileManager.default.removeItem(at: csv) }
            let file = FileManager.default.temporaryDirectory.appendingPathComponent("赛事报名-\(UUID().uuidString).csv")
            try Data(text.utf8).write(to: file, options: .atomic); csv = file
        } catch { store.error = "报名表导出失败，请重试" }
    }
}
struct StaffPlayerView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let id: String
    var body: some View {
        List {
            StaffStatus(store: store) { Task { await load() } }
            if store.data != .null {
                let player = store.data
                Section("报名详情") {
                    ForEach([("姓名", "name"), ("完整组别", "groupName"), ("手机号", "phone"), ("机构", "organization"), ("老师", "teacher"), ("节目", "performanceTitle"), ("编号", "playerNo"), ("出场顺序", "sequenceNo")], id: \.1) { label, key in LabeledContent(label, value: player[key].text) }
                }
                Section("报名和音乐") {
                    LabeledContent("音乐", value: player["musicName"].text.isEmpty ? "未关联" : player["musicName"].text)
                    LabeledContent("时长", value: player["musicDuration"].text + " 秒")
                    if let musicID = Int(player["musicFileId"].text), musicID > 0 { NavigationLink("试听音乐") { StaffMusicView(id: musicID, name: player["musicName"].text) } }
                }
                Section("报名费") {
                    LabeledContent("应收", value: "¥" + String(format: "%.2f", player["registrationFee"].number))
                    LabeledContent("已收", value: "¥" + String(format: "%.2f", player["paidAmount"].number))
                    Text(statusLabel(player["paidStatus"].text))
                    NavigationLink("缴费与退款流水") { StaffRecordView(title: "缴费流水", path: "/event/players/\(id)/payments", fields: ["kind", "amount", "method", "paid_at", "remark"]) }
                    NavigationLink("登记缴费 / 退款") { StaffPaymentView(player: player) }
                }
                NavigationLink("修正报名资料") { StaffPlayerEditor(player: player) }
            }
        }.evaCompactLayout().navigationTitle("报名详情").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/event/players/\(id)", staff: staff) }
}
struct StaffPlayerEditor: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let player: JSONValue
    @State private var name = ""
@State private var phone = ""
@State private var organization = ""
@State private var teacher = ""
@State private var title = ""
@State private var remark = ""
    @State private var confirm = false
    @State private var done = false
    var body: some View {
        Form {
            TextField("姓名", text: $name); TextField("手机号", text: $phone)
            TextField("机构", text: $organization); TextField("指导老师", text: $teacher)
            TextField("节目名称", text: $title); TextField("备注", text: $remark)
            Text("缴费状态须通过独立流水登记，编号由平台管理。").font(.caption)
            Button("保存修正") { confirm = true }.disabled(store.busy || name.isEmpty || phone.isEmpty || title.isEmpty || done)
            if done { Text("报名资料已更新") }
            StaffStatus(store: store) { }
        }.evaCompactLayout().navigationTitle("报名修正").task { name = player["name"].text; phone = player["phone"].text; organization = player["organization"].text; teacher = player["teacher"].text; title = player["performanceTitle"].text; remark = player["remark"].text }
        .confirmationDialog("保存本条报名的资料修正？", isPresented: $confirm) { Button("确认保存") { Task { done = await store.send("/event/players/\(player["id"].text)", method: "PUT", body: ["name": name, "phone": phone, "organization": organization, "teacher": teacher, "performanceTitle": title, "remark": remark], staff: staff) != nil } } }
    }
}
struct StaffPaymentView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let player: JSONValue
    @State private var kind = "charge"
    @State private var method = "wechat"
    @State private var amount = ""
    @State private var remark = ""
    @State private var date = Date()
    @State private var requestKey = UUID().uuidString
    @State private var confirm = false
    @State private var done = false
    var body: some View {
        Form {
            Text(player["name"].text + " · " + player["groupName"].text)
            Picker("登记类型", selection: $kind) { Text("缴费").tag("charge"); Text("退款").tag("refund") }
            TextField("实际金额（元）", text: $amount)
            Picker("方式", selection: $method) { Text("微信").tag("wechat"); Text("支付宝").tag("alipay"); Text("银行卡").tag("bank"); Text("现金").tag("cash"); Text("其他").tag("other") }
            DatePicker("实际收款或退款时间", selection: $date, in: ...Date())
            TextField("备注", text: $remark)
            Text("单条报名须一次缴清；退款须全额退回。此功能记录实际收退款，款项须另行完成。").font(.caption)
            Button("提交登记") { confirm = true }.disabled(store.busy || done || Double(amount) == nil)
            if done { Text("流水登记成功") }
            StaffStatus(store: store) { }
        }.evaCompactLayout().navigationTitle("缴费登记").task { amount = String(format: "%.2f", player["registrationFee"].number) }
        .confirmationDialog("确认已经实际完成这笔收款或退款，并登记 ¥\(amount)？", isPresented: $confirm) {
            Button("确认实际完成并登记") { Task {
                if await store.send("/event/players/\(player["id"].text)/payments", body: ["kind": kind, "method": method, "amount": Double(amount) ?? 0, "paidAt": ISO8601DateFormatter().string(from: date), "remark": remark, "requestKey": requestKey], staff: staff) != nil { done = true }
            } }
        }
    }
}
struct StaffRecordView: View {
    @EnvironmentObject var staff: StaffSession
    @StateObject private var store = StaffData()
    let title: String
    let path: String
    let fields: [String]
    var records: [SiteRow] { store.data.list.isEmpty && store.data != .null ? [SiteRow(value: store.data)] : store.data.rows }
    var body: some View {
        List {
            StaffStatus(store: store) { Task { await load() } }
            ForEach(records) { row in VStack(alignment: .leading, spacing: 4) { ForEach(fields, id: \.self) { key in if !row.value[key].text.isEmpty { Text(row.value[key].text) } } } }
        }.evaCompactLayout().navigationTitle(title).task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load(path, staff: staff) }
}
struct StaffMusicView: View {
    @EnvironmentObject var staff: StaffSession
    let id: Int
    let name: String
    @State private var player: AVAudioPlayer?
    @State private var error: String?
    @State private var busy = true
    var body: some View {
        VStack(spacing: 16) {
            Text(name).font(.headline)
            if busy { ProgressView("正在验证音乐访问权限…") }
            if let error { Text(error).foregroundStyle(.red) }
            if player != nil { Button("播放 / 暂停") { if player?.isPlaying == true { player?.pause() } else { player?.play() } } }
        }.padding().navigationTitle("音乐试听").task {
            defer { busy = false }
            guard let token = staff.credentials?.token else { return }
            do {
                let data = try await staff.api.staffMusic(id: id, token: token)
                guard staff.credentials?.token == token else { return }
                player = try AVAudioPlayer(data: data); player?.prepareToPlay()
            } catch { self.error = error.localizedDescription }
        }.onDisappear { player?.stop(); player = nil }
    }
}
