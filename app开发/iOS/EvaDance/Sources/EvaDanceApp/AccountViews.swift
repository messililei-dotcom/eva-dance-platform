import SwiftUI
import EvaCore

struct AccountView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var logout = false
    var body: some View {
        List {
            if session.token == nil {
                Section { Text("欢迎来到伊娃东方舞").font(.title2.bold()); Button("登录 / 注册") { session.showLogin = true } }
            } else {
                Section {
                    BrandHeader(title: store.data["name"].text.isEmpty ? "我的学习空间" : store.data["name"].text, subtitle: "个人中心 · 与小程序共用学习账号", icon: "person.crop.circle")
                    Text("已授权 \(store.data["stats"]["authorized_count"].text) 门 · 已完成 \(store.data["stats"]["completed_count"].text) 节").foregroundStyle(.secondary)
                    LoadState(store: store) { Task { await load() } }
                    NavigationLink("编辑个人资料") { ProfileEditor() }
                }
                Section("我的学习") {
                    NavigationLink("今日练习 · 智能学习助手") { StudyAssistantView() }
                    NavigationLink("课程与学习记录") { CoursesView() }
                    NavigationLink("学习消息") { MessagesView() }
                    NavigationLink("成长与每日打卡") { GrowthView() }
                    NavigationLink("学习笔记") { StudyItemsView(kind: "notes") }
                    NavigationLink("视频收藏") { StudyItemsView(kind: "bookmarks") }
                    NavigationLink("我的证书") { CertificatesView() }
                }
                Section("我的服务") {
                    NavigationLink("线下预约与签到") { OfflineScheduleView() }
                    NavigationLink("报名与成绩") { RecordListView(title:"赛事记录",path:"/member/events",collectionKey:"entries",fields:[("赛事","competitionName"),("组别","groupName"),("审核","auditStatus"),("成绩","totalScore")]) }
                    NavigationLink("商城订单") { ShopOrdersView() }
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
            Section("关于") { NavigationLink("帮助、品牌与隐私") { InformationView() }; Text("伊娃东方舞 1.0.0 (2)") }
        }.evaCompactLayout().navigationTitle("个人中心").task(id:session.accountID) { await load() }.refreshable { await load() }
        .confirmationDialog("确认退出当前账号？",isPresented:$logout) { Button("退出登录",role:.destructive) { session.logout() } }
    }
    private func load() async { if session.token != nil { await store.load("/member/profile",session:session) } }
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
        }.evaCompactLayout().navigationTitle("编辑资料").task { await load() }
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
        }.evaCompactLayout().navigationTitle("成长与打卡").task { await load() }.refreshable { await load() }
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
        }.evaCompactLayout().navigationTitle(kind == "notes" ? "学习笔记" : "视频收藏").searchable(text: $query, prompt: "搜索课节或内容").task { await load() }.refreshable { await load() }
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
        }.evaCompactLayout().navigationTitle("记录练习").toolbar {Button("关闭"){dismiss()}} }
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
        }.evaCompactLayout().navigationTitle("登录设备").task{await load()}
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
            Text("提交注销申请后，App 登录会话将撤销。平台需要处理关联课程、订单和依法保留记录；申请受理不代表数据已经删除。")
            Text("核验手机号：" + maskedPhone)
            Button(sent ? "验证码已发送" : "发送注销验证码") {Task{
                if await store.send("/send-code",body:["phone":store.data["phone"].text],session:session) != nil{sent=true}
            }}.disabled(store.busy || sent || store.data["phone"].text.isEmpty)
            TextField("短信验证码",text:$code).textContentType(.oneTimeCode)
            TextField("输入“注销账号”确认",text:$confirmation)
            Button("申请注销",role:.destructive){confirm=true}.disabled(code.count != 6 || confirmation != "注销账号" || store.busy)
            if let error=store.error{Text(error).foregroundStyle(.red)}
        }.evaCompactLayout().navigationTitle("注销账号").task{await store.load("/member/profile",session:session)}
        .confirmationDialog("确认发起账号注销？",isPresented:$confirm){Button("确认申请注销",role:.destructive){Task{
            if let result=await store.send("/account-deletion-requests",body:["code":code,"confirmation":confirmation],session:session){
                session.clear();session.error="注销申请已受理（\(result["id"].text)），状态：待处理。"
            }
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
        }.evaCompactLayout().navigationTitle("帮助与关于")
    }
}
