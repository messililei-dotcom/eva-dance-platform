import type { Metadata } from 'next';
import LegalDocument from '@/components/LegalDocument';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '法律声明',
  description: '伊娃东方舞网站法律声明。',
  path: '/legal',
});

export default function LegalPage() {
  return (
    <LegalDocument title="法律声明" updatedAt="2026年7月25日">
      <section>
        <h2>知识产权</h2>
        <p>本网站所展示的品牌标识、课程体系、文字、图片、音视频及页面设计，除特别注明外，相关权利归伊娃东方舞或合法权利人所有。</p>
      </section>
      <section>
        <h2>内容使用</h2>
        <p>任何单位或个人未经许可，不得复制、转载、镜像、出售或用于商业培训。合理引用时应注明来源，不得歪曲或损害品牌及权利人权益。</p>
      </section>
      <section>
        <h2>第三方服务</h2>
        <p>网站可能使用微信、短信、云存储、视频点播和支付等第三方服务。相关服务同时适用其依法公布的规则。</p>
      </section>
      <section>
        <h2>侵权联系</h2>
        <p>如认为网站内容侵犯您的合法权益，请通过“联系我们”页面提交权利证明和具体链接，我们将依法核实处理。</p>
      </section>
    </LegalDocument>
  );
}
