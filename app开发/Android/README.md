# Android 开发资料

更新：2026-10-11。原生 Java 工程位于 `EvaDance/`，包名 `cn.com.swod.app`，版本 1.0.0 (3)，最低 Android 8.0。使用 AGP 8.13.2、Gradle 8.13、JDK 17、compile/target SDK 36。

已开发学院、原生视频播放、学习进度与笔记、线下预约、赛事音乐报名、商城查询、个人中心，以及独立工作人员赛事管理。业务接口来自统一数字化平台；工作人员凭证与会员凭证分离，会员会话使用 Android Keystore 加密保存。

已检查 6 个 Java 源文件语法，没有编译安装包：本机 Android SDK 尚未安装，SDK 许可待账号持有人接受。语法检查不能证明 Android 类型检查或运行通过。SDK 安装后运行 `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:bundleRelease`，然后完成模拟器、真机与实际签名验证。

Release 读取被 Git 忽略的 `signing.local.properties`（storeFile、storePassword、keyAlias、keyPassword），不得将私钥或密码提交仓库。`备案资料/20261002/` 的证书材料保留；安装包证书须重新比对，不能使用鸿蒙签名。

号码认证公开方案位于 `号码认证/20261003/方案信息.json`，私有 SDK 配置已检查存在且标识匹配。号码认证 SDK、微信移动登录、安全视频离线缓存尚未接入本工程，是上线前必须完成的功能。

详细范围、证据与限制见 `../共享资料/上线准备/20261011/三端开发与赛事同步.md`。
