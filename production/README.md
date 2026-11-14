# 生产版本留存

本目录从生产服务器 `/www/wwwroot/dongfangwuquan/website` 读取官网源码、构建配置和公开静态资源，作为官网当前版本的 Git 来源。

- 最新留存日期：2026-11-14（Asia/Shanghai）。
- 官网代码：`production/website/`。原本地 `02-官方网站工程设计/官方网站/` 是独立仓库，不作为本次生产版本来源。
- 后台代码：`10-统一平台admin-platform/`，共有部署源码及公开资源按服务器现状同步；保留仓库中的测试及尚未部署的功能文件。本地此前的开发状态另有 Git 提交留存。
- 不收录环境变量、密钥、数据库、上传目录、依赖包和构建输出。
- 初始留存只读取代码；2026-11-14 已隔离构建并部署旧课程入口兼容、播放器课节时长与全屏状态修复。

线上构建标记：后台 `.next-build/BUILD_ID=4fhOjCOGG_jbul_ocb2CI`；官网 `.next/BUILD_ID=avC2tAiyYfHwQtfqElkZQ`。后台构建沿用原版本；官网本次隔离构建、预览验证后切换，保留针对性回滚版本。

`website-source.sha256` 和 `admin-source.sha256` 记录当前 1090 个官网文件、524 个后台文件的哈希（官网包含本次新增的兼容入口和课节时长回归测试及辅助函数）。在本目录分别运行 `shasum -a 256 -c website-source.sha256` 与 `shasum -a 256 -c admin-source.sha256` 可验证对应留存文件；清单不包含数据库、环境配置、依赖包或用户上传。
