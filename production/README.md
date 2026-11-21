# 生产版本留存

2026-11-21（Asia/Shanghai）从当前生产服务目录留存已部署的官网与后台源码。此次同步不重新构建，也不以旧 Git 代码覆盖线上。

- 官网：`production/website/`，生产构建标记 `.next/BUILD_ID=HQEF3EXE1qRs17CiI_oRl`。
- 后台：`10-统一平台admin-platform/`，生产构建标记 `.next-build/BUILD_ID=7DnkFxOSJrMYEABXeOMQP`。
- `website-source.sha256`（1102 个文件）和 `admin-source.sha256`（543 个文件）记录本次核对的生产源码及静态资源。于本目录运行 `shasum -a 256 -c website-source.sha256` 和 `shasum -a 256 -c admin-source.sha256` 可检查清单。
- 清单不包含数据库、用户上传、环境变量、密钥、依赖包及构建输出。其他本地范围未从生产取代，不用于证明已发布。构建标记仅记录生产当时运行版本，不等同于从此提交完成了可重复构建。
