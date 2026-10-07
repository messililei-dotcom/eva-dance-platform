# iOS / iPadOS 开发

2026-10-02：原生 SwiftUI + AVKit，最低 iOS 16，版本 1.0.0 (2)。Xcode 27.0 已安装并完成首次启动，iOS 模拟器 Debug 与真机 SDK Release（未签名）构建通过。当前为本地开发版本，尚未部署 App API、签名、上传或提审。

- 打开工程：`EvaDance/EvaDance.xcodeproj`，Scheme `EvaDance`。
- 源码：`EvaDance/Sources/EvaDanceApp/`；共享模型与网络：`EvaDance/Sources/EvaCore/`。
- [小程序对齐与增强验收](注册与上架/小程序对齐与增强验收-20261002.md)。
- [本轮开发与调试报告](注册与上架/全站开发与Xcode调试-20261002.md)。
- [上线准备与验收清单](注册与上架/上线准备与验收-20261002.md)。

## 已实现的功能范围

五个主栏目：线上学院、线下课、赛事、商城、个人中心。包含公开课程、授权学习、播放器、学习进度、笔记收藏、线下预约签到、赛事报名与成绩、商品与购物清单、订单管理、地址、个人资料、成长打卡、消息、证书及设备管理。品牌、资讯和艺术节页面通过官方站点链接打开。

三端数据归数字化平台统一管理。App 公开课程/目录/线下课/赛事读取平台现有 `https://admin.swod.com.cn/api/mini` 的公开只读路由；这里 mini 是历史路由名称，不是独立数据源。App 登录与个人权限接口为 `https://admin.swod.com.cn/api/app/v1`，新增服务端代码位于工程的 `10-统一平台admin-platform/`。App 使用独立访问/刷新令牌及 ios_app 登录来源，Keychain 保存会话。**App 专属登录/个人接口仍待部署联调；公开课程已接入真实平台数据。**

注销入口目前提交待处理申请并撤销 App 会话，实际删除与依法保留处理尚未闭环。实物支付尚未接入；购物清单不允许提交购买。数字课程购买与安全离线下载未实现，不应在商店介绍中宣称支持。

## 本地检查和调试

在 `EvaDance/` 目录运行：

```sh
swift run --scratch-path /tmp/eva-ios-checks EvaCoreChecks
python3 scripts/generate_project.py
xcodebuild -project EvaDance.xcodeproj -scheme EvaDance -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/eva-ios-build CODE_SIGNING_ALLOWED=NO build
python3 scripts/check_release.py
```

`EvaCoreChecks` 是自包含契约检查程序；固定样本不写生产数据。发布检查预期返回 2，直到全部发布门槛有验收证据。

本地界面样本：先运行 `python3 scripts/fixture_server.py`，再选择 `EvaDance-Fixtures` Scheme（已配置本地地址）。样本账号 `13800000000`、验证码 `123456` 仅在该本地服务有效，不发送短信。Release 忽略该环境变量。本地样本不能证明生产接口和真实视频播放通过。

`generate_project.py` 会覆盖生成的工程、Info.plist、隐私清单；配置调整须同步脚本。不要写入真实 Team、证书私钥或审核账号密码。Bundle ID `cn.com.swod.app` 仍需在组织账号核对登记与备案。

## 2026-10-03 商城支付开发更新

新增实物结算页、支付宝／微信移动网页支付跳转、订单继续付款，以及回到 App 后刷新订单状态。只接受支付宝和微信官方 HTTPS 支付地址；支付成功以后台订单状态为准。登录和收货地址继续使用统一后台。

此版本为本地开发，未上传。App API 的实物结算采用 `APP_PHYSICAL_CHECKOUT_ENABLED=true` 独立发布开关，默认关闭；需在 App API 完整部署联调后开启。微信移动网页入口还要求商户 H5 已开通，当前未满足时不会展示。没有新增原生微信／支付宝 SDK，也未完成真实手机支付验证。
