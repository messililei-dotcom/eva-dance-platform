# 奖金提成升级：本地开发交付

状态：已部署并完成线上页面及接口核验（2026-10-13）。所有预览登记、审核、发放操作只写入 `/tmp/eva-bonus-validation.db`，不使用生产数据。

## 实现范围

- 新版月度结算：线上提成、线下提成、商品团队提成、课时费、正负调整、应发总额；审核与发放独立展示和筛选。
- 左侧人员结算，右侧选中人员明细；保留课程明细、历史汇总及原有Excel导出。
- 商品：订单实收只计一次；按渠道、店铺、订单号去重更新；默认25%，单笔偏离默认需原因；线下编号自动生成；固定归属依琳。
- 商品Excel：模板下载、文件预览、人工核对后导入；每批最多500条；任何一行失败整批回滚；已确认和历史已结清月份不覆盖。
- 课时：后台从登录账号记录授课和归属人；按整数节数计费；不同单价分行；同班级、日期、时段重复登记必须核对并填写原因。
- 标准：管理员设置商品比例、可选课时单价及今天/未来生效日期；按销售或上课日期匹配；不重新计算历史记录。
- 调整：仅管理员可登记，有正负金额和必填原因；支持尚无其他记录的新月份。
- 审核：保存完整金额与明细快照；服务器核对当前明细与页面显示一致；源数据后来修改不改变确认单。
- 发放：必须先确认，并填写实际发放日期及凭证说明/流水编号；根据快照生成一笔财务支出；重复请求不重复记账。
- 日志：新增、更新、删除、移动归属、标准、审核、发放均保留操作人、时间和明细。
- 导出：本月全部或当前筛选结算单，含“月度结算”和“结算明细”两张表；金额保持数值，文本保持文本。
- 手机：双列指标、单列详情，表格在容器内横向滚动。

## 保留与待定

课程提成采用现有保存金额和原比例算法。新版月度结算排除“伊娃老师/伊娃”的课程提成；历史已结清记录保留旧状态，不补记支出，不伪造历史确认快照。旧课程页不再提供一键结清，统一使用新版审核/发放入口。已确认的新结算也禁止旧结清API改写。

退款扣回、运费和平台扣费、收款月/完成月尚未确定。商品实收计提基数及结算月份由登记/导入人员核对并确认，不自动推断；退款/取消订单暂拒绝计提，不自动执行扣回。凭证目前为说明/流水编号，未增加图片附件上传。

商品收款归属按确认草案使用“依琳”文字；未自动合并历史“伊琳”记录，也未猜测绑定到哪个人员账号。上线前应核对正式姓名与账号。

## 数据与兼容

首次使用时在现有管理数据库增建 BonusEntry、BonusOrderKey、BonusMonthly、BonusStandard、BonusAudit。无历史批量回填或数据删除。审核复用 CommissionSettlement 的课程锁定状态，但不生成支出；发放才生成 FinanceExpense。查看权限复用缴费查看权限；普通登记复用创建/编辑/删除权限，标准、调整、审核、发放仅管理员可操作。

本次开始时奖金提成页面已有未提交的导出改动，原文件已保存在 bonus-page-before.tsx.txt；课程明细和导出继续保留在 src/components/course-commission-details.tsx。工程中其他并行改动未纳入本次交付。

## 验证

- `node --test tests/bonus-management.test.mjs tests/commission-export.test.mjs`：14项通过。
- 最终Next生产构建通过，包括TypeScript、页面生成及构建追踪。
- 本机为ARM，已有依赖是x64；仅在本地node_modules补齐SWC、Lightning CSS、Tailwind Oxide及SQLite对应运行依赖，未修改package.json和锁文件。
- 原目录存在已不存在路由的旧Next生成类型；隔离构建临时只使用本次生成的类型，构建后还原tsconfig.json。生产常规构建应重新生成自己的构建目录。
- ESLint未发现错误；宽泛any等警告按仓库现行规则保留。
- 旧 tests/bonus-commission.test.mjs 中3项因测试加载器缺少 authorization-revenue 模块而失败；未更改其他任务的授权财务模块或旧测试预期。新专项测试实际验证旧结清接口的读写兼容、重复记账及撤销，以及新确认快照的409保护。
- 浏览器验证、实际下载读回及页面截图见 verification.json 和 PNG 文件。截图使用明确的隔离预览数据。

## 本次源文件

- src/app/(admin)/bonus-commission/page.tsx
- src/app/(admin)/bonus-commission/settlement.module.css
- src/app/api/bonus-management/route.ts
- src/app/api/commission-settlements/route.ts（新增快照保护）
- src/components/course-commission-details.tsx
- src/lib/server/bonus-management.ts
- src/lib/bonus-export.ts
- tests/bonus-management.test.mjs

上线记录见工程 ops/20261013-bonus-management/deployment.json。线上仅增建5张结算表，未新增真实登记、审核或发放。数据库备份及旧构建保存在 /www/backups/dongfangwuquan/bonus-management-20261013-v1。


Follow-up: salary, reimbursement, detail sorting/pagination and account-specific review/payout permissions deployed on 2026-10-13. See ops/20261013-bonus-review-v2/deployment.json for the latest verification.
