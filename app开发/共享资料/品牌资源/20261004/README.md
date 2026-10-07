# SWOD 黑曜石 Logo 资源

2026-10-04 使用提供的黑曜眼镜蛇 SWOD 徽标生成透明主图，并适配各平台图标。

- `SWOD-黑曜石-透明主图.png`：1254 × 1254 RGBA，无白底；主图保留透明通道。
- `logo-transparent-*.png`：透明尺寸版，用于站内品牌图。
- `app-icon-*.png`：浅灰底、居中安全留白，用于要求不透明的桌面图标。
- `app-icon-maskable-512.png`：保留圆形裁切安全区。
- `Android/`：密度对应的 launcher PNG、432 × 432 透明前景、adaptive-icon XML 与背景色、512 × 512 商店图。
- `HarmonyOS/base/media/`：桌面图标与透明 Logo，供后续工程按实际资源名接入。

iOS 已接入 `iOS/EvaDance/Resources/Assets.xcassets`，工程生成脚本包含 AppIcon 配置，登录页使用 BrandLogo；模拟器构建与实际打包图标检查通过。尚未签名、上传或提交商店审核。

Android、鸿蒙当前没有客户端源码，本目录是图标资源交付包，不表示客户端已发布。

官网及管理后台已上线更新：导航、登录、页脚、网页标签、PWA、分享、通知、启动图、证书和专属订单图生成器。小程序本地与服务器源码的登录及分享默认图已更新、WXML/WXSS 编译通过；尚未上传微信新版本，平台账号头像需要随发布核对。
