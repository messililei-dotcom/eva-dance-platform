import SwiftUI
import EvaCore

struct AccountView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dynamicTypeSize) private var typeSize
    @StateObject private var store = SiteStore()
    @StateObject private var courses = SiteStore()
    @State private var logout = false
    @State private var coursesExpanded = true

    var body: some View {
        VStack(spacing: 0) {
            pageHeader
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    AccountHeaderView(notifications: session.notifications, profile: session.token == nil ? .null : store.data, ready: !store.busy && store.error == nil && store.data != .null)
                    if session.token == nil {
                        Button("登录 / 注册") { session.showLogin = true }
                            .buttonStyle(.borderedProminent).foregroundStyle(EvaBrand.onAccent)
                            .controlSize(.large).frame(maxWidth: .infinity, minHeight: 48)
                        sectionBreak
                        NavigationLink { CourseSupportView() } label: { serviceRow("客服与售后", icon: "bubble.left.and.bubble.right") }
                        NavigationLink { settings } label: { serviceRow("账号与隐私", icon: "gearshape") }
                    } else {
                        Divider()
                        AccountSummaryView(profile: store.data, ready: !store.busy && store.error == nil)
                        LoadState(store: store) { Task { await load() } }
                        sectionBreak
                        courseSection
                        sectionBreak
                        commonServices
                    }
                }.padding(.horizontal, 20).padding(.bottom, 16).frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
            }.refreshable { await load() }
        }.background(EvaBrand.surface).buttonStyle(EvaPressStyle()).evaPageChrome(root: true)
            .onAppear { coursesExpanded = true }.task(id: session.accountID) { await load() }
    }

    private var pageHeader: some View {
        HStack(spacing: 12) {
            Text("SWOD").font(.headline.bold()).foregroundStyle(EvaBrand.red).accessibilityHidden(true)
            Text("个人中心").font(.title2.bold()).frame(maxWidth: .infinity, alignment: .leading)
            if session.token != nil {
                NavigationLink { MessagesView() } label: {
                    Image(systemName: "bell").font(.title3).frame(width: 44, height: 44)
                        .overlay(alignment: .topTrailing) {
                            if session.notifications.unread > 0 { Circle().fill(EvaBrand.red).frame(width: 6, height: 6).padding(8) }
                        }
                }.accessibilityLabel("通知，\(session.notifications.unread)条未读")
            }
            NavigationLink { settings } label: { Image(systemName: "gearshape").font(.title3).frame(width: 44, height: 44) }
                .accessibilityLabel("账号与隐私设置")
        }.foregroundStyle(.primary).padding(.leading, 20).padding(.trailing, 8)
            .padding(.vertical, 4).frame(maxWidth: 760).frame(maxWidth: .infinity)
    }

    private var sectionBreak: some View {
        EvaBrand.field.frame(height: 8).padding(.horizontal, -20).padding(.vertical, 8)
    }

    private var courseSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("我的课程").font(.title3.bold())
                Spacer(minLength: 8)
                Button { coursesExpanded.toggle() } label: {
                    HStack(spacing: 6) {
                        Text(coursesExpanded ? "收起" : "展开")
                        Image(systemName: coursesExpanded ? "chevron.up" : "chevron.down").font(.caption)
                    }.font(.subheadline).foregroundStyle(.secondary).frame(minWidth: 64, minHeight: 44)
                }.accessibilityLabel(coursesExpanded ? "收起我的课程" : "展开我的课程")
                    .accessibilityValue(coursesExpanded ? "已展开" : "已收起")
                    .accessibilityIdentifier("account.courses.toggle")
            }
            if coursesExpanded {
                LoadState(store: courses) { Task { await load() } }
                ForEach(courses.data.rows) { item in
                    if let id = Int(item.value["series_id"].text), id > 0 {
                        NavigationLink { CatalogByIDView(id: id, title: item.value["series_name"].text) } label: {
                            AccountCourseRow(course: item.value, showsLearningAction: true)
                        }
                        Divider()
                    }
                }
                if !courses.busy && courses.error == nil && courses.data.list.isEmpty {
                    Text("暂无课程").font(.subheadline).foregroundStyle(.secondary).padding(.vertical, 20)
                }
            }
            NavigationLink { CoursesView() } label: { serviceRow("查看全部课程与学习记录") }
        }
    }

    private var commonServices: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("常用服务").font(.title3.bold()).padding(.vertical, 8)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: typeSize.isAccessibilitySize ? 1 : 2), alignment: .leading, spacing: 0) {
                NavigationLink { ShopOrdersView() } label: { serviceTile("我的订单", icon: "bag") }
                if AppPolicy.supportsOfflineDownload {
                    NavigationLink { CourseCacheView(cache: session.videoCache) } label: { serviceTile("离线观看", icon: "arrow.down.to.line") }
                }
                NavigationLink { StudyItemsView(kind: "notes") } label: { serviceTile("学习笔记", icon: "square.and.pencil") }
                NavigationLink { CourseSupportView() } label: { serviceTile("客服与售后", icon: "bubble.left.and.bubble.right") }
            }
            Divider()
            NavigationLink { settings } label: { serviceRow("账号与隐私") }
        }
    }

    private func serviceTile(_ title: String, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.title3).foregroundStyle(EvaBrand.red)
                .frame(width: 34, height: 34).background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 8)).accessibilityHidden(true)
            Text(title).font(.body).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }.frame(maxWidth: .infinity, minHeight: 64, alignment: .leading).contentShape(Rectangle())
    }

    private func serviceRow(_ title: String, icon: String = "") -> some View {
        AccountServiceRow(title: title, subtitle: "", icon: icon)
    }

    private var settings: some View {
        Form {
            if session.token != nil {
                Section("学习与服务") {
                    NavigationLink { ProfileEditor() } label: { Label("个人资料", systemImage: "person.crop.circle") }
                    NavigationLink { OfflineScheduleView() } label: { Label("我的线下课程", systemImage: "calendar") }
                    NavigationLink { CertificatesView() } label: { Label("我的证书", systemImage: "rosette") }
                    NavigationLink { StudyAssistantView() } label: { Label("今日练习", systemImage: "figure.dance") }
                    NavigationLink { GrowthView() } label: { Label("成长与每日打卡", systemImage: "chart.line.uptrend.xyaxis") }
                    NavigationLink { StudyItemsView(kind: "bookmarks") } label: { Label("学习书签", systemImage: "bookmark") }
                    NavigationLink { ShippingView() } label: { Label("收货地址", systemImage: "shippingbox") }
                    NavigationLink { RecordListView(title: "课程缴费记录", path: "/member/payments", fields: [("课程","courseName"),("金额","amount"),("剩余课次","remainingSessions"),("日期","date")]) } label: { Label("课程缴费记录", systemImage: "doc.text") }
                    NavigationLink { RecordListView(title: "课次消耗记录", path: "/member/consume-records", fields: [("课程","courseName"),("课次","count"),("时间","consumeDate")]) } label: { Label("课次消耗记录", systemImage: "checkmark.circle") }
                }
                Section("账号与隐私") {
                    NavigationLink { DevicesView() } label: { Label("登录设备", systemImage: "iphone") }
                    NavigationLink { DeletionView() } label: { Label("注销账号", systemImage: "person.crop.circle.badge.minus") }
                    Button("退出登录", role: .destructive) { logout = true }
                }
            }
            if !session.deletionReceipts.isEmpty {
                Section("注销进度与结果") {
                    ForEach(session.deletionReceipts) { receipt in
                        NavigationLink { DeletionReceiptView(receipt: receipt) } label: { Text("查看注销回执 · " + receipt.createdAt.formatted(date: .abbreviated, time: .shortened)) }
                    }
                }
            }
            Section("客服与帮助") {
                NavigationLink { CourseSupportView() } label: { Label("客服与售后", systemImage: "bubble.left.and.bubble.right") }
                NavigationLink { InformationView() } label: { Label("关于 SWOD", systemImage: "info.circle") }
                Text("SWOD \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""))").font(.footnote).foregroundStyle(.secondary)
            }
        }.evaPageChrome().navigationTitle("账号与隐私")
            .confirmationDialog("确认退出当前账号？", isPresented: $logout) { Button("退出登录", role: .destructive) { session.logout() } }
    }

    private func load() async {
        courses.data = .null
        store.data = .null
        guard session.token != nil else { return }
        await store.load("/member/profile", session: session)
        await courses.loadOwnedCourses(session: session)
    }
}
struct ProfileEditor: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var values: [String:String] = [:]
    @State private var saved = false
    private let fields = [("姓名","name"),("性别","gender"),("生日（YYYY-MM-DD）","birthday"),("国家","country"),("省份","province"),("城市","city"),("地址","address")]
    var body: some View {
        Form {
            ForEach(fields.indices,id:\.self) { i in TextField(fields[i].0,text:Binding(get:{values[fields[i].1] ?? ""},set:{values[fields[i].1]=$0;saved=false})) }
            Button("保存资料") { Task { if await store.send("/member/profile",method:"PUT",body:values,session:session) != nil { saved=true } } }.disabled(store.busy || (values["name"] ?? "").trimmingCharacters(in:.whitespaces).isEmpty)
            if saved { Text("资料已保存").foregroundStyle(.green) }
            LoadState(store:store) { Task { await load() } }
        }.evaCompactLayout().evaPageChrome().task { await load() }
    }
    private func load() async { await store.load("/member/profile",session:session); if store.error == nil { for (_,key) in fields {values[key]=store.data[key].text} } }
}
struct GrowthView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var checked = false
    var body: some View {
        List {
            LoadState(store:store) { Task { await load() } }
            Section("我的成长") {
                Text(store.data["growth"].firstText("level_display","levelName","level_name")).font(.title2.bold())
                LabeledContent("成长经验",value:store.data["growth"].firstText("experienceTotal","experience_total"))
                Button(checked ? "今日已打卡" : "今日练习打卡") { Task { if await store.send("/member/checkins",session:session) != nil {checked=true;await load()} } }.disabled(store.busy || checked)
            }
            Section("成长记录") { ForEach(store.data["ledger"].scopedRows("ledger"), id: \.listID) { row in VStack(alignment:.leading,spacing:6) {
                Text(row.value.firstText("description","title","reason","event_type"))
                Text("\(row.value.firstText("points_delta","points","experience")) · \(row.value.firstText("occurred_at","created_at","createdAt"))").foregroundStyle(.secondary)
            } } }
        }.evaCompactLayout().evaPageChrome().task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/member/growth",session:session) }
}
struct StudyItemsView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    let kind: String
    @State private var query = ""
    @State private var deletion: SiteRow?
    var body: some View {
        List {
            LoadState(store:store) { Task { await load() } }
            ForEach(store.data.rows.filter { PracticePlan.matches($0.value, query: query, fields: ["content","label","course_name","video_name"]) }) { row in VStack(alignment:.leading,spacing:8) {
                Text(row.value.firstText("course_name","video_name")).font(.headline)
                Text(row.value.firstText("content","label"))
                Text("视频位置 \(Int(row.value["timestamp_seconds"].number)) 秒").font(.caption).foregroundStyle(.secondary)
                HStack {
                    if let id=Int(row.value["video_id"].text) { NavigationLink("前往课节") { PlayerView(lessonID:id,title:row.value.firstText("course_name","video_name")) } }
                    Spacer(); Button("删除",role:.destructive) { deletion=row }
                }
            } }
            if !store.busy && store.error == nil && store.data.list.isEmpty { Text(kind == "notes" ? "暂无笔记，可在播放器中添加。" : "暂无收藏，可在播放器中添加。") }
        }.evaCompactLayout().evaPageChrome().searchable(text: $query, prompt: "搜索课节或内容").task { await load() }.refreshable { await load() }
        .confirmationDialog("确认删除这条记录？",isPresented:Binding(get:{deletion != nil},set:{if !$0 {deletion=nil}})) {
            if let row=deletion { Button("删除",role:.destructive) { Task { if await store.send("/\(kind)/\(row.id)",method:"DELETE",session:session) != nil {await load()} } } }
        }
    }
    private func load() async { await store.load("/\(kind)/all",session:session) }
}
struct LessonNoteView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) var dismiss
    @StateObject private var store=SiteStore()
    let lessonID: Int
    let timestamp: Double
    @State private var content=""
    @State private var bookmark=false
    var body: some View {
        NavigationStack { Form {
            Text("视频位置：\(Int(timestamp.isFinite ? max(timestamp,0) : 0)) 秒")
            Toggle("保存为收藏标记",isOn:$bookmark)
            TextField(bookmark ? "标记名称" : "学习笔记",text:$content,axis:.vertical).lineLimit(4...10)
            Button("保存") { Task {
                let body:[String:Any]=["video_id":lessonID,"timestamp_seconds":timestamp.isFinite ? max(timestamp,0) : 0,bookmark ? "label" : "content":content]
                if await store.send(bookmark ? "/bookmarks" : "/notes",body:body,session:session) != nil {dismiss()}
            } }.disabled(content.trimmingCharacters(in:.whitespaces).isEmpty || content.count>5000 || store.busy)
            if let error=store.error {Text(error).foregroundStyle(.red)}
        }.evaCompactLayout().evaPageChrome().toolbar {Button("关闭"){dismiss()}} }
    }
}
struct DevicesView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store=SiteStore()
    @State private var selected: SiteRow?
    var body: some View {
        List {
            LoadState(store:store) {Task{await load()}}
            ForEach(store.data.rows) {row in VStack(alignment:.leading,spacing:8) {
                Text(row.value["device_name"].text).font(.headline)
                Text(row.value["current"].bool ? "当前设备" : "其他登录设备").foregroundStyle(.secondary)
                Button("退出此设备",role:.destructive){selected=row}.disabled(store.busy)
            }}
        }.evaCompactLayout().evaPageChrome().task{await load()}
        .confirmationDialog("确认撤销此设备登录？",isPresented:Binding(get:{selected != nil},set:{if !$0 {selected=nil}})) {
            if let row=selected {Button("撤销登录",role:.destructive){Task{
                if await store.send("/devices/\(row.id)",method:"DELETE",session:session) != nil {if row.value["current"].bool{session.clear()}else{await load()}}
            }}}
        }
    }
    private func load() async {await store.load("/devices",session:session)}
}
struct DeletionView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store=SiteStore()
    @State private var code=""
    @State private var confirmation=""
    @State private var sent=false
    @State private var confirm=false
    var body: some View {
        Form {
            Text("注销的是与官网、小程序共用的平台账号。申请受理后将撤销登录，并在7个工作日内完成处理。账号及非必需个人资料会删除；依法须保留的交易、财务凭证仅在必要范围内受限保存。申请受理不代表数据已经删除。")
            Text("完成通知将发送到本机注销回执；退出后仍可从“我的 → 注销进度与结果”查看，无需登录。")
            Text("核验手机号：" + maskedPhone)
            Button(sent ? "验证码已发送" : "发送注销验证码") {Task{
                if await store.send("/send-code",body:["phone":store.data["phone"].text],session:session) != nil{sent=true}
            }}.disabled(store.busy || sent || store.data["phone"].text.isEmpty)
            TextField("短信验证码",text:$code).textContentType(.oneTimeCode)
            TextField("输入“注销账号”确认",text:$confirmation)
            Button("申请注销",role:.destructive){confirm=true}.disabled(code.count != 6 || confirmation != "注销账号" || store.busy)
            if let error=store.error{Text(error).foregroundStyle(.red)}
        }.evaCompactLayout().evaPageChrome().task{await store.load("/member/profile",session:session)}
        .confirmationDialog("确认发起账号注销？",isPresented:$confirm){Button("确认申请注销",role:.destructive){Task{
            do {
                let receipt = try session.prepareDeletionReceipt()
                if let result = await store.send("/account-deletion-requests", body: ["code": code, "confirmation": confirmation, "receiptToken": receipt.token], session: session) {
                    session.clear()
                    session.error = "注销申请已受理（\(result["id"].text)）。7个工作日内完成，请在“注销进度与结果”查看通知。"
                }
            } catch { store.error = error.localizedDescription }
        }}}
    }
    private var maskedPhone:String {let p=store.data["phone"].text;return p.count>=7 ? String(p.prefix(3))+"****"+String(p.suffix(4)) : "加载中"}
}
struct InformationView: View {
    var body: some View {
        List {
            Section("学习帮助") {
                Text("登录后，在“我的课程”查看已授权内容。课程权限、线下课次和已颁发证书与平台同步。")
                Text("播放异常时可重新加载；登录过期需重新验证手机号。网络中断期间的学习进度暂不能保证同步。")
            }
            Section("官网资讯") {
                Link("品牌介绍",destination:URL(string:"https://www.swod.com.cn/about")!)
                Link("东方舞圈",destination:URL(string:"https://www.swod.com.cn/dance-circle")!)
                Link("艺术节回顾",destination:URL(string:"https://www.swod.com.cn/festival")!)
                Link("联系我们",destination:URL(string:"https://www.swod.com.cn/contact")!)
            }
            Section("条款与隐私") {
                Link("隐私政策",destination:URL(string:"https://www.swod.com.cn/privacy")!)
                Link("服务条款",destination:URL(string:"https://www.swod.com.cn/terms")!)
                Text("这些链接在系统浏览器打开，不携带 App 登录令牌。")
            }
            if let filing = Bundle.main.object(forInfoDictionaryKey: "SWODAppFilingNumber") as? String {
                Section("App 备案") {
                    Text(filing).textSelection(.enabled)
                    Link("查询备案信息", destination: URL(string: "https://beian.miit.gov.cn/")!)
                }
            }
        }.evaCompactLayout().evaPageChrome()
    }
}

struct CourseSupportView: View {
    var body: some View {
        List {
            Section("课程、支付与售后") {
                Text("购买、学习权限和订单问题，请联系课程顾问。")
                Link("海艳老师 · 153 6787 0529", destination: URL(string: "tel:15367870529")!)
                Link("伊琳老师 · 193 1002 9982", destination: URL(string: "tel:19310029982")!)
                Link("查看微信客服二维码", destination: URL(string: "https://www.swod.com.cn/contact")!)
            }
        }.evaPageChrome()
    }
}
