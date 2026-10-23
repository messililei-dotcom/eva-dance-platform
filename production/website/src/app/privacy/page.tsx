import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '隐私政策',
  description: '伊娃东方舞网站和数字化平台隐私政策。',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalDocument title="隐私政策" updatedAt="2026年7月25日">
      <section>
        <h2>一、我们收集的信息</h2>
        <p>在您报名、登录、学习或联系客服时，我们可能收集姓名、手机号码、微信公开资料、课程授权、学习进度、报名和证书信息。支付由相应支付机构处理，我们仅保存完成业务所必需的订单记录。</p>
      </section>
      <section>
        <h2>二、信息使用目的</h2>
        <ul>
          <li>完成账号登录、课程授权、学习记录和证书服务；</li>
          <li>处理报名、赛事、售后和客户咨询；</li>
          <li>保障账号、平台和数据安全；</li>
          <li>履行法律法规要求。</li>
        </ul>
      </section>
      <section>
        <h2>三、信息保存与保护</h2>
        <p>我们仅在实现业务目的所需的期限内保存信息，并采取访问控制、HTTPS、备份和日志审计等措施保护数据。未经授权，我们不会公开出售个人信息。</p>
      </section>
      <section>
        <h2>四、您的权利</h2>
        <p>您可以通过“联系我们”页面申请查询、更正或删除个人资料，或申请注销账号。涉及课程、财务或法律留存义务的记录，将按照法律规定处理。</p>
      </section>
      <section>
        <h2>五、联系我们</h2>
        <p>如对本政策有疑问，请通过网站“联系我们”页面中的客服微信与我们联系。</p>
      </section>
    </LegalDocument>
  );
}
