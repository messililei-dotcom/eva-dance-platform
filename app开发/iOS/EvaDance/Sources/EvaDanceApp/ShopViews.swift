import SwiftUI
import EvaCore

@MainActor final class ShoppingCart: ObservableObject {
    @Published var quantities: [String: Int] = [:]
    func add(_ product: JSONValue) {
        let id = product["id"].text
        let stock = min(99, Int(product["stock"].number))
        guard !id.isEmpty, stock > 0, quantities.count < 30 || quantities[id] != nil else { return }
        quantities[id] = min((quantities[id] ?? 0) + 1, stock)
    }
}
func money(_ fen: Double) -> String { String(format: "¥%.2f", fen / 100) }
struct ShopView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @EnvironmentObject var cart: ShoppingCart
    @State private var search = ""
    @State private var category = "全部"
    var products: [SiteRow] { store.data["products"].rows }
    var categories: [String] { ["全部"] + Set(products.map { $0.value["category"].text }.filter { !$0.isEmpty }).sorted() }
    var filtered: [SiteRow] { products.filter { (category == "全部" || $0.value["category"].text == category) && (search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search)) } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                BrandHeader(title: "伊娃甄选", subtitle: "东方舞生活 · 官方商城", icon: "bag")
                HStack {
                    NavigationLink("购物袋（\(cart.quantities.values.reduce(0,+))）") { CartView(cart: cart) }
                    Spacer()
                    NavigationLink("我的订单") { AuthGate { ShopOrdersView() } }
                }.buttonStyle(.bordered)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack { ForEach(categories, id: \.self) { item in
                        Button(item) { category = item }.buttonStyle(.bordered).tint(category == item ? EvaBrand.red : .secondary)
                    } }
                }
                LoadState(store: store) { Task { await load() } }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 14)], spacing: 16) {
                    ForEach(filtered) { row in NavigationLink { ProductView(product: row.value, cart: cart) } label: {
                        ProductTile(product: row.value)
                    }.buttonStyle(.plain) }
                }
                if !store.busy && store.error == nil && filtered.isEmpty { Text("暂无匹配商品") }
            }.padding(12)
        }.evaCompactLayout().navigationTitle("商城").searchable(text: $search, prompt: "搜索商品")
            .task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/shop/products", session: session, publicRead: true) }
}
struct ProductTile: View {
    let product: JSONValue
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                Rectangle().fill(EvaBrand.gold.opacity(0.12))
                if let url = AppPolicy.secureMediaURL(product["image"].text) {
                    AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { ProgressView() }
                } else { Text("伊娃甄选").foregroundStyle(EvaBrand.red).font(.headline) }
            }.frame(height: 140).clipped()
            VStack(alignment: .leading, spacing: 8) {
                Text(product["name"].text).font(.headline).lineLimit(2)
                Text(product["spec"].text).font(.caption).foregroundStyle(.secondary)
                Text(money(product["priceFen"].number)).font(.headline).foregroundStyle(EvaBrand.red)
                Text(product["stock"].number > 0 ? "有货" : "售罄").font(.caption).foregroundStyle(.secondary)
            }.padding(.horizontal, 12).padding(.bottom, 12)
        }.background(.background, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.secondary.opacity(0.15)))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
struct ProductCard: View {
    let product: JSONValue
    var body: some View {
        HStack(spacing: 12) {
            if let url = AppPolicy.secureMediaURL(product["image"].text) {
                AsyncImage(url: url) { image in image.resizable().scaledToFit() } placeholder: { Color.gray.opacity(0.1) }.frame(width: 90,height: 90).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(product["name"].text).font(.headline)
                Text([product["spec"].text,product["size"].text,product["color"].text].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline)
                Text(money(product["priceFen"].number)).foregroundStyle(.red)
                Text(product["stock"].number > 0 ? "库存 \(product["stock"].text)" : "暂时缺货").font(.caption).foregroundStyle(.secondary)
            }
        }.padding(.vertical,6)
    }
}
struct ProductView: View {
    let product: JSONValue
    @ObservedObject var cart: ShoppingCart
    @State private var added = false
    var body: some View {
        List {
            ProductCard(product: product)
            Text("实物商品，价格与库存以平台最终核验为准。")
            Button(added ? "已加入，可继续添加" : "加入购物清单") { cart.add(product); added = true }.disabled(product["stock"].number < 1)
            NavigationLink("查看购物清单") { CartView(cart: cart) }
        }.evaCompactLayout().navigationTitle(product["name"].text)
    }
}
struct CartView: View {
    @EnvironmentObject var session: Session
    @ObservedObject var cart: ShoppingCart
    @StateObject private var store = SiteStore()
    var products: [SiteRow] { store.data["products"].rows }
    var total: Int? {
        CartPolicy.total(cart.quantities.map { id, quantity in
            let p = products.first { $0.id == id }?.value ?? .null
            return CartLine(id:id,priceFen:Int(p["priceFen"].number),quantity:quantity,stock:Int(p["stock"].number))
        })
    }
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            ForEach(cart.quantities.keys.sorted(), id: \.self) { id in
                let product = products.first { $0.id == id }?.value ?? .null
                VStack(alignment: .leading,spacing: 8) {
                    Text(product["name"].text.isEmpty ? "商品已下架，请移除" : product["name"].text).font(.headline)
                    Stepper("数量 \(cart.quantities[id] ?? 0)", value: Binding(get:{cart.quantities[id] ?? 1},set:{cart.quantities[id]=$0}), in:1...99)
                    Button("移除", role:.destructive) { cart.quantities.removeValue(forKey:id) }
                }
            }
            if cart.quantities.isEmpty { Text("购物清单为空") }
            else if let total { LabeledContent("商品合计", value:money(Double(total))) }
            else { Text("部分商品库存或价格已变化，请刷新并调整清单。").foregroundStyle(.red) }
            NavigationLink("收货地址") { AuthGate { ShippingView() } }
            Section {
                if store.data["payment"]["ios"].bool {
                    NavigationLink("确认订单并付款") { AuthGate { ShopCheckoutView(cart: cart) } }
                        .disabled(total == nil || cart.quantities.isEmpty)
                } else { Text("当前版本暂未开放结算").foregroundStyle(.secondary) }
            }
        }.evaCompactLayout().navigationTitle("购物清单").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/shop/products",session:session,publicRead:true) }
}
struct ShippingView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var recipient = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var saved = false
    var valid: Bool { !recipient.trimmingCharacters(in:.whitespaces).isEmpty && phone.range(of:"^\\+?[0-9 -]{7,25}$",options:.regularExpression) != nil && address.trimmingCharacters(in:.whitespaces).count >= 8 }
    var body: some View {
        Form {
            TextField("收件人",text:$recipient); TextField("联系电话",text:$phone); TextField("省市区、街道及门牌",text:$address,axis:.vertical)
            Button("保存并同步地址") { Task {
                if await store.send("/shop/shipping",method:"PUT",body:["recipient":recipient,"phone":phone,"address":address],session:session) != nil { saved = true }
            } }.disabled(!valid || store.busy)
            if saved { Text("地址已保存").foregroundStyle(.green) }
            LoadState(store:store) { Task { await load() } }
        }.evaCompactLayout().navigationTitle("收货地址").task { await load() }
    }
    private func load() async {
        await store.load("/shop/shipping",session:session)
        if store.error == nil { let shipping = store.data["shipping"]; recipient=shipping["recipient"].text; phone=shipping["phone"].text; address=shipping["address"].text }
    }
}
struct ShopOrdersView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    var body: some View {
        List {
            LoadState(store:store) { Task { await load() } }
            ForEach(store.data["orders"].scopedRows("orders"), id: \.listID) { order in
                NavigationLink { ShopOrderDetail(id:order.id) } label: { VStack(alignment:.leading,spacing:8) {
                    Text(order.id).font(.caption)
                    Text("\(statusLabel(order.value["status"].text)) · \(money(order.value["totalFen"].number))").font(.headline)
                    Text(order.value["items"].list.map{$0.firstText("name","product_name")}.joined(separator:"、")).lineLimit(2)
                } }
            }
            if !store.busy && store.error == nil && store.data["orders"].list.isEmpty { Text("暂无商城订单") }
        }.evaCompactLayout().navigationTitle("商城订单").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/shop/orders",session:session) }
}
struct ShopOrderDetail: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    let id: String
    @State private var action = ""
    @State private var reason = ""
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    var order: JSONValue { store.data["order"] }
    var body: some View {
        List {
            LoadState(store:store) { Task { await load() } }
            Text(id).font(.caption)
            LabeledContent("状态",value:statusLabel(order["status"].text))
            LabeledContent("金额",value:money(order["totalFen"].number))
            Text("\(order["recipient"].text)  \(order["phone"].text)")
            Text(order["address"].text)
            if !order["trackingNo"].text.isEmpty { Text("\(order["carrier"].text) · \(order["trackingNo"].text)").textSelection(.enabled) }
            ForEach(order["items"].rows) { row in Text("\(row.value.firstText("name","product_name")) × \(row.value["quantity"].text)") }
            Button("刷新订单状态") { Task { if await store.send("/shop/orders/\(id)/refresh",session:session) != nil { await load() } } }.disabled(store.busy)
            if order["status"].text == "pending" {
                Button("继续付款") { Task {
                    guard let payment = await store.send("/shop/orders/\(id)/pay",session:session) else {return}
                    guard payment["kind"].text == "redirect", let url = AppPolicy.paymentURL(payment["url"].text) else {store.error="当前支付通道暂不可用";return}
                    openURL(url)
                } }.disabled(store.busy)
                Button("取消订单",role:.destructive) { action="cancel" }
            }
            if order["status"].text == "shipped" { Button("确认收货") { action="received" } }
            if ["paid","shipped","completed"].contains(order["status"].text) {
                TextField("退款原因",text:$reason,axis:.vertical)
                Button("申请退款") { action="refund" }.disabled(reason.trimmingCharacters(in:.whitespaces).isEmpty)
            }
        }.evaCompactLayout().navigationTitle("订单详情").task { await load() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { if await store.send("/shop/orders/\(id)/refresh",session:session) != nil { await load() } } }
        }
        .confirmationDialog("确认执行此订单操作？",isPresented:Binding(get:{!action.isEmpty},set:{if !$0 {action=""}})) {
            let selected=action
            Button("确认") { Task { if await store.send("/shop/orders/\(id)/\(selected)",body:["reason":reason],session:session) != nil { await load() } } }
        }
    }
    private func load() async { await store.load("/shop/orders/\(id)",session:session) }
}

struct ShopCheckoutView: View {
    @EnvironmentObject var session: Session
    @ObservedObject var cart: ShoppingCart
    @StateObject private var store = SiteStore()
    @Environment(\.openURL) private var openURL
    @State private var recipient = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var provider = "alipay"
    @State private var orderID = ""
    @State private var requestKey = UUID().uuidString
    @State private var fingerprint = ""
    @State private var submitting = false
    var body: some View {
        Form {
            TextField("收件人",text:$recipient)
            TextField("联系电话",text:$phone)
            TextField("详细收货地址",text:$address,axis:.vertical)
            Picker("支付方式",selection:$provider) {
                if store.data["payment"]["alipay"].bool { Text("支付宝").tag("alipay") }
                if store.data["payment"]["wechat"].bool { Text("微信支付").tag("wechat") }
            }
            Text("实物商品包邮，地址同步到个人中心。付款结果以订单状态为准。")
            if !orderID.isEmpty {
                NavigationLink("查看订单／继续付款") { ShopOrderDetail(id:orderID) }
            } else {
                Button("提交订单并付款") { Task { await submit() } }
                    .disabled(submitting || store.busy || cart.quantities.isEmpty || !store.data["payment"][provider].bool || recipient.isEmpty || phone.isEmpty || address.count < 8)
            }
            LoadState(store:store) { Task { await load() } }
        }.navigationTitle("确认订单").task { await load() }
    }
    private func load() async {
        await store.load("/shop/products",session:session,publicRead:true)
        if !store.data["payment"][provider].bool { provider = store.data["payment"]["alipay"].bool ? "alipay" : "wechat" }
        do {
            let data: JSONValue = try await session.api.request("/shop/shipping",token:session.token)
            recipient=data["shipping"]["recipient"].text;phone=data["shipping"]["phone"].text;address=data["shipping"]["address"].text
        } catch {store.error=error.localizedDescription}
    }
    private func submit() async {
        guard !submitting, orderID.isEmpty else {return};submitting=true;defer{submitting=false}
        let rows=store.data["products"].rows
        let lines=cart.quantities.map { id,q in let p=rows.first{$0.id==id}?.value ?? .null;return CartLine(id:id,priceFen:Int(p["priceFen"].number),quantity:q,stock:Int(p["stock"].number)) }
        guard let total=CartPolicy.total(lines) else {store.error="商品库存或价格已变化，请返回购物袋刷新";return}
        let items=cart.quantities.keys.sorted().map{["id":$0,"quantity":cart.quantities[$0]!] as [String:Any]}
        var body:[String:Any]=["recipient":recipient,"phone":phone,"address":address,"provider":provider,"items":items,"expectedTotalFen":total]
        let data=(try? JSONSerialization.data(withJSONObject:body,options:.sortedKeys)) ?? Data()
        let current=data.base64EncodedString()
        if current != fingerprint {fingerprint=current;requestKey=UUID().uuidString}
        body["requestKey"]=requestKey
        guard let created=await store.send("/shop/orders",body:body,session:session) else {return}
        orderID=created["order"]["id"].text
        guard !orderID.isEmpty else {store.error="请到我的订单确认下单结果";return}
        cart.quantities.removeAll()
        guard let payment=await store.send("/shop/orders/\(orderID)/pay",session:session) else {return}
        guard payment["kind"].text == "redirect",let url=AppPolicy.paymentURL(payment["url"].text) else {store.error="请在订单中重新尝试付款";return}
        openURL(url)
    }
}

struct OfflineCheckoutView: View {
    let courseID: String
    @EnvironmentObject var session: Session
    @Environment(\.openURL) private var openURL
    @StateObject private var store = SiteStore()
    @State private var provider = "alipay"
    @State private var requestKey = UUID().uuidString
    @State private var orderID = ""
    @State private var submitting = false
    var body: some View {
        Form {
            Text(store.data["offer"]["name"].text)
            Text(store.data["offer"]["period"].text)
            Text(String(format:"¥%.2f",store.data["offer"]["priceFen"].number / 100))
            Text("付款后开通所选期次的课次，可在个人中心预约上课。")
            Picker("支付方式",selection:$provider){
                if store.data["payment"]["alipay"].bool {Text("支付宝").tag("alipay")}
                if store.data["payment"]["wechat"].bool {Text("微信支付").tag("wechat")}
            }.onChange(of:provider){_ in requestKey=UUID().uuidString}
            if orderID.isEmpty {
                Button("报名并付款"){Task{await submit()}}.disabled(submitting || store.busy || !store.data["payment"][provider].bool)
            } else {NavigationLink("查看订单／继续付款"){ShopOrderDetail(id:orderID)}}
            LoadState(store:store){Task{await load()}}
        }.navigationTitle("确认课程订单").task{await load()}
    }
    private func load() async {
        await store.load("/shop/courses/offline/\(courseID)",session:session)
        if !store.data["payment"][provider].bool {provider=store.data["payment"]["alipay"].bool ? "alipay" : "wechat"}
    }
    private func submit() async {
        guard !submitting,orderID.isEmpty else{return};submitting=true;defer{submitting=false}
        let body:[String:Any]=["kind":"offline","targetId":courseID,"provider":provider,"expectedTotalFen":Int(store.data["offer"]["priceFen"].number),"requestKey":requestKey]
        guard let created=await store.send("/shop/orders",body:body,session:session) else{return}
        orderID=created["order"]["id"].text
        guard !orderID.isEmpty,let payment=await store.send("/shop/orders/\(orderID)/pay",session:session),payment["kind"].text=="redirect",let url=AppPolicy.paymentURL(payment["url"].text) else{return}
        openURL(url)
    }
}
