# SWOD 三端 UI 升级与前后对比

日期：2026-10-16。用户选定方向：简洁明亮，突出课程与内容。

本轮更新 iOS、Android、HarmonyOS 的原生界面源码。重点覆盖线上学院、线下课、赛事、商城、个人中心及其公共组件。保留现有业务接口、登录授权、金额规则、报名和订单操作；没有部署服务器、提交商店或执行真实业务写入。

## 查看对比

- [交互式对比报告](对比报告.html)：切换平台及五个主页面，点击原图放大。
- [iOS 五页前后总览](comparisons/ios-all-pages.png)
- [Android 五页前后总览](comparisons/android-all-pages.png)
- [HarmonyOS 源码样式示意](comparisons/harmony-academy-preview.png)：**不是设备截图，也不是像素级复刻**。
- `before/` 与 `after/` 共 20 张原始运行截图；`screenshots.json` 保留来源路径和 SHA-256。10 组比较图只作等比缩放与并排排版。

## 已落实的界面调整

1. 内容优先：减少渐变与大块品牌装饰；将连续竖排学习按钮收拢为快捷入口，让更多课程进入首屏。
2. 统一规则：亮灰背景、独立内容表面、品牌红操作色、明确的标题与辅助文字层级、稳定封面占位、统一留白。
3. 原生体验：iOS 保留系统导航与 SF Symbols；Android 使用同一套描边图标、触控反馈和明确的选中态；鸿蒙同步图标导航与选中状态。
4. 无障碍与适配：iOS Dynamic Type，辅助字号下快捷入口改为纵向；Android 48 dp 触控下限、1.3 倍字号、紧凑宽屏导航及滚动兜底；明暗主题使用语义颜色。
5. 状态：改善加载、错误重试、搜索提示和访客登录区；图片失败时保留稳定占位，不让列表跳动。

## 验证结果和边界

| 平台 | 本轮证据 | 尚未完成 |
| --- | --- | --- |
| iOS | iPhone 模拟器五页前后截图、深色模式、辅助大字体、iPad 截图；Debug Simulator 与 Release iphoneos 未签名设备目标构建通过 | 签名安装、真机完整业务与媒体验收、TestFlight / App Store |
| Android | Android 16 模拟器五页前后截图、深色主题、1.3 倍字号和宽屏导航；6 项现有 Java 测试通过；Release lint 0 错误；实际包名的 Release APK 构建和签名校验通过 | 真机、SIM / 网络 / 视频和上架验收 |
| HarmonyOS | 三端公共视觉规则、ArkUI 页面、明暗颜色和 24 个 SVG 资源已同步；官方 build 与 lint 均实际尝试 | 两项命令都返回 `DevEco Studio installation not found in default locations.`，未完成 ArkTS 编译、HAP 或运行截图 |

`checks/` 保存大字体、深色与平板/宽屏验证截图。`logs/` 保存构建、测试、签名及鸿蒙工具失败证据。既有构建告警不等同于错误，详细数量以日志和 `validation.json` 为准。

iOS 对比使用同一套明确标识的本地演示数据；不签发生产视频权限。Android 对比从同一公开接口读取真实公开课程与商品，不登录或提交业务记录。两平台使用自己的原生模拟器截图，不把浏览器预览当成 App 运行。

为了准确选择五个主入口，截图构建只在临时构建目录增加启动参数选择器；Android 使用隔离包名 `cn.com.swod.app.uiqa`。这些选择器未写入工作区产品源码，签名候选 APK 来自恢复后的实际包名和源码构建。

## 开发候选产物

- [Android 签名候选 APK](installers/SWOD-1.0.0-5-UI-20261016-candidate.apk)，实际包名 `cn.com.swod.app`，版本仍为 `1.0.0 (5)`。本轮未把开发候选标记为正式发布，也未改动版本发布流程。
- [候选包 SHA-256 与状态](android-candidate.json)
- `source-before/` 保存本轮开始时的工作区 UI 文件，包含当时已有的未提交修改；`ui-source.patch` 记录本轮 UI 差异，避免把之前的业务开发当成本轮变化。

本轮使用 UI Skills 路由、Impeccable 的原生平台规范与 UI/UX Pro Max 的触控/交互指引。按目标选择技能，不在每次 UI 修改时同时加载所有技能。
