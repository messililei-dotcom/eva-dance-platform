import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, GraduationCap, Heart, Layers, Sparkles } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

const values = [
  {
    icon: Compass,
    title: '以埃风为根',
    desc: '从东方舞的身体律动、民俗风格、节奏审美出发，保留舞蹈本身的文化气质，而不是只追求动作堆叠。',
  },
  {
    icon: Layers,
    title: '以系统为骨',
    desc: '把呼吸、核心、胸腰、旋转、西米、甩发、手臂、编舞和教学法拆成可学习、可复盘、可传授的训练路径。',
  },
  {
    icon: Heart,
    title: '以表达为魂',
    desc: '东方舞不只是技巧训练，也关乎女性身体的觉察、情绪表达、舞台呈现与自信建立。',
  },
];

const systemItems = [
  '舞蹈运动呼吸学：让呼吸成为动作发力与表演气口的支点',
  '核心风暴与胸腰训练：建立柔韧、力量和控制并存的身体基础',
  '黄金陀螺、疯狂西米、甩发专攻：把高频技巧拆解为可训练的方法',
  '编舞师课程与成品舞专栏：从会跳一支舞走向会理解、会创作、会教学',
  'SWOD 融舞师资班与传承弟子班：把个人能力延展为课堂组织和教学表达',
];

const milestones = [
  { year: '起点', title: '从课堂经验沉淀为方法', desc: '围绕东方舞基础、技巧、音乐、舞感和教学法，逐步形成可复制的训练语言。' },
  { year: '体系', title: 'SWOD 课程系统成型', desc: '从线上录播到线下集训，把单点技巧扩展为完整学习路径。' },
  { year: '教材', title: '《东方舞技巧大全》', desc: '以教材和配套视频课承载核心技法，让学习者有章可循、有据可练。' },
  { year: '传承', title: '师资认证与弟子培养', desc: '通过师资班、弟子班和长期课程陪伴，支持学员从舞者成长为教师。' },
  { year: '融合', title: '成品舞与新现代融舞', desc: '从经典东方舞、Baladi、Khaleegy 到国风和情感主题作品，持续拓展舞台表达。' },
];

export default function AboutPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
              伊娃东方舞 · 把热爱训练成专业
            </h1>
            <p className="text-white/75 max-w-2xl mx-auto leading-relaxed">
              以埃及东方舞为根，以 SWOD 系统课程为骨架，连接线上学习、线下集训、师资认证与作品创作，陪伴学员从兴趣入门走向稳定表达和专业教学。
            </p>
          </ScrollAnimation>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <ScrollAnimation animation="slide-left">
              <div>
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                  我们相信
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-6">
                  好的东方舞教育，要同时照顾身体、审美和教学能力
                </h2>
                <div className="space-y-4 text-text-secondary leading-relaxed">
                  <p>
                    伊娃东方舞的课程不是把动作简单拆成“跟跳”，而是从身体如何发力、音乐如何推动动作、技巧如何进入舞感、作品如何服务表达这些问题开始，建立一套能长期成长的训练系统。
                  </p>
                  <p>
                    因此，课程体系从零基础入门、技巧专项、成品舞作品，到编舞、师资班和传承弟子班逐层展开。学员可以按自己的阶段进入，也可以沿着完整路径，从爱好者走向舞台表演者、课堂教师和作品创作者。
                  </p>
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="slide-right">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-crimson-dark via-crimson to-gold p-8 text-white shadow-xl">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-gold/20" />
                <div className="relative">
                  <p className="text-sm text-gold-light mb-3">Soul of Oriental Dance</p>
                  <h3 className="font-serif text-3xl font-bold mb-6">SWOD</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['身体觉察', '技巧系统', '音乐表达', '师资传承'].map((item) => (
                      <div key={item} className="rounded-xl border border-white/15 bg-white/10 px-4 py-5 backdrop-blur-sm">
                        <p className="font-serif text-lg font-bold">{item}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 text-sm leading-relaxed text-white/75">
                    从基础训练到作品创作，从个人舞台到课堂教学，把东方舞学习整理成一条可以持续走下去的成长路线。
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mt-14">
            {values.map((item, index) => (
              <ScrollAnimation key={item.title} delay={index * 120}>
                <div className="h-full bg-white rounded-2xl p-6 border border-sand/40 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-5">
                    <item.icon className="w-6 h-6 text-gold-dark" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-text mb-3">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{item.desc}</p>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-warm-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                SWOD 教学系统
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                从一个动作，到一套可传承的课堂
              </h2>
              <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
                已有课程资料呈现出清晰的训练逻辑：身体能力先行，技巧分层拆解，音乐与编舞跟进，最后进入教学法和师资表达。
              </p>
            </div>
          </ScrollAnimation>

          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-start">
            <ScrollAnimation animation="slide-left">
              <div className="bg-white rounded-2xl p-7 shadow-sm border border-sand/30">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-crimson/10 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-crimson" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-text">课程路径</h3>
                </div>
                <div className="space-y-4">
                  {systemItems.map((item) => (
                    <div key={item} className="flex gap-3 text-text-secondary leading-relaxed">
                      <Sparkles className="w-4 h-4 text-gold mt-1 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="slide-right">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-sand/30">
                  <BookOpen className="w-7 h-7 text-gold mb-4" />
                  <h3 className="font-serif text-xl font-bold text-text mb-3">教材与视频课</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    《东方舞技巧大全》及配套视频课承载核心技巧总纲、基本功、复合技巧、旋转、西米、甩发、舞感与教学法入门。
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-sand/30">
                  <Layers className="w-7 h-7 text-gold mb-4" />
                  <h3 className="font-serif text-xl font-bold text-text mb-3">线上线下闭环</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    线上课程适合反复练习和长期复盘，线下集训与师资班则强化现场纠正、课堂组织、模拟教学和结业考核。
                  </p>
                </div>
                <div className="sm:col-span-2 bg-gradient-to-br from-gold/10 to-crimson/5 rounded-2xl p-6 border border-gold/20">
                  <h3 className="font-serif text-xl font-bold text-text mb-3">品牌气质</h3>
                  <p className="text-text-secondary leading-relaxed">
                    伊娃东方舞的文化关键词，是“根脉、系统、表达、传承”。它既重视埃及东方舞的风格根源，也拥抱新现代融舞、国风作品和情感主题创作，让传统技法进入当代舞台语境。
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                成长脉络
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                从热爱到传承的五个阶段
              </h2>
            </div>
          </ScrollAnimation>

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gold/30 hidden md:block" />
            <div className="space-y-10">
              {milestones.map((item, index) => (
                <ScrollAnimation key={item.title} delay={index * 100}>
                  <div className="flex gap-6">
                    <div className="flex-shrink-0 w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center relative">
                      <span className="font-serif font-bold text-gold-dark">{item.year}</span>
                      <div className="absolute -right-2 w-4 h-4 bg-gold rounded-full hidden md:block" />
                    </div>
                    <div className="flex-1 bg-white md:bg-transparent rounded-2xl md:rounded-none p-5 md:p-0 shadow-sm md:shadow-none">
                      <h3 className="font-serif text-xl font-bold text-text mb-2">{item.title}</h3>
                      <p className="text-text-secondary leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </ScrollAnimation>
              ))}
            </div>
          </div>

          <ScrollAnimation>
            <div className="mt-14 text-center">
              <Link
                href="/about/brand-story"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold to-gold-dark text-white rounded-full font-medium hover:shadow-lg hover:shadow-gold/30 transition-all"
              >
                继续了解伊娃老师与教学体系 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </section>
    </div>
  );
}
