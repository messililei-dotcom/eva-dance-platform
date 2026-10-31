import policy from '@/content/children-privacy.json';

export default function ChildrenPrivacyNotice() {
  return (
    <section id="children-privacy" aria-labelledby="children-privacy-title">
      <h2 id="children-privacy-title">儿童个人信息保护规则</h2>
      <p>{policy.scope}</p>
      <p><a href="/app/children-privacy.html" className="underline underline-offset-4">阅读完整儿童规则与监护人授权说明（{policy.updatedAt}）</a></p>
      <p>儿童隐私负责人李雷：13548955558，13548955558@qq.com。儿童注册或报名须先由客服核实监护人授权并登记，普通登录勾选不能替代该核验。必要处理与可选公开展示分别征得同意；监护人可拒绝、撤回或申请查阅、更正、删除。账号注销在7个工作日内处理并通知结果。授权核验完成前，请勿自行提交儿童资料。</p>
      <p>平台按最小必要范围处理儿童账号、学习和参赛资料，不用于营销。姓名、成绩、照片或视频的公开展示需另行说明并取得监护人明确同意；全球发行不等于向境外提供儿童资料。详细字段、保存地点、期限、保护措施和权利申请方式见完整规则。</p>
    </section>
  );
}
