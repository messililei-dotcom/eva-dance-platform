import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, MapPin, Users, Star, Sparkles,
  Trophy, Play, Heart, Music, Award, Globe
} from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

// Festival photos from the WeChat article
const festivalPhotos = [
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDf1prQ5Kl0Tw76iaysGOkkEThFvcGbUicnhNAcANibZtgpzmgBNc1wxlvQ/640?wx_fmt=jpeg',
    caption: '大赛发起人 - 伊娃老师',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDO2ibiaAFPB8KSyO9f3n9P11fv6PJVBpJulyqTXic1ibkickuTIsibBwVpcoA/640?wx_fmt=jpeg',
    caption: '舞台上的情感交融，两位舞者之间深刻的默契，仿佛是音符与舞蹈的完美交织',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDV9BwO2MkKx7WuDDAvHtC7CtdRM0mYFo6HaGYyDru0DxWnejXKpTGyQ/640?wx_fmt=jpeg',
    caption: '舞者如同风中起舞的羽毛，轻盈而令人着迷',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmD6ibPWeJUPeic9I1TA4KNb0CRgTQJAbNocfpuicTazS2oiavuy0CIajdbQQ/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmD79GpgLQ9pJNbkVCmQyCDlYeUjCjD50GqBaanfS0OTT7IIgx4TiauN1w/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDnXHcQs6bpSaD5WAI0f1BKaKk7s6UzuacDic2NWicrSGpzdbFCrqlk8qQ/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDQRKB5bFQdTQVDnaDwT21OTRbg2P5R2dv0SZwbtQq9wR61iczJlc3nMA/640?wx_fmt=jpeg',
    caption: '透过舞者的眼神，传达出无尽的激情和力量，仿佛一场视觉的情感交响曲',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDtfyKdBHJicA6WhuESb2p0ANynzjE8OcRmPDvB49zkw4GDibe1LhL11UA/640?wx_fmt=jpeg',
    caption: '舞者的动作如水流般流畅，每一个姿态都流露出优美的力量',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDI1NI97mGUCL5l3c4Eq7Oxrue9HnjibPViaZbH66hJYoT5FJX3kjjp05g/640?wx_fmt=jpeg',
    caption: '舞台上的瞬间定格了一段绝美的舞蹈，每个动作都是艺术的杰作',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDx0aiaZMibgH6jibicoBf5EXujlZm29cyz9Y5OAaV59s55cTRGvjEKicPXsw/640?wx_fmt=jpeg',
    caption: '舞者仿佛融入了音乐之中，她的优雅令人陶醉',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDY5BB8U8qmRVeORCMnVOgN6icsMtNLPGVVYJicXen6e3p0mqhKcbKiaODw/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDCNCDDicM4bc5maibRQW6TvOvBvgAZLfp3EA7PXOOjhDyxShw8SibzZThw/640?wx_fmt=jpeg',
    caption: '捕捉到了舞者瞬间的高度张力，令人印象深刻',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDzuJe4jibicQ0y4PcKXOCOI9LiaibOwHMuAmol99iaicoajynx3yPNic6WRPsA/640?wx_fmt=jpeg',
    caption: '舞台上的光影与舞者的动作完美融合，展现出一幅神秘而动人的画面',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDia4kuGt8r8ydxfYMYqggxW2golsTEsKQ4Rib8kRXojY9t3Vkcmdz6qibA/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDRzzaeRSCAvZyfiawfsXCnzyIsU4BIKWgnLtEtiaXbKIPLy9ZoibjFiclvA/640?wx_fmt=jpeg',
    caption: '舞者在灯光照耀下的舞台上翩翩起舞，每一个动作都洋溢着灵气',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmD2ddrq6T85J69U0FibWS4gHjVkr8FEDtTiaEyRldjaT0G4Rzp9ice3SQWA/640?wx_fmt=jpeg',
    caption: '舞步仿佛融入了音乐的旋律，优雅令人感受到音符的魔力',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDoL1u3Z5O3g8dia5ROMSNeW7RZHFLFUazMoCj4EEicCrYOZicib49CvPX1Q/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDXqlKTVpCpN9j3LWMibOhbsicia7U8za5mqUlfiaUSxhSzzZb1aiaU8Oroiaw/640?wx_fmt=jpeg',
    caption: '捕捉到了舞者瞬间的高度张力和情感，让人心驰神往',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDDeIS2pA6RBdrYEUHBfrdU5U5ZCJ2LWBdVU2pomQ59ABzt6VMGdVlOw/640?wx_fmt=jpeg',
    caption: '每一个动作都传递出激情和力量，表演令人感到无比震撼',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDZB3LELGVMIYzaCR873uVx3ibEGb01xGKjLjIsnLC6zLicwdXWMICJKBw/640?wx_fmt=jpeg',
    caption: '一段令人陶醉的舞蹈，舞者的动作流畅而自如',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDw3sWCibtOeRD41OvOxPhe7CjnjrECnDI4VOiaGozoQCKQGa6JdfOOrvA/640?wx_fmt=jpeg',
    caption: '舞台上的瞬间凝固成一幅绝美画卷，每个动作都充满了情感',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDQKuQK9ic4iad8MgRRo2epVXUwXtiaJmYgDPWQjpvvqzJuqXLsA24xN3Vw/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDCka2ZFe8BvhZxMOS8fA8AFCWnMcfp53ibsKFhibnzE2FKSjiaRwrg3Bbg/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDnticEojcJwBUZwSCWI1pXMcA5vbuFvVDR2h5ZvPwLp6eKcv5MV8jbow/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDSmsdn9lUAKrmDxUEB9txUSwdqtzR1td0vH7mHpTHE5mYfW0Rc5lsVw/640?wx_fmt=jpeg',
    caption: '',
  },
  {
    src: 'https://mmbiz.qpic.cn/mmbiz_jpg/JcKRBGv6ZAPn0ROtyAfzXxDvIF21XXmDnxLQgcRNBBDiaHiaReiaFw0mx1fP4iayfAdDgpt5O25huSyHbfcxNwbAAw/640?wx_fmt=jpeg',
    caption: '',
  },
];

// Performance videos
const performances = [
  {
    title: '第三届 AiwaAiwaRaks 艺术节精彩集锦',
    desc: '近300位舞者同台竞技，精彩纷呈',
    type: 'highlight',
  },
  {
    title: '开幕式表演 — Mejance 纱巾开场舞',
    desc: '伊娃老师编舞，明星舞团携手出演，震撼大气，氛围感拉满',
    type: 'opening',
  },
  {
    title: '原创编舞《敦煌》',
    desc: '伊娃老师弟子团队携手出演，融合中国古典舞元素',
    type: 'dance',
  },
  {
    title: '压轴节目 — Baladi 创新演绎',
    desc: '伊娃、孙振桓两位老师及弟子团队共同演绎，中国著名鼓手现场伴奏',
    type: 'finale',
  },
];

const festivalStats = [
  { icon: Users, value: '近300位', label: '优秀舞者参赛' },
  { icon: MapPin, value: '全国', label: '各省市舞者汇聚' },
  { icon: Calendar, value: '3天', label: '精彩赛事' },
  { icon: Star, value: '第三届', label: '国际东方舞艺术节' },
];

export default function FestivalPage() {
  return (
    <div className="min-h-screen bg-warm-white pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-purple-900 via-indigo-900 to-gold-dark text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(200,169,110,0.4),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(139,26,26,0.3),transparent_50%)]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <ScrollAnimation>
            <div className="text-center">
              {/* Badge */}
              <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm text-white text-sm font-medium rounded-full mb-6 border border-white/20">
                <Globe className="w-4 h-4 inline mr-2" />
                AiwaAiwaRaks 国际东方舞艺术节
              </span>

              {/* Title */}
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                第三届 AiwaAiwaRaks
                <br />
                <span className="text-gold">国际东方舞艺术节</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto mb-8 leading-relaxed">
                2023年8月11日-13日 · 湖南长沙
              </p>
              <p className="text-white/60 max-w-2xl mx-auto mb-10">
                AiwaAiwaRaks 名字起于——埃及大师 Ahmed Refaat
              </p>

              {/* Info Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-10">
                {festivalStats.map((stat, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <stat.icon className="w-6 h-6 text-gold mx-auto mb-2" />
                    <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-white/60">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Organizer */}
              <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-full px-6 py-3 border border-white/10">
                <Trophy className="w-5 h-5 text-gold" />
                <span className="text-white/80">主办机构：<span className="text-white font-semibold">伊娃东方舞国际学院</span></span>
              </div>
            </div>
          </ScrollAnimation>
        </div>

        {/* Decorative */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-warm-white to-transparent" />
      </section>

      {/* Festival Description */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                大赛回顾
              </h2>
              <div className="w-16 h-1 bg-gold mx-auto mb-6" />
              <p className="text-text-secondary text-lg leading-relaxed max-w-3xl mx-auto">
                在2023年的一个闪耀夏日，我们迎来了空前盛大的第三届AiwaAiwaRaks东方舞艺术节。
                本场赛事吸引了近300位来自全国各地的优秀舞者参加。
                这场舞蹈比赛带给我们视觉和情感上的双重盛宴。
                每一张照片都是一个故事的开始，每一个瞬间都是才华和激情的体现。
              </p>
            </div>
          </ScrollAnimation>

          {/* Organizer Quote */}
          <ScrollAnimation>
            <div className="bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 rounded-2xl p-8 md:p-12 border border-gold/20 mb-16">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gold/20 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="font-serif font-bold text-lg text-text">大赛发起人</p>
                  <p className="text-text-secondary">伊娃老师</p>
                </div>
              </div>
              <blockquote className="text-text-secondary italic leading-relaxed border-l-4 border-gold pl-4">
                &ldquo;这场舞蹈比赛带给我们视觉和情感上的双重盛宴。每一张照片都是一个故事的开始，
                每一个瞬间都是才华和激情的体现。我们期待着未来的舞蹈活动，
                让我们再次陶醉于舞台之上的美丽瞬间。&rdquo;
              </blockquote>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Photo Gallery */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                <Star className="w-4 h-4 inline mr-2" />
                精彩瞬间
              </span>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                30张令人陶醉的瞬间
              </h2>
              <p className="text-text-secondary max-w-2xl mx-auto">
                带您深入欣赏这场比赛中的精彩瞬间
              </p>
            </div>
          </ScrollAnimation>

          {/* Photo Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {festivalPhotos.map((photo, index) => (
              <ScrollAnimation key={index} delay={Math.min(index * 50, 500)}>
                <div className="break-inside-avoid group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                  <Image
                    src={photo.src}
                    alt={photo.caption || "AiwaAiwaRaks 东方舞艺术节"}
                    width={800}
                    height={1000}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                  {photo.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-xs leading-relaxed">{photo.caption}</p>
                    </div>
                  )}
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* Performances */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-warm-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-full mb-4">
                <Music className="w-4 h-4 inline mr-2" />
                精彩演出
              </span>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                艺术节演出亮点
              </h2>
              <p className="text-text-secondary max-w-2xl mx-auto">
                从开幕式到压轴节目，每一场演出都是视觉与听觉的盛宴
              </p>
            </div>
          </ScrollAnimation>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {performances.map((perf, index) => (
              <ScrollAnimation key={index} delay={index * 100}>
                <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 border border-sand/20 group">
                  {/* Video Placeholder */}
                  <div className="relative aspect-video bg-gradient-to-br from-purple-900/20 to-gold/20 flex items-center justify-center">
                    <div className="w-16 h-16 bg-gold/80 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-6">
                    <h3 className="font-serif font-bold text-lg text-text mb-2">
                      {perf.title}
                    </h3>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {perf.desc}
                    </p>
                  </div>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-900 via-indigo-800 to-gold-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <Heart className="w-12 h-12 text-gold mx-auto mb-6" />
            <h2 className="font-serif text-2xl md:text-3xl font-bold mb-4">
              2024，我们再次相聚
            </h2>
            <p className="text-lg text-white/80 mb-8">
              感谢大家的支持！AiwaAiwaRaks 国际东方舞艺术节期待与您再次相遇
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="tel:400-XXX-XXXX"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gold text-white font-semibold rounded-full hover:bg-gold/90 transition-colors"
              >
                商务合作咨询
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-colors"
              >
                联系我们
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Back to Home */}
      <section className="py-12 bg-white border-t border-sand/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gold-dark font-medium hover:text-gold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </section>
    </div>
  );
}
