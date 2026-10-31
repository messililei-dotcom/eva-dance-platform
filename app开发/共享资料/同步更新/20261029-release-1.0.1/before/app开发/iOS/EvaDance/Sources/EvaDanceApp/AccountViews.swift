import SwiftUI
import EvaCore

struct AccountView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @StateObject private var courses = SiteStore()
    @State private var logout = false
    var body: some View {
        List {
            if session.token == nil {
                Section {
                    BrandHeader(title: "欢迎来到伊娃东方舞", subtitle: "登录后同步课程、比赛、证书与订单", icon: "person.crop.circle")
                    Button("登录 / 注册") { session.showLogin = true }.buttonStyle(.borderedProminent).foregroundStyle(EvaBrand.onAccent).controlSize(.large).frame(maxWidth: .infinity, minHeight: 48)
                }
            } else {
                Section {
                    BrandHeader(title: store.data["name"].text.isEmpty ? "我的学习空间" : store.data["name"].text, subtitle: "个人中心 · 与小程序共用学习账号", icon: "person.crop.circle")
                    Text("已授权 \(store.data["stats"]["authorized_count"].text) 门 · 已完成 \(store.data["stats"]["completed_count"].text) 节").foregroundStyle(.secondary)
                    LoadState(store: store) { Task { await load() } }
                    NavigationLink("编辑个人资料") { ProfileEditor() }
                }
                Section("我的比赛与订单") {
                    NavigationLink("我的比赛 · 报名与成绩") { MyCompetitionsView() }
                    NavigationLink("我的订单") { ShopOrdersView() }
                }
                Section("我的课程") {
                    NavigationLink("课程缓存 · 离线观看") { CourseCacheView(cache: session.videoCache) }
                    LoadState(store: courses) { Task { await load() } }
                    ForEach(courses.data.rows) { item in
                        if let id = Int(item.value["series_id"].text), id > 0 {
                            NavigationLink { CatalogByIDView(id: id, title: item.value["series_name"].text) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(item.value["series_name"].text).font(.headline)
                                    Text("✓ 已解锁").font(.caption).foregroundStyle(.green)
                                    Text("继续学习").font(.subheadline).foregroundStyle(.green)
                                }.padding(.vertical, 6)
                            }
                        }
                    }
                    if !courses.busy && courses.error == nil && courses.data.list.isEmpty { Text("暂无已解锁课程").foregroundStyle(.secondary) }
                    NavigationLink("查看全部课程与学习记录") { CoursesView() }
                }
                Section("线下课与证书") {
                    NavigationLink("我的线下课 · 课时与核销") { OfflineScheduleView() }
                    NavigationLink("我的证书") { CertificatesView() }
                }
                Section("更多学习服务") {
                    NavigationLink("今日练习 · 智能学习助手") { StudyAssistantView() }
                    NavigationLink("学习消息") { MessagesView() }
                    NavigationLink("成长与每日打卡") { GrowthView() }
                    NavigationLink("学习笔记") { StudyItemsView(kind: "notes") }
                    NavigationLink("视频收藏") { StudyItemsView(kind: "bookmarks") }
                }
                Section("我的服务") {
                    NavigationLink("收货地址") { ShippingView() }
                    NavigationLink("课程缴费记录") { RecordListView(title:"课程缴费记录",path:"/member/payments",fields:[("课程","courseName"),("金额","amount"),("剩余课次","remainingSessions"),("日期","date")]) }
                    NavigationLink("课次消耗记录") { RecordListView(title:"课次消耗记录",path:"/member/consume-records",fields:[("课程","courseName"),("课次","count"),("时间","consumeDate")]) }
                }
                Section("账号与隐私") {
                    NavigationLink("登录设备") { DevicesView() }
                    NavigationLink("注销账号") { DeletionView() }
                    Button("退出登录",role:.destructive) { logout = true }
                }
            }
            if !session.deletionReceipts.isEmpty {
                Section("注销进度与结果") {
                    ForEach(session.deletionReceipts) { receipt in
                        NavigationLink { DeletionReceiptView(receipt: receipt) } label: {
                            VStack(alignment: .leading) {
                                Text("查看注销回执")
                                Text(receipt.createdAt, format: .dateTime).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Section("工作人员") { NavigationLink("赛事管理工作台") { StaffEventRootView() } }
            Section("关于") {
                NavigationLink("客服与售后") { CourseSupportView() }
                NavigationLink("帮助、品牌与隐私") { InformationView() }
                Text("SWOD \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "") (\(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""))")
            }
        }.evaCompactLayout().evaHomeLayout().evaPageChrome(root: true).task(id:session.accountID) { await load() }.refreshable { await load() }
        .confirmationDialog("确认退出当前账号？",isPresented:$logout) { Button("退出登录",role:.destructive) { session.logout() } }
    }
    private func load() async {
        guard session.token != nil else { courses.data = .null; return }
        courses.data = .null
        await store.load("/member/profile",session:session)
        await courses.load("/member/authorized-series",session:session)
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
