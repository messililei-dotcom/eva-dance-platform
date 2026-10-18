# SWOD 第二轮 UI 升级（小程序内容与规则对齐）

入口：[对比报告.html](对比报告.html)。包含小程序、iOS、Android 各 5 个页面的真实运行前后对比，以及鸿蒙源码同步说明。

- 小程序五个主页面和商城共用样式完成升级；97 项 Node 回归测试通过，一致性检查通过。
- 微信开发者工具实际连接，确认公开课程加载、无结果搜索与清空、错误呈现与重试、课程入口跳转、无预约标签、赛事状态。运行结果见 `logs/mini-runtime.json`。
- iOS 本轮实际产品源码 Simulator Debug 构建成功；后续截图构建仅在临时副本加入选项卡启动参数。
- Android 本轮产品源码 Debug/Release 构建、6 项单元测试通过；Release lint 0 错误、15 警告（详见验证文件）。候选 APK 已验签。截图使用独立 UI QA 安装身份。
- 鸿蒙资源文件可解析，代码已同步；缺少 DevEco Studio，未完成编译或设备验收。
- 保留原有业务与权限开关。本轮没有创建真实订单、报名、付款、退款或核销，没有提交审核、没有正式发布。
- 原生已登录账户的期次过滤仍需要设备只读验收；本轮覆盖源码构建与小程序交互，不把构建等同于全业务验收。

`source-before/` 保存本轮前的源码基线，包含用户此前未提交的更改。`ui-source.patch` 是相对这一基线的界面源码差异，不是相对 Git HEAD 的全部工作区差异。`source-changes.json` 提供界面源文件哈希；测试、文档、隔离 fixture 的更新另见仓库文件。

`before/` 与 `after/` 含 32 张 PNG（30 张主页面截图，2 张临时异常状态展示），`screenshots.json` 保存哈希。`comparisons/` 只做等比排版，不改画面内容。小程序个人中心姓名/手机号/头像已在页面运行时脱敏，账号资料未修改。

小程序前后为本轮真实开发者工具截图；iOS / Android 前图取自上一轮完成状态，后图为本轮重新运行。Android 与小程序公开数据随后台变化；iOS 为本地隔离样本。鸿蒙未提供冒充设备运行证据的图片。

复现小程序回归：

```sh
node --test 10-小程序miniprogram/scripts/*.test.cjs
node 10-小程序miniprogram/scripts/check-miniprogram-consistency.js
```

截图脚本在 `scripts/`，需本机对应模拟器 / 微信开发者工具自动化端口以及 `miniprogram-automator@0.12.1`；自动化依赖安装在 `/tmp/swod-mini-ui-tools`，未加入产品依赖。生产候选源码不包含 UI QA 选项卡启动参数。
