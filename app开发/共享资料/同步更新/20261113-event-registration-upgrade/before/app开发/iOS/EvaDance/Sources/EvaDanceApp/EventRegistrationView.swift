import SwiftUI
import EvaCore
import UniformTypeIdentifiers

struct EventRegistrationView: View {
    @EnvironmentObject var session: Session
    let eventID: String
    let group: SiteRow?
    var playerID: String? = nil
    @Environment(\.colorScheme) private var colorScheme
    @State private var competition: JSONValue = .null
    @State private var groups: [JSONValue] = []
    @State private var selectedGroupID = ""
    @State private var groupQuery = ""
    @State private var formReady = false
    private var pageColor: Color { colorScheme == .dark ? EvaBrand.field : Color(red: 0.973, green: 0.953, blue: 0.918) }
    private var borderColor: Color { colorScheme == .dark ? Color.gray.opacity(0.45) : Color(red: 0.918, green: 0.875, blue: 0.808) }
    private var selectedGroup: JSONValue? { groups.first { $0["id"].text == selectedGroupID } }
    private var matchingGroups: [JSONValue] { groups.filter { row in groupQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || row["name"].text.localizedCaseInsensitiveContains(groupQuery.trimmingCharacters(in: .whitespacesAndNewlines)) } }
    @State private var countryCode = "+86"
    @State private var canEdit = false
    @State private var currentMusic = ""
    @State private var accountID: Int?
    @State private var name = ""
    @State private var phone = ""
    @State private var organization = ""
    @State private var teacher = ""
    @State private var performanceTitle = ""
    @State private var remark = ""
    @State private var musicName = ""
    @State private var music: Data?
    @State private var picker = false
    @State private var busy = false
    @State private var error: String?
    @State private var result = ""
    @State private var confirm = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                registrationHeader
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(playerID == nil ? "填写报名信息" : "修改报名 / 补交音乐").font(.title2.bold())
                        Text("带 * 为必填项").font(.subheadline).foregroundStyle(.secondary)
                        Divider().overlay(borderColor).padding(.top, 6)
                    }
                    if busy && !formReady { ProgressView("正在读取报名信息…") }
                    labeledField("参赛姓名 *", prompt: "支持中文、英文和空格", text: $name)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("手机号码 *").font(.headline)
                        ViewThatFits(in: .horizontal) { phoneFields; VStack(alignment: .leading, spacing: 10) { countryField; phoneField } }
                    }
                    labeledField("机构 / 舞蹈室", prompt: "选填", text: $organization)
                    labeledField("指导老师", prompt: "选填", text: $teacher)
                    if playerID == nil { groupFields }
                    else if !competition["groupName"].text.isEmpty { Text("参赛组别：" + competition["groupName"].text).foregroundStyle(.secondary) }
                    labeledField("节目（音乐）名字 *", prompt: "节目（音乐）名字", text: $performanceTitle)
                    musicFields
                    VStack(alignment: .leading, spacing: 10) {
                        Text("备注").font(.headline)
                        TextField("可填写参赛项目、作品或其他说明", text: $remark, axis: .vertical)
                            .lineLimit(5...8).frame(minHeight: 116, alignment: .topLeading).registrationInput(border: borderColor).accessibilityLabel("备注，选填")
                    }
                    if let error { Text(error).foregroundStyle(EvaBrand.red).accessibilityAddTraits(.isStaticText); if !formReady { Button("重新加载") { Task { await loadRegistration() } } } }
                    if !result.isEmpty { Text(result).foregroundStyle(.green); NavigationLink("前往个人中心查看报名与缴费") { MyCompetitionsView() } }
                }.padding(16).background(EvaBrand.surface).clipShape(EventRegistrationShape(top: false, bottom: true))
                    .overlay(alignment: .bottom) { EventRegistrationShape(top: false, bottom: true).stroke(borderColor, lineWidth: 1) }
                    .disabled(busy)
                VStack(spacing: 10) {
                    if playerID == nil {
                        Button(busy ? "正在提交…" : "提交赛事报名") { confirm = true }.buttonStyle(.borderedProminent).tint(EvaBrand.red).controlSize(.large).disabled(!valid || busy || !result.isEmpty || !formReady)
                        Text("同一赛事可报名多个组别。未付款可在个人中心继续缴费。").font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    } else {
                        Button("保存报名资料") { Task { await submit(detailsOnly: true) } }.buttonStyle(.borderedProminent).tint(EvaBrand.red).controlSize(.large).disabled(!valid || busy || !canEdit)
                        Button("上传音乐") { confirm = true }.buttonStyle(.bordered).controlSize(.large).disabled(music == nil || performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy || !canEdit)
                    }
                    if busy && formReady { ProgressView("正在处理…") }
                }.frame(maxWidth: .infinity).padding(.top, 16).padding(.bottom, 24)
            }.frame(maxWidth: 680).padding(.horizontal, 12).padding(.top, 10).frame(maxWidth: .infinity)
        }.scrollDismissesKeyboard(.interactively).background(pageColor).evaPageChrome().navigationTitle(playerID == nil ? "赛事报名" : "修改报名 / 补交音乐")
        .task(id: session.accountID) { await loadRegistration() }
        .fileImporter(isPresented: $picker, allowedContentTypes: [.audio, .data]) { selection in
            do {
                let url = try selection.get()
                let scope = url.startAccessingSecurityScopedResource(); defer { if scope { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size <= 10 * 1024 * 1024 else { throw APIError.service("音乐文件不能超过10MB") }
                let bytes = try Data(contentsOf: url)
                _ = try MultipartMusic(fields: [:], filename: url.lastPathComponent, music: bytes)
                music = bytes; musicName = url.lastPathComponent; error = nil
            } catch { self.error = error.localizedDescription }
        }
        .confirmationDialog(playerID == nil ? "确认提交报名？" : "确认上传参赛音乐？", isPresented: $confirm) {
            Button("确认提交") { Task { await submit() } }
        }
    }
    private var registrationHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("赛事报名").font(.caption.bold()).foregroundStyle(EvaBrand.gold).padding(.horizontal, 10).padding(.vertical, 5).background(EvaBrand.gold.opacity(0.12), in: Capsule()).overlay { Capsule().stroke(EvaBrand.gold.opacity(0.45), lineWidth: 1) }
            Text(playerID == nil ? (competition["name"].text.isEmpty ? "赛事报名" : competition["name"].text) : (competition["competitionName"].text.isEmpty ? "修改报名 / 补交音乐" : competition["competitionName"].text)).font(.title2.bold()).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            if playerID == nil { Text((competition.firstText("startDate", "start_date").isEmpty ? "比赛日期待定" : String(competition.firstText("startDate", "start_date").prefix(10))) + " · " + (competition.firstText("location", "venue", "city").isEmpty ? "地点待定" : competition.firstText("location", "venue", "city"))).font(.subheadline).foregroundStyle(.white.opacity(0.7)) }
        }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Color(white: 0.1)).clipShape(EventRegistrationShape(top: true, bottom: false))
    }
    private func labeledField(_ label: String, prompt: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 10) { Text(label).font(.headline); TextField(prompt, text: text).autocorrectionDisabled().registrationInput(border: borderColor).accessibilityLabel(label) }
    }
    private var phoneFields: some View { HStack(spacing: 10) { countryField.frame(width: 122); phoneField } }
    private var countryField: some View {
        HStack(spacing: 6) {
            Menu { ForEach(EventRegistrationCountries.items, id: \.code) { country in Button(country.flag + " " + country.name + " " + country.code) { countryCode = country.code } } } label: { Text(EventRegistrationCountries.items.first { $0.code == countryCode }?.flag ?? "🌐"); Image(systemName: "chevron.down").font(.caption) }.frame(minWidth: 36, minHeight: 44).accessibilityLabel("选择国家或地区区号")
            TextField("+86", text: $countryCode).keyboardType(.phonePad).accessibilityLabel("国家或地区区号").frame(minWidth: 44)
        }.padding(.horizontal, 10).frame(minHeight: 48).background(EvaBrand.surface).overlay { RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1) }
    }
    private var phoneField: some View { TextField("手机号码", text: $phone).keyboardType(.phonePad).registrationInput(border: borderColor).accessibilityLabel("手机号码，必填") }
    private var groupFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("参赛组别 *").font(.headline)
            TextField("搜索组别、舞种或年龄", text: $groupQuery).registrationInput(border: borderColor).accessibilityLabel("搜索参赛组别、舞种或年龄")
            Menu {
                ForEach(JSONValue.array(matchingGroups).rows) { row in Button(row.value["name"].text) { selectedGroupID = row.id } }
            } label: {
                HStack { Text(selectedGroup?["name"].text ?? "请选择组别").multilineTextAlignment(.leading); Spacer(); Image(systemName: "chevron.right") }.frame(maxWidth: .infinity, minHeight: 24).registrationInput(border: borderColor)
            }.foregroundStyle(selectedGroup == nil ? Color.secondary : Color.primary).disabled(matchingGroups.isEmpty).accessibilityLabel("参赛组别：" + (selectedGroup?["name"].text ?? "请选择组别"))
            if matchingGroups.isEmpty && formReady { Text(groups.isEmpty ? "暂无可报名组别" : "未找到匹配组别，请修改搜索内容").font(.subheadline).foregroundStyle(.secondary) }
            if let selectedGroup { Text("本组别报名费 ¥" + selectedGroup["registrationFee"].text).font(.subheadline).foregroundStyle(EvaBrand.red) }
        }
    }
    private var musicFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("上传音乐（选填）").font(.headline)
            Text("可先报名，之后在个人中心补交或更换音乐。").font(.subheadline).foregroundStyle(.secondary)
            Button("选择音乐文件") { picker = true }.buttonStyle(.borderedProminent).tint(EvaBrand.red).controlSize(.large).frame(maxWidth: .infinity).disabled(busy)
            Text("从系统文件中选择。支持 MP3、WAV、M4A、AAC、FLAC，最大10MB。").font(.subheadline).foregroundStyle(.secondary)
            if !currentMusic.isEmpty { Text("当前音乐：" + currentMusic).font(.subheadline).foregroundStyle(.secondary) }
            Text(musicName.isEmpty ? "尚未选择音乐文件" : musicName).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            if music != nil { Button("移除所选音乐") { music = nil; musicName = "" }.frame(minHeight: 44) }
            Divider().overlay(borderColor)
        }
    }
    private var valid: Bool {
        (playerID != nil || selectedGroup != nil) && name.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count <= 120 && performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count <= 120 && remark.utf16.count <= 500 && [name, phone, performanceTitle].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    private var registrationPath: String? {
        guard let playerID, let id = Int(playerID), id > 0 else { return nil }
        return "/member/event-registrations/\(id)"
    }
    private func loadRegistration() async {
        let account = session.accountID
        if accountID != account {
            formReady = false; groups = []; competition = .null; selectedGroupID = ""; groupQuery = ""
            name = ""; phone = ""; countryCode = "+86"; organization = ""; teacher = ""
            performanceTitle = ""; remark = ""; musicName = ""; music = nil; currentMusic = ""
            result = ""; error = nil; canEdit = false
        }
        accountID = account
        guard let token = session.token else { return }
        if playerID == nil {
            busy = true; formReady = false; defer { busy = false }
            do {
                let detail: JSONValue = try await session.api.request("/events/\(eventID)")
                guard account == session.accountID, !Task.isCancelled else { return }
                competition = detail["competition"]; groups = detail["groups"].list
                if selectedGroupID.isEmpty { selectedGroupID = group?.id ?? "" }
                if !groups.contains(where: { $0["id"].text == selectedGroupID }) { selectedGroupID = "" }
                let profile: JSONValue = try await session.api.request("/member/profile", token: token)
                guard account == session.accountID, !Task.isCancelled else { return }
                let member = profile["member"] == .null ? profile : profile["member"]
                if name.isEmpty { name = member["name"].text }; if phone.isEmpty { phone = member["phone"].text }
                formReady = true; error = nil
            } catch { guard account == session.accountID else { return }; self.error = error.localizedDescription }
            return
        }
        guard let path = registrationPath else { return }
        busy = true; canEdit = false; defer { busy = false }
        do {
            let details: JSONValue = try await session.api.request(path, token: token)
            guard account == session.accountID, !Task.isCancelled else { return }
            let audio: JSONValue = try await session.api.request(path + "/music", token: token)
            guard account == session.accountID, !Task.isCancelled else { return }
            name = details["name"].text; phone = details["phone"].text
            countryCode = details["countryCode"].text.isEmpty ? "+86" : details["countryCode"].text
            organization = details["organization"].text; teacher = details["teacher"].text
            performanceTitle = details["performanceTitle"].text; remark = details["remark"].text
            currentMusic = audio["fileName"].text
            competition = details; formReady = true
            canEdit = details["canEdit"].bool == true
        } catch { self.error = error.localizedDescription }
    }
    private func submit(detailsOnly: Bool = false) async {
        guard !busy, accountID == session.accountID, let token = session.token else { return }
        let account = session.accountID
        busy = true; error = nil; result = ""; defer { busy = false }
        do {
            let fields = ["name": name.trimmingCharacters(in: .whitespacesAndNewlines), "phone": phone, "countryCode": countryCode, "organization": organization, "teacher": teacher, "performanceTitle": performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines), "remark": remark]
            if let path = registrationPath, canEdit {
                if detailsOnly {
                    let _: JSONValue = try await session.api.request(path, token: token, method: "PUT", body: JSONEncoder().encode(fields))
                    guard account == session.accountID else { return }
                    result = "报名资料已保存。"
                } else if let music {
                    let form = try MultipartMusic(fields: ["performanceTitle": fields["performanceTitle"] ?? ""], filename: musicName, music: music)
                    let updated: JSONValue = try await session.api.request(path + "/music", token: token, method: "POST", body: form.body, contentType: form.contentType)
                    guard account == session.accountID else { return }
                    currentMusic = updated["fileName"].text
                    self.music = nil; musicName = ""; result = "音乐已更新。"
                }
            } else if let selectedGroup, valid, formReady {
                var registration = fields; registration["groupId"] = selectedGroup["id"].text
                if let music {
                    let form = try MultipartMusic(fields: registration, filename: musicName, music: music)
                    let _: JSONValue = try await session.api.request("/events/\(eventID)/register", token: token, method: "POST", body: form.body, contentType: form.contentType)
                } else {
                    let _: JSONValue = try await session.api.request("/events/\(eventID)/register", token: token, method: "POST", body: JSONEncoder().encode(registration))
                }
                guard account == session.accountID else { return }
                result = "报名已提交，可在个人中心查看进度、继续缴费、补交或更换音乐。"
                self.music = nil; musicName = ""
            }
        } catch {
            guard account == session.accountID else { return }
            self.error = error.localizedDescription
            if case APIError.sessionExpired = error { session.handle(error) }
        }
    }
}
