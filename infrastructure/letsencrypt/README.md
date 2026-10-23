# CDN 证书续期同步

生产部署位置：

- `eva-aliyun-rpc.js` → `/usr/local/sbin/eva-aliyun-rpc.js`（保留既有命令行参数格式，额外支持参数 `-` 从 stdin 读取 JSON）
- `eva-certbot-cdn-deploy.cjs` → `/usr/local/sbin/eva-certbot-cdn-deploy.cjs`
- `30-eva-cdn-sync` → `/etc/letsencrypt/renewal-hooks/deploy/30-eva-cdn-sync`

文件由 root 管理，权限 0700。Certbot 成功续期后调用 deploy hook。仅处理 `/etc/letsencrypt/live/swod-wildcard`；其他证书直接跳过。证书与密钥在服务器内读取，不存入仓库。

执行前检查通配符域名覆盖、证书与私钥匹配以及至少 14 天剩余有效期。CDN 目标为 `.swod.com.cn`，API 密钥继续取自既有 PM2 环境；证书材料通过 stdin 传递，不出现在进程参数中。更新后核对 CDN 返回的证书名称与到期日，出错返回非零退出码供 Certbot/systemd 记录。

验证当前证书（不写 CDN）：

```sh
RENEWED_LINEAGE=/etc/letsencrypt/live/swod-wildcard /usr/bin/node /usr/local/sbin/eva-certbot-cdn-deploy.cjs --check
```

本地测试：`node --test infrastructure/letsencrypt/cdn-deploy.test.cjs`（需要 OpenSSL；临时测试密钥运行后删除）。

2026-09-29 已完成一次实际同步，官网公网证书到期时间为 2026-12-22 01:44:12 UTC。本机、云服务器公网握手与 CDN API 均已验证。定时续期任务仍使用既有 certbot.timer，没有增加重复定时任务，也没有触发额外 ACME 签发。

服务器旧 RPC 文件备份：`/root/ops-backups/20260929-stream-tls/eva-aliyun-rpc.js`。原 `eva-certbot-aliyun-deploy.sh` 未挂接，不用于本次新钩子。本次只同步 CDN，未修改点播域名的独立证书配置。

## 点播域名同步（2026-10-23）

`vod.swod.com.cn` 使用独立的 VOD 证书配置。仅调用 CDN 的证书更新接口不会更新点播域名。2026-10-23 09:11（北京时间），其旧证书到期，导致视频清单及分片请求出现 `CERT_HAS_EXPIRED`。

新增 `eva-certbot-vod-deploy.cjs`，安装到 `/usr/local/sbin/`；`40-eva-vod-sync` 安装到 `/etc/letsencrypt/renewal-hooks/deploy/`，两者权限 0700。沿用通配符证书，调用上海区域 `SetVodDomainCertificate`，密钥仅经 stdin 传递。更新前后通过启用证书校验的公网 TLS 握手比较指纹与有效期；证书已同步时跳过重复上传。

这两个同步钩子各自独立，Certbot 续期后均执行，不增加重复 ACME 签发。单独验证：

```sh
RENEWED_LINEAGE=/etc/letsencrypt/live/swod-wildcard /usr/bin/node /usr/local/sbin/eva-certbot-vod-deploy.cjs --check
node --test infrastructure/letsencrypt/cdn-deploy.test.cjs infrastructure/letsencrypt/vod-deploy.test.cjs
```
