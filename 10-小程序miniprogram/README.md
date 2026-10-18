# 伊娃东方舞小程序

这是微信小程序独立工程目录，可直接用微信开发者工具打开本文件夹。

## 目录

- `app.json` / `app.js` / `app.wxss`: 小程序入口配置与全局样式
- `pages/`: 小程序页面
- `utils/`: 接口请求封装
- `shared/`: 小程序与网页预览共用运行配置
- `preview/`: 网页预览版本
- `docs/`: 发布与操作文档
- `admin-related/`: 原网课后台中与小程序配置、模拟器相关的页面备份

## 检查

```bash
node scripts/check-miniprogram-consistency.js
```

## 2026-10-16：与 SWOD App 第二轮 UI 同步

五个主页面采用明亮、课程优先的布局；线上学院保留课程源和视频开关链路，增加课程/课时/比赛入口与独立失败重试。赛事列表、详情、提交前统一使用 `shared/event-state.js`，避免把未开放报名的赛事误显示为结束。个人中心保留现有课程、期次、比赛、证书、通知与订单内容。商城详情、结算与订单同步共享视觉样式。

运行 `node --test scripts/*.test.cjs` 和 `node scripts/check-miniprogram-consistency.js` 验证。开发者工具前后实图及三端同步范围见 `../app开发/共享资料/UI升级/20261016-v2/对比报告.html`。本轮是源码与开发者工具验证，未上传、提审或发布。

### 同步官网线下课程介绍

运行 `node scripts/sync-official-offline-content.cjs`，从官网课程配置、详情页专项介绍和公开课程匹配关系生成 `shared/official-offline-content.js`；`--check` 可检查是否需要重新同步。只同步介绍、大纲及适合级别，期次、价格、库存和学员课时继续实时读取后台。官网没有完整介绍的课程保留后台内容，不补造文案。
