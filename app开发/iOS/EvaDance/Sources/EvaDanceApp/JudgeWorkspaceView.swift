import SwiftUI
import EvaCore

struct JudgeWorkspaceView: View {
    @EnvironmentObject private var session: Session
    let eventID: String
    var groupID = ""
    var playerID = ""
    @State private var data: JSONValue = .null
    @State private var values: [String: String] = [:]
    @State private var busy = false
    @State private var saving = false
    @State private var error: String?
    @State private var confirmation = false
    @State private var query = ""
    @State private var page = 1
    @State private var scoreFilter = 0
    @State private var totalDraft = ""
    @FocusState private var totalFocused: Bool
    @State private var totalWeights: [Double] = []
    private var path: String { "/events/\(eventID)/judge" + (groupID.isEmpty ? "" : "?groupId=\(groupID)") + (playerID.isEmpty ? "" : "&playerId=\(playerID)") }
    private var locked: Bool { data["group"]["scoring_status"].text == "locked" }
    private var criteria: [JSONValue] { data["criteria"].list }
    private var total: Double { criteria.reduce(0) { $0 + (Double(values[$1["key"].text] ?? "") ?? 0) } }
    private var valid: Bool { !criteria.isEmpty && criteria.allSatisfy { row in
        guard let value = Double(values[row["key"].text] ?? ""), value.isFinite else { return false }
        return value >= 0 && value <= row["maxScore"].number
    } }
    var body: some View {
        AuthGate {
            List {
                if busy { ProgressView("正在加载评委工作台…") }
                if let error { Text(error).foregroundStyle(.red); Button("重新加载") { Task { await load() } }.disabled(busy || saving) }
                if data != .null {
                    Section {
                        Text(data["competition"]["name"].text).font(.title2.bold())
                        Text("评委：" + data["judge"]["name"].text).foregroundStyle(.secondary)
                        if !groupID.isEmpty { Text(data["group"]["name"].text) }
                    }
                    if playerID.isEmpty { assignmentList }
                    else { scoreForm }
                }
            }.listStyle(.insetGrouped).scrollContentBackground(.hidden).eventPage().evaPageChrome().navigationTitle("评委工作台").onChange(of:query) { _ in page=1 }.onChange(of:scoreFilter) { _ in page=1 }.onChange(of:totalFocused) { focused in if focused { totalWeights=criteria.map { Double(values[$0["key"].text] ?? "") ?? 0 };totalDraft=String(format:"%.2f",total) } }.onChange(of:totalDraft) { raw in if totalFocused { applyTotal(raw) } }
                .task(id: session.accountID) { await load() }
                .refreshable { if !saving { await load() } }
                .navigationBarBackButtonHidden(saving)
                .confirmationDialog("确认提交本人的评分？", isPresented: $confirmation, titleVisibility: .visible) {
                    Button("确认提交") { Task { await submit() } }
                    Button("取消", role: .cancel) {}
                } message: { Text(data["player"]["name"].text + " · 合计 " + String(format: "%.2f", total) + " 分") }
        }
    }
    private var assignmentList: some View {
        Section(groupID.isEmpty ? "获授权的评分组别" : "选手与本人评分") {
            TextField("搜索名称或选手号", text: $query)
            if !groupID.isEmpty {
                let all = data["players"].list
                let scored = all.filter { $0["my_score"] != .null }.count
                Text("评分进度 \(scored) / \(all.count)").font(.headline)
                ProgressView(value:Double(scored),total:Double(max(1,all.count))).tint(EvaBrand.red)
                Picker("评分状态",selection:$scoreFilter) { Text("全部").tag(0);Text("未评分").tag(1);Text("已评分").tag(2) }.pickerStyle(.segmented)
            }
            let rows = data[groupID.isEmpty ? "groups" : "players"].list.filter { groupID.isEmpty || scoreFilter == 0 || (scoreFilter == 1 ? $0["my_score"] == .null : $0["my_score"] != .null) }.filter { query.isEmpty || ($0["name"].text + " " + $0["player_no"].text).localizedCaseInsensitiveContains(query) }
            ForEach(Array(rows.dropFirst((min(page,max(1,Int(ceil(Double(rows.count)/20))))-1)*20).prefix(20).enumerated()), id: \.offset) { entry in
                let row = entry.element
                NavigationLink {
                    JudgeWorkspaceView(eventID: eventID, groupID: groupID.isEmpty ? row["id"].text : groupID, playerID: groupID.isEmpty ? "" : row["id"].text)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text([row["player_no"].text, row["name"].text].filter { !$0.isEmpty }.joined(separator: " · "))
                        if groupID.isEmpty { Text("已评分 \(row["scored_count"].text) / \(row["player_count"].text)").font(.caption).foregroundStyle(.secondary) }
                        else { Text(row["my_score"] == .null ? "未评分" : "本人评分：\(row["my_score"].text)").font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
            EventPages(page:$page,total:rows.count)
            if rows.isEmpty { Text("暂无可评分记录").foregroundStyle(.secondary) }
        }
    }
    private var scoreForm: some View {
        Section("选手：" + data["player"]["name"].text) {
            Text(data["player"]["performance_title"].text)
            if locked { Text("该组别评分已锁定，只能查看").foregroundStyle(.secondary) }
            if data["currentScore"]["needsRescore"].bool { Text("评分规则已变化，请按当前规则重新评分").foregroundStyle(.red) }
            Text("输入分数，或左右拖动调节").font(.subheadline).foregroundStyle(.secondary)
            ForEach(Array(criteria.enumerated()), id: \.offset) { entry in
                let row = entry.element
                VStack(alignment: .leading, spacing: 6) {
                    Text(row["name"].text + "（0–" + row["maxScore"].text + "分）")
                    TextField("请输入分数", text: Binding(get: { values[row["key"].text] ?? "" }, set: { totalFocused=false; values[row["key"].text] = $0 }))
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .registrationInput(border:Color.gray.opacity(0.25)).disabled(locked || saving)
                    Slider(value:Binding(get:{ min(row["maxScore"].number,max(0,Double(values[row["key"].text] ?? "") ?? 0)) },set:{ totalFocused=false;values[row["key"].text]=String(format:"%.2f",$0) }),in:0...max(0.01,row["maxScore"].number),step:0.01).tint(EvaBrand.red).disabled(locked || saving).accessibilityLabel(row["name"].text + "，拖动评分")
                }
            }
            VStack(alignment:.leading,spacing:10) {
                HStack { Text("总分（可修改）").font(.headline);TextField("总分",text:Binding(get:{ totalFocused ? totalDraft : String(format:"%.2f",total) },set:{ totalDraft=$0 }))
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                    .focused($totalFocused).multilineTextAlignment(.trailing).font(.title2.bold()).foregroundStyle(EvaBrand.red).disabled(locked || saving);Text("/ \(criteria.reduce(0) { $0 + $1["maxScore"].number },specifier:"%.0f")") }
                Text("修改总分，各项按比例分配").font(.subheadline).foregroundStyle(.secondary)
            }.padding(.vertical,12)
            Button(saving ? "正在提交…" : data["currentScore"]["status"].text.isEmpty ? "提交评分" : "修改本人评分") { confirmation = true }
                .buttonStyle(.borderedProminent).tint(EvaBrand.red).frame(minHeight:48).disabled(locked || busy || saving || !valid || (totalFocused && (Double(totalDraft) == nil || (Double(totalDraft) ?? -1) < 0 || (Double(totalDraft) ?? 11) > criteria.reduce(0) { $0 + $1["maxScore"].number })))
        }
    }
    private func applyTotal(_ raw:String) {
        let caps=criteria.map { Int(($0["maxScore"].number * 100).rounded()) }
        guard let n=Double(raw),n.isFinite,n>=0,n<=Double(caps.reduce(0,+))/100 else { return }
        let goal=Int((n*100).rounded())
        var weights=totalWeights.enumerated().map { i,v in min(Double(caps[i]),max(0,v*100)) }
        if !weights.contains(where: { $0>0 }) { weights=caps.map(Double.init) }
        var exact=Array(repeating:0.0,count:caps.count),remaining=Double(goal),active=caps.indices.filter { caps[$0]>0 }
        while !active.isEmpty && remaining>0.00000001 {
            var sum=active.reduce(0.0) { $0+weights[$1] }
            if sum<=0 { for i in active { weights[i]=Double(caps[i]) };sum=active.reduce(0.0) { $0+weights[$1] } }
            let saturated=active.filter { remaining*weights[$0]/sum>=Double(caps[$0]) }
            if saturated.isEmpty { for i in active { exact[i]=remaining*weights[i]/sum };break }
            for i in saturated { exact[i]=Double(caps[i]);remaining-=Double(caps[i]) }
            active.removeAll { saturated.contains($0) }
        }
        var cents=exact.map { Int(floor($0+0.00000001)) },left=goal-exact.map { Int(floor($0+0.00000001)) }.reduce(0,+)
        let order=caps.indices.filter { cents[$0]<caps[$0] }.sorted { a,b in let x=exact[a]-Double(cents[a]),y=exact[b]-Double(cents[b]);return x==y ? a<b : x>y }
        for i in order where left>0 { cents[i]+=1;left-=1 }
        for i in criteria.indices { values[criteria[i]["key"].text]=String(format:"%.2f",Double(cents[i])/100) }
    }
    @MainActor private func load() async {
        guard !busy, !saving, let token = session.token else { return }
        let account = session.credentials?.sessionId
        busy = true; error = nil; data = .null; values = [:]; totalFocused = false; totalDraft = ""; totalWeights = []
        defer { busy = false }
        do {
            let result: JSONValue = try await session.api.request(path, token: token)
            guard !Task.isCancelled, account == session.credentials?.sessionId else { return }
            data = result
            for item in criteria { let key = item["key"].text; if result["currentScore"]["values"][key] != .null { values[key] = result["currentScore"]["values"][key].text } }
        } catch { if account == session.credentials?.sessionId { self.error = error.localizedDescription; session.handle(error) } }
    }
    @MainActor private func submit() async {
        guard valid, !locked, !busy, !saving, let token = session.token else { return }
        let account = session.credentials?.sessionId
        saving = true; error = nil
        do {
            let scores = values.compactMapValues(Double.init)
            let _: JSONValue = try await session.api.request(path, token: token, method: "POST", body: JSONSerialization.data(withJSONObject: ["scores": scores]))
            guard account == session.credentials?.sessionId else { saving = false; return }
            saving = false; await load()
        } catch { saving = false; if account == session.credentials?.sessionId { self.error = error.localizedDescription; session.handle(error) } }
    }
}
