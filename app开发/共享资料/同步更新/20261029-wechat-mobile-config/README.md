# 微信开放平台移动应用配置 — 2026-10-29

本轮完成配置准备和三端资源同步。**微信原生登录尚未接通，登录开关保持关闭。** 未部署服务端、未修改微信后台、未变更备案、未上传商店或提审。

## 已确认与已配置

- 用户提供移动应用名称 SWOD伊娃东方舞、AppID `wxc1e3dafe3d3b70c6`，并确认微信登录权限已开通。权限状态为用户确认，本轮未进入开放平台独立复核。
- 用户确认登记的 Universal Link 为 `https://www.swod.com.cn/app/wechat/`。
- AppSecret 仅保存在本机仓库外 `~/.config/eva-app/wechat-mobile.json`，权限 0600；报告、公开配置和客户端均不包含其值。
- 原有根目录用户文档 `微信开发配置.rtf` 含凭据，保留原文件并单独加入 Git 忽略规则；未复制进备份或发布包。
- 公开配置统一在 `app开发/共享资料/配置/wechat-mobile.public.json`。执行 `app开发/共享资料/scripts/sync_wechat_mobile.py` 同步 Android assets 与 HarmonyOS rawfile；iOS 项目生成器写入 Info.plist 的自定义配置字段。三个平台的配置均为 `loginEnabled=false`。
- iOS Bundle ID、Android 包名仍为 `cn.com.swod.app`；HarmonyOS Bundle Name `cn.com.swod.evadance`、Identifier `6917617955633704973`。这些是本地发行标识，不能证明开放平台已登记全部平台。
- 原 Android 发布签名 MD5 `460ddea3a2119d0c4f11c43c24889b11`，本轮构建后再次核对。
- 从已有正式构建 6 IPA 的描述文件读取 Apple application-identifier 为 `RT4J8ZD4JU.cn.com.swod.app`，用于准备关联文件。
- 官网旧 AppID、小程序凭据和公众号凭据保持独立，未覆盖或复用。

## 服务端配置接口

新增 `10-统一平台admin-platform/src/lib/server/app-wechat-config.ts`，只允许服务端导入。此模块尚未接入 OAuth 路由，也不代表凭据已通过微信服务器验证。

优先使用完整的一组 `WECHAT_MOBILE_APP_ID`、`WECHAT_MOBILE_APP_SECRET`。任何一个变量存在时，必须同时有效，禁止与文件混合拼接。否则可通过绝对路径 `WECHAT_MOBILE_CONFIG_FILE` 指定 0600 私有 JSON 文件，要求 `applicationType=mobile`。生产环境不自动读取开发者主目录；开发环境可读取上述本机私有文件。禁止网站或小程序变量回退、符号链接和组/其他用户可读取的文件。错误不输出凭据内容。

## Universal Link 当前阻塞与准备文件

本轮实际 HTTP 核对：

| 地址 | 状态 |
| --- | --- |
| `https://www.swod.com.cn/.well-known/apple-app-site-association` | 404 |
| `https://www.swod.com.cn/apple-app-site-association` | 404 |
| `https://www.swod.com.cn/app/wechat/` | 308，重定向到无尾斜杠地址 |
| `https://www.swod.com.cn/app/wechat` | 404 |

`universal-link-preparation/` 内准备了 AASA、Associated Domains entitlement 及 Info URL Scheme 片段。它们是后续接入材料，**未写入网站运行目录、未部署、未启用 iOS entitlement 或 URL 回调**。AASA 只允许正式 App 的微信专用路径，不授权 QA Bundle 或全站路径。部署时须核对 HTTPS、无重定向、JSON 响应类型和实际 CDN 返回。SDK 所需查询 scheme 需以接入时官方版本文档再核对；片段不作为 SDK 实现。

## 后续登录接入与验收

1. 接入适用平台的微信官方 SDK，完善隐私告知与同意后初始化；本轮未新增 SDK。
2. 实现平台回调及服务端一次性 state/code 交换、过期与重放校验；AppSecret 永远留在服务端。
3. 身份按移动 AppID + OpenID 存储；仅可信服务端 UnionID 可跨应用关联。缺少 UnionID 时使用已验证手机号绑定，有冲突时不得自动合并会员或学习权益。
4. 部署关联文件并启用正式 App Associated Domains，核对 Android 原签名和鸿蒙 Identifier 在开放平台的登记。
5. 真机分别验证已安装/未安装微信、授权取消、拒绝、错误回调、账号切换、退出、账号注销和有效课程权益。模拟器或配置通过不构成登录验收。

配置字段依据：[微信官方移动应用接入参数说明](https://pay.wechatpay.cn/doc/v3/merchant/4015478291)。此页面支持各平台标识字段说明，不作为微信登录权限、支付权限或 SDK 接通的证据。

构建、测试和产物核验详见同目录 `verification.json`。已有阿里云缓存开发开关继续保持关闭。
