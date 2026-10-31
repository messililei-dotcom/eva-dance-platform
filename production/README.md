# 生产版本留存

本目录从生产服务器 `/www/wwwroot/dongfangwuquan/website` 读取官网源码、构建配置和公开静态资源，作为官网当前版本的 Git 来源。

- 最新留存日期：2026-10-31（Asia/Shanghai）。
- 官网代码：`production/website/`。原本地 `02-官方网站工程设计/官方网站/` 是独立仓库，不作为本次生产版本来源。
- 后台代码：`10-统一平台admin-platform/`，共有部署源码及公开资源按服务器现状同步；保留仓库中的测试及尚未部署的功能文件。本地此前的开发状态另有 Git 提交留存。
- 不收录环境变量、密钥、数据库、上传目录、依赖包和构建输出。
- 本次只留存代码，不重建或重新部署线上服务。

线上构建标记：后台 `.next-build/BUILD_ID=BSQ1zKl4mazymO85cYaUX`；官网 `.next/BUILD_ID=2um_o-PpzKia2UqCnSO6u`。服务器现有源码与构建产物并非都有可验证的提交关联，此标记仅用于识别当前构建，不能替代可重复构建验证。

`website-source.sha256` 和 `admin-source.sha256` 记录本次从服务器只读取得的 1066 个官网文件、495 个后台文件的哈希。在本目录分别运行 `shasum -a 256 -c website-source.sha256` 与 `shasum -a 256 -c admin-source.sha256` 可验证对应留存文件；清单不包含数据库、环境配置、依赖包或用户上传。
