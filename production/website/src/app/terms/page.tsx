import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '用户与服务协议',
  description: '伊娃东方舞网站和数字化平台用户与服务协议。',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalDocument title="用户与服务协议" updatedAt="2026年7月25日">
      <section>
        <h2>一、账号使用</h2>
        <p>用户应使用本人手机号码和真实信息登录，不得出借、转售账号或绕过课程授权。因保管不当造成的账号风险应及时联系客服处理。</p>
      </section>
      <section>
        <h2>二、课程与内容</h2>
        <p>课程视频、讲义、音乐、图片和教学体系受知识产权保护，仅限获得授权的本人学习。未经书面许可，不得录制、下载、传播、改编或用于商业教学。</p>
      </section>
      <section>
        <h2>三、报名、订单与退款</h2>
        <p>课程时间、地点、费用和退款规则以报名页、订单说明及当期通知为准。线下课程可能因场地、师资或不可抗力调整，我们会及时通知并依法处理。</p>
      </section>
      <section>
        <h2>四、平台秩序</h2>
        <p>不得利用平台实施攻击、伪造身份、批量抓取、侵犯他人权益或其他违法行为。发现风险时，平台可采取验证身份、限制访问或暂停账号等必要措施。</p>
      </section>
      <section>
        <h2>五、协议更新</h2>
        <p>协议更新后会在本页面公布。重大变化将通过合理方式提醒用户。</p>
      </section>
    </LegalDocument>
  );
}
