# AiwaRaks赛事管理平台

这是在不改动旧数据的前提下重塑的 AiwaRaks赛事管理平台原型。旧数据仍保留在 `../旧程序数据`，平台通过 `scripts/migrate_legacy.py` 读取 SQL 和 Excel，生成 `public/legacy-data.js` 作为只读迁移快照。

## 已承接的数据

- `software_cloud.sql`：赛事、组别、报名选手、评分规则、评委分组、评分记录、积分、后台账号。
- `db_api_vmp_20240121_032801_vuydtz.sql.gz`：旧版投票/赛事库，包含赛事、组别、报名、出场、评委、评分、短信和后台日志，迁移时按独立 ID 段合并到统一赛事快照。
- `产赛用户.xlsx`：产赛用户清单，按用户 ID 与 SQL 用户合并核验。
- `评委数据.xlsx`：评委清单，按手机号与 SQL 用户合并去重。
- `小程序mp-vote`：用于还原首页、报名、个人中心、评委打分、排行等业务入口。

## 运行

直接打开 `index.html` 即可查看。如果旧数据更新，重新生成快照：

```bash
/Users/lilei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/migrate_legacy.py
```

迁移脚本会保留原始表数据，同时在 `normalized` 业务视图中合并高置信重复数据。合并报告输出到 `public/legacy-dedupe-report.json`，包含合并前后数量、保留 ID、被合并 ID 和引用重定向数量。

去重后还会剔除无效赛事：必须同时具备组别、选手/报名和评分记录，才会进入新系统业务视图。

## 页面入口

- `index.html`：管理后台
- `mobile.html`：手机首页
- `mobile-events.html`：手机赛事列表
- `mobile-detail.html`：手机赛事详情
- `mobile-profile.html`：手机我的赛事历程
- `bigscreen.html`：赛事大屏
- 管理后台内置视图：数据看板、赛事、报名、场次组别、音乐审核、评分中枢、评委、证书财务、数据模型、增长、路线图、数据治理、核验

## 后续可扩展模块

- 管理端：赛事配置、组别编排、报名审核、出场顺序。
- 评委端：扫码绑定、组别授权、分项打分、提交锁定。
- 选手端：报名、音乐上传、缴费、成绩查询。
- 大屏端：实时排行、分组进度、获奖名单。
- 数据端：导入核验、异常手机号/重复选手/缺失评分提示。
