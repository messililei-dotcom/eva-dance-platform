# 视频播放与生产状态复检（2026-10-23）

## 故障与修复

- 修复前：`vod.swod.com.cn` 公网证书 `notAfter=Oct 23 01:11:06 2026 GMT`，北京时间 09:11:06 到期。服务器 Node fetch 返回 `CERT_HAS_EXPIRED`，1933 个已关联课程的视频素材检查失败。
- 将服务器已有 `/etc/letsencrypt/live/swod-wildcard` 有效证书经 VOD 的 `SetVodDomainCertificate` 同步到点播域名。
- 修复后公网证书到期时间：`2026-12-22T01:44:12Z`；TLS 校验恢复。
- 增加独立的 `40-eva-vod-sync` Certbot deploy hook，避免只更新官网 CDN 而遗漏 VOD。11 项 CDN/VOD 测试通过。
- 官方接口依据：https://api.aliyun.com/document/vod/2017-03-21/SetVodDomainCertificate 。

## 播放验证

- 执行服务器现有 `node scripts/audit-course-videos.cjs`，覆盖 1935 个视频类素材和 2129 个课节关联。
- 修复后 1933 个已关联素材的 HLS 清单及首个分片检查通过，课程关联缺失数量 0。
- 素材 2503、2504 无可播放转码流，但没有关联课节；保留素材，未修改数据。
- 使用 FFmpeg 对素材 1449、1410、1560、1611 的 HLS 地址实际解码，4 项退出码均为 0。
- 未登录访问官网 `/api/learn/video/1/play` 返回 401，鉴权未被绕过。
- 未完成带登录会话的浏览器端到端播放；本次证据覆盖 TLS、HLS 清单、首分片及四个样本解码。

## 服务、备份与版本

- 官网首页、后台登录页及公开课程接口 HTTPS 请求均为 200。
- 最新自动数据库备份：2026-10-23 03:35:04 +08:00；SHA-256、gzip 解压和 SQLite quick_check 均通过，132 张表；06:00 自动健康检查成功。
- 源码比较基线：GitHub `3d214abe9fb6bb3150ed8a677c50ad961e970747`。
- 官网 936 个源码及公开资源文件全部与 GitHub 相同。
- 后台比较 483 个共有文件，源码无差异；唯一共有文件差异是 `public/payments/yiwa-unified-collection-v1.jpg`。本次不修改支付资源。
- 仓库中的 `src/app/api/event/entry-summary/route.ts` 尚未部署，另有 7 个测试文件未上传服务器。因此不能将整个仓库与部署目录宣称为逐文件完全一致。
- 本次新增基础设施文件已同步到 `/usr/local/sbin/eva-certbot-vod-deploy.cjs` 与 `/etc/letsencrypt/renewal-hooks/deploy/40-eva-vod-sync`，业务服务无需重新构建或重启。
