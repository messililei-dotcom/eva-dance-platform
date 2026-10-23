import Link from 'next/link';
import { BookOpen, Video, Users, ArrowRight, Layers, Activity, Sparkles, Route } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';

const courseSystems = [
  {
    title: '录播系统课',
    desc: '围绕呼吸、核心、胸腰、旋转、西米、甩发、手臂和编舞建立可重复练习的视频训练路径。',
    icon: Video,
    color: 'from-gold to-gold-dark',
    size: 'large',
    href: '/courses',
  },
  {
    title: '直播大师课',
    desc: '在直播中拆解发力、气口、音乐处理和常见错误，让线上学习也能持续纠偏。',
    icon: Users,
    color: 'from-crimson to-crimson-light',
    size: 'medium',
    href: '/courses',
  },
  {
    title: '师资认证集训营',
    desc: '从个人训练推进到课堂组织、动作分解、模拟教学和结业考核，完成教师能力转化。',
    icon: BookOpen,
    color: 'from-gold-dark to-crimson-dark',
    size: 'medium',
    href: '/offline',
  },
];

const systemHighlights = [
  { icon: Activity, title: '身体能力', desc: '呼吸、核心、肌肉控制、稳定性和重心，解决身体不会用的问题。' },
  { icon: Layers, title: '技巧结构', desc: '胯部、西米、胸腰、旋转、甩发、手臂和步伐，按发力链条系统训练。' },
  { icon: Sparkles, title: '舞台表达', desc: '头部、眼神、五感、起范、空间和情绪，让技巧进入音乐与作品。' },
  { icon: Route, title: '成长路径', desc: '从零基础到作品、编舞、教学和传承弟子，避免碎片化学习。' },
];

export default function CourseSystemSection() {
  const [large, medium1, medium2] = courseSystems;

  return (
    <section className="py-10 md:py-14 bg-warm-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            number="04"
            icon={Layers}
            badge="课程体系"
            title="全方位课程体系"
            subtitle="以18个专业体系为底层知识库，把身体开发、技巧训练、舞台表达、编舞创作和教学转化串成一条清晰路径。"
          />
        </ScrollAnimation>

        {/* Verge-style Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Large Card */}
          <ScrollAnimation animation="slide-left">
            <div className={`lg:col-span-1 lg:row-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br ${large.color} p-8 min-h-[300px] lg:min-h-[560px] flex flex-col justify-between group cursor-pointer`}>
              <div>
                <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-xl mb-6">
                  <large.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-serif text-2xl md:text-3xl font-bold text-white mb-3">{large.title}</h3>
                <p className="text-white/80 text-sm leading-relaxed mb-6">{large.desc}</p>
              </div>
              <Link href={large.href} className="inline-flex items-center gap-2 text-white font-medium group-hover:gap-3 transition-all">
                了解更多 <ArrowRight className="w-5 h-5" />
              </Link>
              {/* Decorative */}
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full" />
            </div>
          </ScrollAnimation>

          {/* Medium Cards */}
          <ScrollAnimation delay={150} animation="fade-in-up">
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${medium1.color} p-6 min-h-[180px] flex flex-col justify-between group cursor-pointer`}>
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
                <medium1.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-white mb-2">{medium1.title}</h3>
                <p className="text-white/80 text-sm">{medium1.desc}</p>
              </div>
              <Link href={medium1.href} className="mt-4 inline-flex items-center gap-1 text-white/80 text-sm font-medium group-hover:gap-2 group-hover:text-white transition-all">
                了解更多 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300} animation="fade-in-up">
            <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${medium2.color} p-6 min-h-[180px] flex flex-col justify-between group cursor-pointer`}>
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
                <medium2.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-bold text-white mb-2">{medium2.title}</h3>
                <p className="text-white/80 text-sm">{medium2.desc}</p>
              </div>
              <Link href={medium2.href} className="mt-4 inline-flex items-center gap-1 text-white/80 text-sm font-medium group-hover:gap-2 group-hover:text-white transition-all">
                了解更多 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollAnimation>
        </div>

        <ScrollAnimation delay={200}>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemHighlights.map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-5 border border-sand/30 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-gold-dark" />
                </div>
                <h3 className="font-serif text-lg font-bold text-text mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
