# 生产版本留存

2026-11-22（Asia/Shanghai）从当前生产实例目录同步官网和后台已经上线的源码。此次留存不重新构建，不以旧 Git 版本覆盖线上。

- 官网：`production/website/`；运行构建 `.next/BUILD_ID=jGqgGsPt-1o38G42US3Px`。
- 后台：`10-统一平台admin-platform/`；运行构建 `.next-build/BUILD_ID=VH4iLq4iQcxhxpCV5EEJP`。
- `website-source.sha256`（1102 个文件）和 `admin-source.sha256`（544 个文件）记录生产源码、构建配置及公开静态资源。于本目录运行 `shasum -a 256 -c website-source.sha256` 和 `shasum -a 256 -c admin-source.sha256` 可校验。
- 清单不包含数据库、环境变量、密钥、用户上传、依赖包及构建输出。其他本地开发内容不在此次同步范围。构建标记只用于识别线上实际版本，不表示本次从 Git 重新构建了服务。
