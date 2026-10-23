import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';

const customerServiceQRCodes = [
  {
    name: 'Monica 海艳',
    src: '/images/contact/wechat-monica-haiyan.jpg',
  },
  {
    name: 'Elin 伊琳',
    src: '/images/contact/wechat-elin-yilin.jpg',
  },
];

const serviceButtons = [
  { label: '微信客服', icon: MessageCircle, href: '/contact#wechat' },
  { label: '课程咨询', icon: BookOpen, href: '/contact#contact-form' },
  { label: '商务合作', icon: Mail, href: '/contact#business' },
  { label: '免费咨询报名', icon: Send, href: '/enroll' },
];

export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-white/80">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-7 md:grid-cols-3 lg:grid-cols-7 lg:gap-6">
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="mb-4 inline-flex items-center gap-2" aria-label="返回伊娃东方舞首页">
              <Image
                src="/logo-transparent-20261005.png"
                alt="伊娃东方舞"
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
              />
              <span className="font-serif font-bold text-lg text-gold">伊娃东方舞</span>
            </Link>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              专注东方舞师资培训<br/>十二年匠心传承
            </p>
            <div className="flex flex-wrap gap-2">
              {serviceButtons.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-gold hover:text-[#1A1A1A]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-serif font-semibold text-white mb-4 text-sm">品牌与内容</h3>
            <ul className="space-y-2.5">
              {[
                ['品牌故事', '/about/brand-story'],
                ['教材与出版', '/about/publications'],
                ['学员风采', '/about/students'],
                ['东方舞圈', '/dance-circle'],
                ['合作伙伴', '/about/partners'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-xs hover:text-gold transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gold/30" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif font-semibold text-white mb-4 text-sm">学习与培训</h3>
            <ul className="space-y-2.5">
              {[
                ['线上课程', '/courses'],
                ['线下培训', '/offline'],
                ['课程日历', '/offline/schedule'],
                ['师资认证', '/certification'],
                ['传承弟子', '/disciples'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-xs hover:text-gold transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gold/30" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif font-semibold text-white mb-4 text-sm">服务与支持</h3>
            <ul className="space-y-2.5">
              {[
                ['学员中心', '/dashboard/profile'],
                ['我的课程', '/my-courses'],
                ['我的证书', '/dashboard/certificates'],
                ['学习进度', '/dashboard/progress'],
                ['线下课表', '/dashboard/offline-schedule'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-xs hover:text-gold transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gold/30" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif font-semibold text-white mb-4 text-sm">快捷链接</h3>
            <ul className="space-y-2.5">
              {[
                ['关于我们', '/about'],
                ['赛事平台', '/events'],
                ['国际艺术节', '/festival'],
                ['伊娃甄选', '/shop/selection'],
                ['联系我们', '/contact'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-xs hover:text-gold transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-gold/30" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <h3 className="font-serif font-semibold text-white mb-4 text-sm">客服微信</h3>
            <div className="grid max-w-xs grid-cols-2 gap-3 md:max-w-none md:gap-4">
              {customerServiceQRCodes.map((qr) => (
                <div key={qr.name} className="text-center">
                  <div className="mb-2 overflow-hidden rounded-lg bg-white">
                    <Image
                      src={qr.src}
                      alt={`${qr.name}老师微信二维码`}
                      width={320}
                      height={426}
                      className="aspect-[3/4] w-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-white/60">{qr.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-xs text-white/40">
                © 2026 伊娃东方舞 · 东方舞圈 版权所有
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-white/30 md:justify-start md:gap-3">
                <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
                  湘ICP备2024045642号
                </a>
                <span>|</span>
                <span>出版物经营许可证：新出发长天字第4301032025027号</span>
                <span>|</span>
                <a
                  href="https://beian.mps.gov.cn/#/query/webSearch?code=43010302002376"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 transition-colors hover:text-gold"
                  aria-label="查询公安联网备案：湘公网安备43010302002376号"
                >
                  <Image
                    src="/images/licenses/gongan-beian.png"
                    alt=""
                    width={18}
                    height={20}
                    className="h-4 w-auto"
                  />
                  湘公网安备43010302002376号
                </a>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 text-xs text-white/30 md:justify-end md:gap-4">
              <Link href="/legal" className="hover:text-gold transition-colors">法律声明</Link>
              <Link href="/terms" className="hover:text-gold transition-colors">用户协议</Link>
              <Link href="/privacy" className="hover:text-gold transition-colors">隐私政策</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
