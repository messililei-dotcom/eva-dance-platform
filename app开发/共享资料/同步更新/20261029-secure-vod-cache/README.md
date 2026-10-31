# 线上课程安全缓存：SDK 与授权基础阶段

本轮按用户确认接入阿里云官方播放器 SDK 7.18.0，**缓存功能保持关闭**；未部署后端、未修改云端 VOD 配置、未购买授权、未上传或提审商店、未变更备案或应用签名。

用户确认的产品规则：缓存允许断网观看；24 小时内联网续期由 App 自动处理，用户无需点击续期。实际有效期取课程权益到期时间、App 会话有效期及 24 小时中的最早值。离线时无法即时收到退款或撤权通知；收到明确拒绝结果后立即停止，断网超过有效期也停止。

## 已开发并检查的内容

- 服务端新增 `POST /api/app/v1/video/{lessonId}/cache-authorization`。从已验证 AppSession 取得用户，独立查学习权益、课程发布状态及课节与 VOD 的关联，不接受客户端自报用户 ID 或缓存里的已购买标记。
- 下载授权绑定用户、会话、安装标识、课节、后台 series ID 和素材版本。素材重绑、课程移入另一 series、撤权或注销后不能通过联网续期。云端请求返回前再检查一次状态，防止 RPC 等待期间撤权后仍交付凭证。
- 下载使用单个视频的短期 PlayAuth，最长 300 秒；不返回源文件地址或服务端 AccessKey。普通下载模式、缺少配置、未验收平台均不能签发。续期操作不签发新的 PlayAuth。
- 三端增加 SDK 安全下载适配器：只使用 VidAuth；要求 License 和 encryptedApp.dat，文件仅存 App 私有目录；下载前、下载中、完成时都回调校验授权，检查文件路径及容量，关闭 SDK 控制台日志，不回退到普通 URL 下载。
- 三端增加独立的授权策略与自动续期模块，包含定时重试、前台／网络恢复触发接口、失败不延长旧授权、明确拒绝后失效、异步返回时再次检查账号、持久化成功后才采用新授权。网络问题不会弹出手动续期提示；缓存授权仍有效时保留使用，超期后等联网自动恢复。
- 播放器保留原有在线播放链路。三端加入会话学习码；Android 加安全窗口 FLAG_SECURE；iOS 检测屏幕采集时暂停并遮挡画面，后台也遮挡。iOS 不能保证阻止系统截图；本轮未为鸿蒙申请隐私窗口权限。
- 播放设置明确显示“课程安全缓存尚未开放”，没有假下载进度或手动续期按钮。

## 尚未完成，不能据此开放缓存

1. 三端 License Key、离线 License 证书及对应 App 的 encryptedApp.dat 均尚未配置；用户已确认此状态。
2. 尚未核对生产 VOD 控制台的安全下载模式、禁用离线策略、CDN URL 鉴权／源站访问控制；代码中的 `AuthTimeout` 本身不能证明 URL 鉴权已开启。
3. SDK 下载适配器、续期模块仍需接入缓存任务清单、磁盘索引、受设备保护的授权与单调时钟锚点存储、账号退出清理及本地离线播放器入口。当前不具备可供学员使用的完整离线缓存流程。
4. 缓存进度、后台暂停／恢复、离线学习进度同步及多账号清理尚需整体验收。续期模块的 `persist` / `discard` 回调必须先完成安全存储与清理接线，不能用普通 JSON 文件或前端课程缓存代替。
5. 新 SDK 的个人信息处理、隐私清单及商店隐私答案还未完成审计。未做 SDK 真实下载与离线解密、复制文件到其他 App／设备、录屏防护、时间回拨／重启、退款撤权、恢复联网等真机验收；本轮继续按用户要求跳过真机。

以上项目全部完成之前，不得只设置服务端开关就对外开放。SDK 的 App 绑定加密不等同于每个学员各有 DRM 密钥；24 小时业务授权还依赖 App 中受保护的授权存储与校验。当前未承诺绝对防录制或防外部摄录。

## 编译与测试证据

- iOS：iphoneos Release 无签名编译包含真实 SDK；Apple Silicon 模拟器保留系统播放器，不链接 SDK 分发包里的 arm64 真机切片。模拟器构建及 21 项原有契约检查加缓存身份／到期／自动恢复检查分别记录；不代表 iOS 正式签名归档或真机验收。
- Android：原发布证书签名，单元测试、lint、APK/AAB 编译与签名检查，见 Android/evidence；未以安装或编译替代播放页运行验收。
- HarmonyOS：包含官方 HAR，签名构建及测试证据见 HarmonyOS/evidence；当前没有连接设备，未完成运行验收。
- 后端：缓存、App 会话和支付相关测试在隔离 SQLite 中执行，不调用生产 VOD；源文件 TypeScript 检查使用排除了历史 `.next-build` 生成缓存的临时配置。完整默认类型检查遇到历史生成路由引用缺失，保留其原始日志，未删除生成缓存来掩盖问题。
- iOS UI 截图是本地 53 节测试目录。该隔离服务拒绝签发媒体权限，因此截图的黑屏和无权限提示是预期状态，只验证布局、学习码和缓存关闭提示。

## 配置与后续接入

生产启用条件由 `APP_VOD_CACHE_ENABLED`、`APP_VOD_DOWNLOAD_MODE=secure` 和 `APP_VOD_CACHE_ACCEPTED_PLATFORMS` 控制，默认关闭。这些开关是发布门禁，不是云端设置已生效或加密验收通过的证明。

SDK 授权应沿用当前标识：iOS `cn.com.swod.app`；Android `cn.com.swod.app` 及原发布证书 SHA-1；HarmonyOS `cn.com.swod.evadance`。不要改备案、包名或证书来迁就授权文件。模拟器的开发 Bundle ID 不用于申请生产授权。

License 和密钥留在用户私有配置目录，不发到聊天、不加入公开仓库。三端按官方 License 指引配置证书与 LicenseKey；下载密钥需与 App 标识对应。真实授权、密钥和隐私审计完成后，再接通与验收上述剩余流程。现阶段没有生成假密钥或代买 License。

## 官方依据

- [VOD 安全下载与 App 绑定](https://help.aliyun.com/zh/vod/user-guide/configure-download-settings)
- [SDK 官方下载与版本](https://help.aliyun.com/zh/vod/developer-reference/sdk-download)
- [License 接入要求](https://help.aliyun.com/zh/vod/developer-reference/access-to-license)
- [PlayAuth 时效](https://help.aliyun.com/zh/vod/developer-reference/api-vod-2017-03-21-getvideoplayauth)
- [CDN 鉴权及播放信息](https://help.aliyun.com/zh/vod/developer-reference/api-vod-2017-03-21-getplayinfo)

SDK 原始下载包及校验记录保存在 vendor-downloads；before 保存本轮修改前的相关源文件，changes.patch 仅表示本轮差异。Xcode 项目与隐私资源由生成脚本重建，sources.json 额外记录这些生成文件的哈希；before 不是整个工作区备份。verification.json 和 sources.json 记录当前完成状态与哈希，不能解释为功能已上线。

## 本地界面

![本地测试中的播放器缓存关闭提示](</Volumes/Eva U disk/伊娃东方舞-开发工程/app开发/共享资料/同步更新/20261029-secure-vod-cache/iOS/evidence/cache-closed-fixture.png>)
