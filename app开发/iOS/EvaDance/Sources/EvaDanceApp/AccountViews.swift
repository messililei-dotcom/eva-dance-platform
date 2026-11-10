import SwiftUI
import EvaCore

struct AccountView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @StateObject private var courses = SiteStore()
    @StateObject private var artwork = SiteStore()
    @State private var logout = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                AccountHeaderView(notifications: session.notifications, profile: session.token == nil ? .null : store.data, ready: !store.busy && store.error == nil && store.data != .null)
                if session.token == nil {
                    Button("登录 / 注册") { session.showLogin = true }.buttonStyle(.borderedProminent)
                        .foregroundStyle(EvaBrand.onAccent).controlSize(.large).frame(maxWidth: .infinity, minHeight: 48)
                } else {
                    AccountSummaryView(profile: store.data, ready: !store.busy && store.error == nil)
                    Divider()
                    LoadState(store: store) { Task { await load() } }
                    NavigationLink { ProfileEditor() } label: { AccountServiceRow(title: "个人资料", subtitle: "姓名、手机号、生日和地址", icon: "person.crop.circle") }
                    Divider()
                    NavigationLink { MyCompetitionsView() } label: { AccountServiceRow(title: "我的比赛", subtitle: "报名、缴费与比赛结果", icon: "trophy") }
                    Divider()
                    NavigationLink { ShopOrdersView() } label: { AccountServiceRow(title: "我的订单", subtitle: "订单、到账与退款记录", icon: "bag") }
                    Divider()
                    Text("我的课程").font(.title3.bold()).padding(.top, 20).padding(.bottom, 4)
                    LoadState(store: courses) { Task { await load() } }
                    ForEach(courses.data.rows) { item in
                        if let id = Int(item.value["series_id"].text), id > 0 {
                            NavigationLink { CatalogByIDView(id: id, title: item.value["series_name"].text) } label: { AccountCourseRow(course: item.value, cover: artwork.data.list.first { Int($0["id"].text) == id }?["cover_image"].text ?? "") }
                            Divider()
                        }
                    }
                    if !courses.busy && courses.error == nil && courses.data.list.isEmpty {
                        Text("暂无已解锁课程").font(.subheadline).foregroundStyle(.secondary).padding(.vertical, 16)
                    }
                    NavigationLink { CoursesView() } label: { AccountServiceRow(title: "查看全部课程与学习记录", subtitle: "已解锁课程与学习进度", icon: "book") }
                    if AppPolicy.supportsOfflineDownload {
                        NavigationLink { CourseCacheView(cache: session.videoCache) } label: { AccountServiceRow(title: "课程缓存", subtitle: "查看离线课程", icon: "arrow.down.circle") }
                    }
                    Text("线下课与证书").font(.title3.bold()).padding(.top, 20)
                    NavigationLink { OfflineScheduleView() } label: { AccountServiceRow(title: "我的线下课程", subtitle: "课时余额、期次与核销记录", icon: "calendar") }
                    Divider()
                    NavigationLink { CertificatesView() } label: { AccountServiceRow(title: "我的证书", subtitle: "查看已颁发的学习证书", icon: "rosette") }
                    Text("学习服务").font(.title3.bold()).padding(.top, 20)
                    NavigationLink { StudyAssistantView() } label: { AccountServiceRow(title: "今日练习", subtitle: "学习计划与练习建议", icon: "figure.dance") }
                    NavigationLink { GrowthView() } label: { AccountServiceRow(title: "成长与每日打卡", subtitle: "记录每一次练习", icon: "chart.line.uptrend.xyaxis") }
                    NavigationLink { StudyItemsView(kind: "notes") } label: { AccountServiceRow(title: "学习笔记", subtitle: "回顾课程中的学习心得", icon: "square.and.pencil") }
                    NavigationLink { StudyItemsView(kind: "bookmarks") } label: { AccountServiceRow(title: "学习书签", subtitle: "快速找到标记过的课节", icon: "bookmark") }
                    Text("我的服务").font(.title3.bold()).padding(.top, 20)
                    NavigationLink { ShippingView() } label: { AccountServiceRow(title: "收货地址", subtitle: "管理商城收货信息", icon: "shippingbox") }
                    NavigationLink { RecordListView(title: "课程缴费记录", path: "/member/payments", fields: [("课程","courseName"),("金额","amount"),("剩余课次","remainingSessions"),("日期","date")]) } label: { AccountServiceRow(title: "课程缴费记录", subtitle: "查看已登记的缴费流水", icon: "doc.text") }
                    NavigationLink { RecordListView(title: "课次消耗记录", path: "/member/consume-records", fields: [("课程","courseName"),("课次","count"),("时间","consumeDate")]) } label: { AccountServiceRow(title: "课次消耗记录", subtitle: "查看上课与核销明细", icon: "checkmark.circle") }
                    Text("账号与隐私").font(.title3.bold()).padding(.top, 20)
                    NavigationLink { DevicesView() } label: { AccountServiceRow(title: "登录设备", subtitle: "查看与管理账号登录设备", icon: "iphone") }
                    NavigationLink { DeletionView() } label: { AccountServiceRow(title: "注销账号", subtitle: "申请注销与查看处理说明", icon: "person.crop.circle.badge.minus") }
                    Button("退出登录", role: .destructive) { logout = true }.frame(maxWidth: .infinity, minHeight: 48)
                }
                if !session.deletionReceipts.isEmpty {
                    Text("注销进度与结果").font(.title3.bold()).padding(.top, 20)
                    ForEach(session.deletionReceipts) { receipt in
                        NavigationLink { DeletionReceiptView(receipt: receipt) } label: { AccountServiceRow(title: "查看注销回执", subtitle: receipt.createdAt.formatted(date: .abbreviated, time: .shortened), icon: "doc.text.magnifyingglass") }
                    }
                }
                Text("客服与帮助").font(.title3.bold()).padding(.top, 20)
                NavigationLink { CourseSupportView() } label: { AccountServiceRow(title: "客服与售后", subtitle: "学习权限、课程与订单问题", icon: "bubble.left.and.bubble.right") }
                NavigationLink { StaffEventRootView() } label: { AccountServiceRow(title: "赛事管理工作台", subtitle: "工作人员入口", icon: "person.2") }
                NavigationLink { InformationView() } label: { AccountServiceRow(title: "关于 SWOD", subtitle: "帮助、品牌与隐私政策", icon: "info.circle") }
                Text("SWOD \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""))")
                    .font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.vertical, 20)
            }.buttonStyle(EvaPressStyle()).padding(.horizontal, 16).frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
        }.evaHomeLayout().evaPageChrome(root: true).task(id: session.accountID) { await load() }.refreshable { await load() }
        .confirmationDialog("确认退出当前账号？", isPresented: $logout) { Button("退出登录", role: .destructive) { session.logout() } }
    }
    private func load() async {
        courses.data = .null
        store.data = .null
        guard session.token != nil else { return }
        await store.load("/member/profile", session: session)
        await courses.load("/member/authorized-series", session: session)
        await artwork.load("/public/series", session: session, publicRead: true)
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
