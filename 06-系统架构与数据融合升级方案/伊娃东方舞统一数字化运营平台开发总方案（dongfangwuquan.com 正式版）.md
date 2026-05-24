很好，那我们正式锁定主域名：

# 主域名确定

```text
www.dongfangwuquan.com
```

````md id="9p8q2n"
# 伊娃东方舞统一数字化运营平台开发总方案（dongfangwuquan.com 正式版）

## 一、项目定位

本项目定位：

> 伊娃东方舞成人舞蹈教育数字化运营平台

主营业务：

- 成人舞蹈教育
- 线上录播课程
- 线上直播课程
- 线下培训 / 集训 / 大师课
- 舞蹈周边电商
- 会员运营
- 财务管理
- 营销管理
- 数据分析
- 赛事活动

本项目不是多个独立网站。

本项目是统一企业级平台。

---

## 二、核心架构原则（强制）

必须遵守：

### 统一原则

只有：

- 一个品牌主域名
- 一个后台入口
- 一个统一登录
- 一个统一权限系统
- 一个统一会员中心
- 一个统一订单中心
- 一个统一设计系统
- 一个统一 API 网关
- 一个统一数据规范

禁止：

- 多个后台
- 多个登录入口
- iframe 拼装
- 临时兼容方案
- 多套权限系统
- 多个独立管理系统

这是一次性正式架构。

不是过渡方案。

---

## 三、域名架构（正式）

### 官网

```text
www.dongfangwuquan.com
````

用途：

* 品牌官网
* 东方舞介绍
* 课程展示
* 招生页面
* 大师课宣传
* 活动宣传
* 电商展示
* 营销落地页

---

### 管理后台（唯一入口）

```text
admin.dongfangwuquan.com
```

唯一管理入口。

所有管理员只允许从这里进入。

---

### 学员学习中心

```text
learn.dongfangwuquan.com
```

用途：

* 网课学习
* 视频播放
* 学习进度
* 作业
* 打卡
* 学员个人中心

---

### API 网关

```text
api.dongfangwuquan.com
```

统一 API 服务入口。

---

### 认证中心

```text
auth.dongfangwuquan.com
```

统一认证服务。

也可合并到：

```text
admin.dongfangwuquan.com/login
```

---

### 静态资源

```text
static.dongfangwuquan.com
```

用途：

* 图片
* 视频封面
* 海报
* 上传资源
* CDN

---

### 小程序 API

如独立：

```text
miniapi.dongfangwuquan.com
```

---

## 四、后台统一模块结构

唯一后台：

```text
admin.dongfangwuquan.com
```

模块：

```text
/dashboard
/members
/orders

/course
/live
/training
/masterclass
/events
/competition

/cms
/content

/shop
/products
/inventory
/shipping
/aftersales

/finance
/crm
/marketing
/analytics

/permissions
/settings
```

---

## 五、后台左侧菜单

```text
首页

会员中心
订单中心

课程管理
直播管理
线下培训
大师课
活动管理
赛事管理

官网管理
内容管理

电商系统
商品管理
库存管理
发货管理
售后管理

财务中心
CRM客户管理
营销中心
数据分析

权限管理
系统设置
```

---

## 六、技术架构

采用：

> 企业级统一平台架构

模式：

统一前端平台 + 模块化后端服务

---

### 前端工程

管理后台：

```text
admin-platform
```

模块：

```text
modules/member
modules/order
modules/course
modules/live
modules/training
modules/masterclass
modules/event
modules/competition
modules/shop
modules/finance
modules/crm
modules/analytics
modules/cms
```

统一：

* Layout
* Header
* Sidebar
* Login
* Token
* UI
* 权限
* 主题
* 国际化

---

### 学员端

```text
student-platform
```

服务：

```text
learn.dongfangwuquan.com
```

---

### 官网

```text
official-website
```

服务：

```text
www.dongfangwuquan.com
```

---

## 七、后端服务

服务拆分：

```text
gateway-service
auth-service

member-service
order-service
payment-service

course-service
live-service
training-service
masterclass-service
event-service
competition-service

shop-service
inventory-service
shipping-service

finance-service
crm-service
marketing-service
analytics-service

cms-service
notification-service
upload-service
```

---

## 八、统一数据模型

统一规范。

---

### 会员

```text
members
member_profiles
member_tags
member_levels
member_addresses
member_logs
```

---

### 课程

```text
courses
course_chapters
course_lessons
course_progress
course_live_sessions
```

---

### 线下培训

```text
trainings
training_enrollments
attendance
teachers
classrooms
```

---

### 电商

```text
products
product_skus
inventory
shipments
refunds
```

---

### 订单中心（统一）

```text
orders
order_items
payments
payment_logs
invoices
refunds
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

---

### 财务

```text
finance_transactions
income_records
expense_records
settlements
withdrawals
```

---

### CRM

```text
crm_tasks
crm_notes
crm_followups
crm_campaigns
```

---

## 九、统一会员中心（核心）

这是整个平台核心。

会员详情必须聚合：

```text
基础资料
标签
等级

课程购买
课程学习进度

直播记录
线下培训记录
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

---

## 十、统一登录

唯一登录：

```text
https://admin.dongfangwuquan.com/login
```

认证：

```text
JWT + Refresh Token
```

统一角色：

```text
超级管理员
校长
运营
教务
财务
电商
客服
仓库
内容编辑
赛事管理员
老师
```

---

## 十一、推荐技术栈

前端：

```text
Next.js
React
TypeScript
Ant Design Pro
Tailwind
React Query
Zustand
```

后端：

```text
NestJS
PostgreSQL
Redis
Prisma
BullMQ
```

视频：

```text
腾讯云 VOD / 阿里云点播
CDN
防盗链
```

文件：

```text
OSS / COS / S3
```

部署：

```text
Docker
Nginx
CI/CD
```

---

## 十二、Codex执行要求

先扫描整个项目代码。

输出：

# 《dongfangwuquan 统一平台架构分析报告》

必须分析：

```text
当前目录结构
前端项目数量
后端项目数量
数据库结构
用户体系
权限体系
订单体系
课程体系
财务体系
电商体系
```

输出：

1. 当前可复用模块
2. 冗余模块
3. 必须重构模块
4. 数据统一建议
5. API网关方案
6. 会员中心方案
7. 权限方案
8. 最终统一实施方案

---

## 十三、开发顺序

Phase 1：

核心底座

```text
统一登录
统一后台 Layout
权限系统
会员中心
订单中心
```

---

Phase 2：

教育业务

```text
课程
直播
线下培训
大师课
活动
赛事
```

---

Phase 3：

商业业务

```text
电商
财务
CRM
营销
```

---

Phase 4：

高级能力

```text
数据分析
AI客服
自动化运营
智能推荐
```

---

## 十四、最终目标

打造：

> 伊娃东方舞企业级数字化运营平台

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

统一管理：

成人舞蹈教育
线上课程
线下培训
舞蹈电商
会员
财务
营销
赛事
数据

```

---

## 十五、关键开发要求

禁止 Codex：

- 临时拼装
- 多后台设计
- iframe方案
- 多登录方案
- 多权限系统
- 技术债方案

必须：

> 一次性做正确架构。
```

这个版本已经是正式企业架构了。

我再补一句真正专业建议：

你这个主域名 **dongfangwuquan.com 很适合品牌官网**，但从国际品牌感来说：

**AiwaRaks.com / swod.com 类似短域名更高级。**

不过如果你现在品牌核心就是“东方舞圈”，那继续用这个完全没问题。
