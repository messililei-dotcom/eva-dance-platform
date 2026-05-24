# dongfangwuquan 统一平台架构分析报告

制定日期：2026-05-22

主域名：

```text
www.dongfangwuquan.com
```

正式域名体系：

```text
www.dongfangwuquan.com      官网
admin.dongfangwuquan.com    唯一管理后台
learn.dongfangwuquan.com    学员学习中心
api.dongfangwuquan.com      统一 API 网关
auth.dongfangwuquan.com     统一认证中心
static.dongfangwuquan.com   静态资源 / CDN
miniapi.dongfangwuquan.com  小程序 API
```

## 一、当前目录结构

当前工作空间不是一个统一平台仓库，而是多个业务系统并列存在：

```text
伊娃东方舞-开发工程/
├── 01-升级开发计划方案/
├── 02-官方网站工程设计/官方网站/
├── 03-学员管理系统/学员管理系统/
├── 04-网课系统开发计划/
├── 05-终极整合平台方案/
├── 06-系统架构与数据融合升级方案/
├── 07-电商系统/
├── 08-客服系统/
└── 09-财务系统/
```

现状判断：

- 官网、学员系统、网课系统、电商系统、财务系统已经分别形成可运行工程。
- 业务数据核心已经部分向 `03-学员管理系统/学员管理系统/server/dance.db` 靠拢。
- 电商系统仍然使用 JSON 文件存储。
- 多个系统存在独立登录页、独立 Token、独立管理入口，不符合正式方案要求。

## 二、前端项目数量

当前可识别前端项目共 5 类：

| 项目 | 位置 | 技术 | 现状定位 |
|---|---|---|---|
| 官网 | `02-官方网站工程设计/官方网站` | Next.js 14 / React / TypeScript / Tailwind | 保留为 `official-website` |
| 学员管理后台 | `03-学员管理系统/学员管理系统/index.html` | 原生 HTML/CSS/JS | Phase 1 临时承载统一后台 |
| 学员端 H5 | `03-学员管理系统/学员管理系统/student.html` 等 | 原生 HTML/CSS/JS | 迁移到 `learn.dongfangwuquan.com` |
| 网课后台 / 学员端 | `04-网课系统开发计划/admin`、`student`、`miniprogram` | 原生 HTML/CSS/JS / 微信小程序 | 并入课程模块与学习中心 |
| 电商后台 | `07-电商系统/public` | 原生 HTML/CSS/JS | 并入 `admin.dongfangwuquan.com/shop` |
| 财务后台 | `09-财务系统/public` | 原生 HTML/CSS/JS | 并入 `admin.dongfangwuquan.com/finance` |

结论：

- 正式形态应收敛为 3 个前端应用：`official-website`、`admin-platform`、`student-platform`。
- 现有原生后台不建议继续横向扩张，应作为 Phase 1 过渡承载，随后用统一后台工程吸收。

## 三、后端项目数量

当前可识别后端项目共 4 个：

| 项目 | 位置 | 技术 | 数据源 |
|---|---|---|---|
| 学员管理服务 | `03-学员管理系统/学员管理系统/server` | Express + better-sqlite3 | `server/dance.db` |
| 网课服务 | `04-网课系统开发计划/server.js` | Express + better-sqlite3 | 优先复用学员系统 `dance.db` |
| 电商服务 | `07-电商系统/server.js` | Node http | `data/inventory-store.json` |
| 财务服务 | `09-财务系统/server.js` | Node http + better-sqlite3 | 复用学员系统 `dance.db`，读取电商 JSON |

结论：

- 当前不是标准 API 网关架构，而是多个服务各自暴露接口。
- 学员系统事实上已经成为数据中台雏形。
- 后续应先用反向代理和路由分发形成 `api.dongfangwuquan.com`，再逐步拆为 NestJS 服务。

## 四、数据库结构

当前主数据库：

```text
03-学员管理系统/学员管理系统/server/dance.db
```

当前主库表：

```text
AdminUser
Certificate
CommissionRecord
ConsumeRecord
Course
CourseAuthorization
CourseOrder
CourseSeries
CourseSession
CourseTemplate
CourseVideo
DistributionRelation
FinanceAccount
FinanceAttachment
FinanceCommission
FinanceExpense
FinanceIncome
FinanceOrder
Material
MaterialFolder
Member
OnlineCourse
OperationLog
Payment
User
VideoProgress
```

关键数据量：

```text
Member              271
User                4
Course              30
Payment             36
ConsumeRecord       24
CourseSeries        8
OnlineCourse        0
CourseVideo         0
CourseAuthorization 0
CourseOrder         0
FinanceIncome       0
FinanceExpense      0
FinanceOrder        0
```

电商数据：

```text
07-电商系统/data/inventory-store.json
products   8
sales      0
stockLogs  8
```

结论：

- `Member` 已经可以作为统一会员主表的现有基础。
- `Payment` 是线下缴费/核销记录，不应直接承担全平台订单中心。
- `CourseOrder` 已存在但未真正启用，可作为统一订单迁移的过渡表之一。
- 财务表已经创建，但尚未形成财务业务流水。
- 电商必须从 JSON 迁移到统一数据库，否则无法形成统一订单、库存和财务闭环。

## 五、用户体系

现有体系：

```text
User       后台管理员 / 店长 / 教师
AdminUser  网课管理员
Member     学员 / 前台用户
电商 ADMINS 环境变量
财务 ADMINS 环境变量
```

问题：

- 后台人员身份被拆散在 `User`、`AdminUser`、环境变量账号里。
- 学员登录和管理员登录都已有 JWT，但不是统一认证中心。
- 电商、财务的 Token 是自签 HMAC，不是统一 JWT。

正式方案：

```text
admin_users
roles
permissions
role_permissions
admin_user_roles
members
member_profiles
member_logs
refresh_tokens
```

Phase 1 建议：

- 以 `User` 表为后台人员来源，合并 `AdminUser`、电商/财务环境变量账号。
- 所有后台登录统一走 `admin.dongfangwuquan.com/login`。
- 学员登录统一走 `learn.dongfangwuquan.com/login` 或 `auth.dongfangwuquan.com`。

## 六、权限体系

现有权限：

```text
User.role = admin / manager / teacher
User.permCourseView / Create / Edit / Delete
User.permMemberView / Create / Edit / Delete
User.permPaymentView / Create / Edit / Delete
User.permConsumeView / Create / Edit / Delete
User.permLogView
```

问题：

- 权限是字段式权限，不适合扩展到电商、财务、CRM、营销、赛事。
- 网课、电商、财务各自维护权限或只做管理员判断。

正式权限模型：

```text
permission.code

member.view
member.manage
order.view
order.manage
course.manage
live.manage
training.manage
masterclass.manage
event.manage
competition.manage
shop.manage
inventory.manage
shipping.manage
aftersales.manage
finance.view
finance.manage
crm.manage
marketing.manage
analytics.view
cms.manage
system.settings
permission.manage
```

角色建议：

```text
super_admin
principal
operations
academic
finance
commerce
support
warehouse
content_editor
competition_manager
teacher
```

## 七、订单体系

现有订单/交易相关表：

```text
Payment        线下课程缴费与剩余课次
CourseOrder    网课订单，已建表但无数据
FinanceOrder   财务订单，已建表但无数据
电商 sales      JSON 销售流水
```

问题：

- 没有真正的统一 `orders` 和 `order_items`。
- 电商销售没有进入数据库，无法与会员、财务、库存打通。
- 财务目前是汇总读取多个来源，不是订单中心驱动。

正式统一订单模型：

```text
orders
order_items
payments
payment_logs
refunds
invoices
```

订单类型：

```text
course
live
training
masterclass
event
competition
shop
membership
```

Phase 1 迁移策略：

- 保留 `Payment` 作为线下缴费历史源。
- 新建统一 `orders`，逐步把 `Payment`、`CourseOrder`、电商 `sales` 映射为订单。
- 财务系统只读统一订单中心和财务流水，不再直接拼多个来源。

## 八、课程体系

现有课程相关表：

```text
Course          线下课程 / 部分线上字段混入
CourseSeries    网课专栏
OnlineCourse    网课课节
CourseVideo     视频绑定
Material         素材
VideoProgress   播放进度
CourseAuthorization 授权
```

可复用：

- `Course` 的线下课程字段完整度较高。
- `CourseSeries`、`OnlineCourse`、`CourseVideo`、`Material` 已经具备网课骨架。
- `VideoProgress` 已经能承载学习进度。

必须调整：

- `Course` 里混入了网课字段，后续应拆清 `courses`、`course_chapters`、`course_lessons`。
- 直播、线下培训、大师课、活动、赛事需要统一为课程/活动资源模型，而不是新建孤立系统。

## 九、财务体系

现有财务：

```text
FinanceIncome
FinanceExpense
FinanceAccount
FinanceOrder
FinanceCommission
FinanceAttachment
```

问题：

- 财务服务独立登录。
- 财务汇总依赖 `Payment`、`CourseOrder`、电商 JSON。
- 缺少统一结算、退款、发票、对账标准。

正式方向：

```text
finance_transactions
income_records
expense_records
settlements
withdrawals
refunds
invoices
```

Phase 1：

- 财务入口并入 `admin.dongfangwuquan.com/finance`。
- 财务数据源改为统一订单中心 + 财务手工流水。

## 十、电商体系

现有电商：

```text
products
sales
stockLogs
```

实际存储：

```text
07-电商系统/data/inventory-store.json
```

问题：

- 无会员关联。
- 无统一订单。
- 无发货、售后、退款、SKU 标准表。
- 库存流水不能被财务和会员中心可靠追踪。

正式模型：

```text
products
product_skus
inventory
inventory_logs
shipments
refunds
aftersales
```

Phase 1：

- 保留现有电商 UI。
- 新建数据库表并写迁移脚本，把 JSON 商品和库存流水导入主库。
- 电商销售写入统一 `orders`。

## 十一、当前可复用模块

可复用模块：

- 官网 Next.js 页面、课程展示、品牌内容、学员分布地图。
- 学员系统 `Member`、`Course`、`Payment`、`ConsumeRecord`、`OperationLog`。
- 学员系统 JWT 中间件、短信验证码、基础安全头、CORS、限流。
- 网课素材、专栏、授权、播放进度的数据表和路由代码。
- 财务收入、支出、账户、统计报表原型。
- 电商商品建档、库存流水、销售出库前端交互。

## 十二、冗余模块

需要合并或淘汰：

- `xueyuan.dongfangwuquan.com` 后台入口。
- `wangke.dongfangwuquan.com` 网课后台入口。
- `dianshang.dongfangwuquan.com` / `shop.dongfangwuquan.com` 独立电商后台入口。
- `caiwu.dongfangwuquan.com` 独立财务后台入口。
- 电商、财务、网课各自的管理员账号和 Token。
- 电商 JSON 存储。
- 多套系统切换 SSO 临时 token 方案。

## 十三、必须重构模块

P0 必须重构：

1. 统一登录：`admin.dongfangwuquan.com/login`
2. 统一后台 Layout：左侧菜单、顶部栏、用户信息、系统设置
3. 统一权限：从字段权限升级到 RBAC 权限码
4. 统一会员中心：聚合课程、订单、学习、核销、财务、电商、客服、营销记录
5. 统一订单中心：所有业务交易落到统一订单模型
6. API 网关：生产入口统一为 `api.dongfangwuquan.com`
7. 电商数据入库：停止以 JSON 作为正式业务数据源

## 十四、数据统一建议

短期：

- 主库继续以 `dance.db` 为本地开发和过渡数据源。
- 不直接覆盖生产数据库，继续遵守“永远不要动云端数据库”的现有铁律。
- 先在本地新增兼容表，写迁移脚本和回滚脚本。

中期：

- 建立 PostgreSQL 目标 schema。
- 从 SQLite 导出 `Member`、`Course`、`Payment`、`ConsumeRecord`、`CourseSeries`、`Material`、电商 JSON。
- 使用手机号、历史 ID、订单号做映射表。

长期：

- PostgreSQL 作为唯一业务数据库。
- Redis 用于验证码、会话、限流、队列状态。
- Prisma 统一数据访问层。

## 十五、API 网关方案

Phase 1 网关：

```text
api.dongfangwuquan.com/auth/*       -> 当前学员系统 auth
api.dongfangwuquan.com/members/*    -> 当前学员系统 members
api.dongfangwuquan.com/orders/*     -> 新统一订单模块
api.dongfangwuquan.com/courses/*    -> 当前 Course + 网课路由
api.dongfangwuquan.com/finance/*    -> 当前财务模块
api.dongfangwuquan.com/shop/*       -> 电商模块
api.dongfangwuquan.com/public/*     -> 官网公开接口
```

Phase 2 后端服务化：

```text
gateway-service
auth-service
member-service
order-service
course-service
shop-service
finance-service
cms-service
upload-service
notification-service
```

## 十六、会员中心方案

会员详情页必须聚合：

```text
基础资料
标签
等级
线下课程购买
线下课程核销
网课授权
学习进度
直播记录
培训记录
大师课记录
活动记录
赛事记录
电商订单
付款记录
退款记录
客服记录
营销触达记录
行为日志
```

当前可直接聚合的数据：

```text
Member
Payment
ConsumeRecord
Course
CourseAuthorization
CourseOrder
VideoProgress
FinanceIncome
FinanceOrder
OperationLog
```

需要补齐的数据：

```text
member_tags
member_levels
member_addresses
orders
order_items
crm_notes
crm_followups
marketing_touch_logs
shop_orders
refunds
shipments
```

## 十七、权限方案

统一权限必须落到 3 层：

```text
角色 -> 权限码 -> 菜单/按钮/API
```

后台菜单权限：

```text
dashboard.view
member.view
member.manage
order.view
order.manage
course.manage
live.manage
training.manage
masterclass.manage
event.manage
competition.manage
cms.manage
shop.manage
finance.view
finance.manage
crm.manage
marketing.manage
analytics.view
permission.manage
settings.manage
```

实施要求：

- 前端菜单只做展示控制。
- 后端 API 必须做权限校验。
- 超级管理员拥有全部权限。
- 财务、电商、仓库、老师等角色只开放对应模块。

## 十八、最终统一实施方案

### Phase 1：核心底座

目标：

```text
统一登录
统一后台 Layout
统一权限
统一会员中心
统一订单中心
```

执行步骤：

1. 将生产入口全部指向正式域名体系。
2. 以当前学员系统为过渡后台壳，菜单改成统一模块结构。
3. 新建 RBAC 表，兼容旧 `User.perm*` 字段。
4. 新建统一 `orders` / `order_items` / `payment_logs`。
5. 新建会员聚合接口 `/api/members/:id/profile360`。
6. 电商 JSON 导入主库，销售写入订单中心。

### Phase 2：教育业务

目标：

```text
课程
直播
线下培训
大师课
活动
赛事
```

执行步骤：

1. 拆清 `Course`、`CourseSeries`、`OnlineCourse` 的业务边界。
2. 建立 `training`、`masterclass`、`event`、`competition` 标准模型。
3. 学员学习中心统一访问录播、直播、作业、打卡和进度。

### Phase 3：商业业务

目标：

```text
电商
财务
CRM
营销
```

执行步骤：

1. 商品、SKU、库存、发货、售后全部入库。
2. 财务读取订单和流水，不再拼散表。
3. CRM 跟进记录挂到会员详情。
4. 营销活动、优惠券、触达记录与订单转化关联。

### Phase 4：高级能力

目标：

```text
数据分析
AI 客服
自动化运营
智能推荐
```

执行步骤：

1. 建立统一事件埋点。
2. 建立经营看板。
3. 建立客服知识库和会员画像。
4. 基于学习、购买、活动行为做推荐。

## 十九、本次已执行的升级

本次已先完成低风险域名统一配置：

- 官网默认 API 从旧学员域名切到 `https://api.dongfangwuquan.com`。
- 官网登录入口切到 `https://learn.dongfangwuquan.com`。
- 官网生产 PM2 环境变量切到 `api.dongfangwuquan.com`。
- 学员系统和网课系统 CORS 加入 `admin`、`learn`、`api`、`auth`、`miniapi` 正式域名。
- 小程序运行配置切到 `miniapi.dongfangwuquan.com` 和 `auth.dongfangwuquan.com`。
- 现有后台的跨系统入口开始收敛到 `admin.dongfangwuquan.com` 下的模块路径。

2026-05-22 继续执行 Phase 1 底座合并：

- 新增平台统一配置接口：`GET /api/platform/config`。
- 新增会员 360 档案接口：`GET /api/members/:id/profile360`。
- 会员 360 档案已聚合：基础资料、线下缴费、核销记录、网课订单、课程授权、学习进度、财务收入、财务订单、操作日志。
- 新增统一订单视图接口：`GET /api/orders` 和 `GET /api/orders/unified`。
- 统一订单视图已兼容聚合：`Payment`、`CourseOrder`、`FinanceOrder`、正式 `orders` 表。
- 新增 RBAC 基础表：`roles`、`permissions`、`role_permissions`、`admin_user_roles`。
- 新增统一订单中心基础表：`orders`、`order_items`、`payment_logs`、`refunds`、`invoices`。
- 新增电商正式数据表：`products`、`product_skus`、`inventory`、`inventory_logs`、`shipments`、`aftersales`。
- 新增电商 JSON 到主库迁移脚本：`07-电商系统/scripts/migrate-commerce-to-main-db.js`。
- 本地主库初始化验证通过，已生成 11 个角色、20 个权限、2 个超级管理员角色绑定。
- 现有学员管理后台新增“订单中心”菜单与页面，接入统一订单接口。
- 学员列表新增“360”按钮，接入会员 360 档案接口。
- 会员 360 弹窗已展示线下缴费、核销、网课订单、课程授权、学习进度、财务记录。
- 本地接口联调通过：`/api/platform/config`、`/api/members`、`/api/orders/unified`、`/api/members/:id/profile360`。
- 后台 `index.html` 内联脚本静态解析通过。
- 新增权限目录接口：`GET /api/permissions/catalog`，返回角色、权限、角色权限、用户角色与统一后台菜单权限映射。
- 设置页新增“统一平台权限目录”面板，展示正式 RBAC 角色、权限码、角色权限绑定数量与后台路径。
- 订单中心新增订单详情弹窗，可查看聚合订单字段和原始来源字段。
- 电商系统新增写入后同步主库过渡层：保留 JSON 兼容，同时同步 `products`、`product_skus`、`inventory`、`inventory_logs`、`orders`。
- 使用临时数据库验证电商写入同步成功，测试数据已从本地电商 JSON 清理。
- 电商系统新增手动同步接口：`POST /api/sync-main-db`，同步状态接口：`GET /api/sync-main-db/status`。
- 电商后台工作台新增“同步主库”按钮，并显示主库同步状态。
- 学员系统服务新增正式后台模块路径 fallback：`/dashboard`、`/members`、`/orders`、`/course`、`/finance` 等统一路由可直接打开后台壳。
- 学员系统服务新增 `/login` 路径，兼容 `admin.dongfangwuquan.com/login` 唯一登录入口。
- 后台前端新增正式路径识别：直接访问 `/orders`、`/members`、`/course`、`/finance`、`/permissions` 等路径后，会进入对应模块而不是停留在默认首页。
- 修复后台首页切换递归风险，确保 `/dashboard` 和统计页在统一后台入口下可稳定打开。
- 浏览器联调验证通过：本地直接打开 `http://127.0.0.1:3000/orders` 后，页面 active 模块为订单中心，左侧菜单同步高亮，订单数据可见。
- 移除主后台财务/统计页的 iframe 嵌入，改为后台原生“财务与运营总览”：会员、课程、今日收入、本月收入、年度收入、近 6 个月趋势、最近缴费、即将到期课程。
- 浏览器联调验证通过：本地直接打开 `http://127.0.0.1:3000/dashboard` 后，页面 iframe 数量为 0，财务总览数据正常渲染。
- 新增主后台电商总览接口：`GET /api/shop/summary`，从主库 `products`、`product_skus`、`inventory` 读取商品、SKU、库存、低库存、库存估值。
- 主后台新增原生 `/shop` 电商页面，不再依赖跳转或 iframe，可直接查看电商主库商品和库存。
- 已执行本地电商 JSON 到本地主库迁移：导入 8 个商品、8 个 SKU、8 条库存日志。
- 浏览器联调验证通过：本地直接打开 `http://127.0.0.1:3000/shop` 后，页面 active 模块为电商系统，商品数 8、SKU 数 8、库存总量 79 正常渲染。
- 统一后台登录路径：后台未登录、Token 失效、退出登录统一跳转 `/login`，管理员登录成功进入 `/dashboard`，兼容 `admin.dongfangwuquan.com/login` 唯一入口。
- 本地学员分享登录地址同步从 `/login.html?role=student` 收敛为 `/login?role=student`。
- 新增云服务器部署读取说明：`dongfangwuquan云服务器部署读取说明.md`，明确主后台/API、官网、电商工作台、学习中心分别读取的工程目录，并强调禁止直接覆盖上传本地数据库。
- 网课服务运行入口开始收敛：生产环境访问网课服务 `/` 或 `/admin` 时，重定向到统一后台 `https://admin.dongfangwuquan.com/course`；本地开发仍保留 `/admin/login.html`。
- 网课后台公共脚本的系统切换链接收敛到统一后台：课程进入 `/course`，财务进入 `/finance`，未登录生产环境跳转 `https://admin.dongfangwuquan.com/login`。

## 二十、最终结论

当前项目已经具备统一平台的业务基础，但还不是统一企业级平台。

最有价值的资产是：

```text
Member 主数据
线下课程与缴费核销
网课表结构
财务原型
电商进销存交互
官网品牌内容
```

最大风险是：

```text
多后台
多登录
多 Token
多数据源
电商 JSON
订单不统一
权限不可扩展
```

正式路线应坚持：

```text
先统一入口和身份
再统一会员和订单
再合并课程、电商、财务
最后服务化和智能化
```

唯一后台：

```text
admin.dongfangwuquan.com
```

唯一官网：

```text
www.dongfangwuquan.com
```

唯一学习中心：

```text
learn.dongfangwuquan.com
```
