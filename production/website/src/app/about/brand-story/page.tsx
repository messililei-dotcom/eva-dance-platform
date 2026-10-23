import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Music2, PenTool, Sparkles, Users } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

const teachingBeliefs = [
  '动作要讲清发力点：从呼吸、核心、肌肉链和重心转移解释动作，而不是只要求学员模仿外形。',
  '技巧要能进入舞感：旋转、西米、甩发、胸腰和手臂都要服务音乐、情绪与舞台画面。',
  '学习要能被复盘：线上视频、训练模块、课堂带练和线下纠正共同形成可重复练习的路径。',
  '教师要能讲给别人听：师资班强调动作分解、课堂组织、音乐理解、模拟教学和考核。',
];

const coursePillars = [
  { title: '身体基础', items: ['舞蹈运动呼吸学', '核心风暴·全力出肌', 'S曲线·胸腰舞感'] },
  { title: '技巧专项', items: ['黄金陀螺旋转训练', '疯狂西米', '甩发专攻', '手臂全维度精雕'] },
  { title: '作品表达', items: ['18支全风格舞蹈', 'Baladi 与 Khaleegy', '国风与新现代融舞'] },
  { title: '教师成长', items: ['东方舞技巧大全', '亲传教练班 SWOD', 'SWOD 融舞师资班', '传承弟子班'] },
];

const bookHighlights = [
  '东方舞核心技巧总纲',
  '基本功系统训练',
  '复合技巧进阶',
  '旋转与平衡技巧',
  '西米与甩发技巧系统',
  '舞感表现力与教学法入门',
];

export default function BrandStoryPage() {
  return (
    <div>
      <section className="bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-4">
              品牌故事
            </span>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
              伊娃老师与 SWOD 东方舞教学系统
            </h1>
            <p className="text-white/75 max-w-2xl mx-auto leading-relaxed">
              从东方舞技巧、身体训练、音乐编舞到师资认证，伊娃东方舞用一套清晰的课程语言，让学员知道自己为什么练、如何练、如何表达、如何教学。
            </p>
          </ScrollAnimation>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
            <ScrollAnimation animation="slide-left">
              <div className="rounded-2xl bg-white p-6 shadow-xl border border-sand/30">
                <div className="rounded-xl bg-gradient-to-br from-gold/20 via-warm-white to-crimson/10 p-7">
                  <p className="text-sm font-medium text-gold-dark mb-3">教学系统关键词</p>
                  <h3 className="font-serif text-3xl font-bold text-text mb-6">练得明白，跳得动人，教得清楚</h3>
                  <div className="space-y-3">
                    {['从发力点理解动作', '从节奏理解舞感', '从作品理解表达', '从课堂理解传承'].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-3">
                        <CheckCircle2 className="h-5 w-5 text-gold" />
                        <span className="text-text-secondary">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="slide-right">
              <div>
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                  伊娃老师
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-6">
                  把东方舞从“好看”讲到“会练、会教、会创作”
                </h2>
                <div className="space-y-4 text-text-secondary leading-relaxed">
                  <p>
                    项目现有课程资料中，伊娃老师的教学重心非常清晰：东方舞学习不是单点技巧的堆叠，而是身体基础、风格理解、音乐节奏、舞台表达和教学转化共同构成的完整系统。
                  </p>
                  <p>
                    因此，SWOD 体系既有面向零基础学员的入门课程，也有呼吸、核心、胸腰、旋转、西米、甩发、手臂等专项训练；既有成品舞作品，也有编舞师、亲传教练班、师资班和传承弟子班，服务不同阶段的成长。
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>

          <ScrollAnimation>
            <div className="grid md:grid-cols-2 gap-5 mb-16">
              {teachingBeliefs.map((item, index) => (
                <div key={item} className="bg-white rounded-2xl p-6 border border-sand/30 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-serif font-bold text-gold-dark">{index + 1}</span>
                    </div>
                    <p className="text-text-secondary leading-relaxed">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollAnimation>

          <ScrollAnimation>
            <div className="mb-16">
              <div className="text-center mb-10">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                  课程体系
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                  四条主线，组成一套完整训练地图
                </h2>
                <p className="text-text-secondary max-w-2xl mx-auto">
                  课程名称本身已经呈现出品牌方法论：先建立身体，再拆解技巧，然后进入作品表达，最终沉淀为教学能力。
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                {coursePillars.map((pillar) => (
                  <div key={pillar.title} className="bg-white rounded-2xl p-6 border border-sand/30 shadow-sm">
                    <h3 className="font-serif text-xl font-bold text-text mb-4">{pillar.title}</h3>
                    <div className="space-y-3">
                      {pillar.items.map((item) => (
                        <div key={item} className="flex gap-2 text-sm text-text-secondary">
                          <CheckCircle2 className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-10 items-center mb-16">
            <ScrollAnimation animation="slide-left">
              <div className="bg-gradient-to-br from-gold/10 to-sand/20 p-8 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <BookOpen className="w-6 h-6 text-gold-dark" />
                  </div>
                  <div>
                    <p className="text-sm text-gold-dark font-medium">出版作品与核心教材</p>
                    <h2 className="font-serif text-2xl font-bold text-text">《东方舞技巧大全》</h2>
                  </div>
                </div>
                <p className="text-text-secondary leading-relaxed mb-6">
                  这本教材及其配套视频课，是 SWOD 体系中最适合承载“方法”的部分。它把核心技巧、基础训练、复合技巧、旋转、西米、甩发、舞感和教学法入门串联起来，让学员不只知道动作名称，也能理解训练顺序。
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {bookHighlights.map((item) => (
                    <div key={item} className="flex gap-2 text-sm text-text-secondary">
                      <Sparkles className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="slide-right">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-sand/30 shadow-sm">
                  <Music2 className="w-7 h-7 text-crimson mb-4" />
                  <h3 className="font-serif text-xl font-bold text-text mb-3">音乐与节奏</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    编舞师课程包含中东节奏、乐器、音乐结构和试编训练，把“听音乐”转化为“能编、能讲、能带练”。
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-sand/30 shadow-sm">
                  <PenTool className="w-7 h-7 text-crimson mb-4" />
                  <h3 className="font-serif text-xl font-bold text-text mb-3">原创作品</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    成品舞专栏覆盖经典东方舞、民俗舞、国风、新现代融舞和情感主题，让技巧进入真实舞台表达。
                  </p>
                </div>
                <div className="sm:col-span-2 bg-white rounded-2xl p-6 border border-sand/30 shadow-sm">
                  <Users className="w-7 h-7 text-crimson mb-4" />
                  <h3 className="font-serif text-xl font-bold text-text mb-3">从学员到教师</h3>
                  <p className="text-text-secondary leading-relaxed">
                    线下 SWOD 融舞师资班、传承弟子班和各类集训课，把个人训练推进到课堂组织、动作分解、模拟教学与考核，让学员拥有继续传播东方舞的能力。
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>

          {/* SWOD 核心系统 */}
          <ScrollAnimation>
            <div className="mb-16">
              <div className="text-center mb-8">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4 border border-gold/20">
                  ⚡ 系统核心
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                  不是教动作，而是构建能力系统
                </h2>
                <p className="text-text-secondary max-w-2xl mx-auto">
                  专业化 × 系统化 × 科班化 × 科学化 — 一套体系，打通所有能力
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { icon: '🧠', title: '身体系统', items: '呼吸 / 肌力 / 控制', desc: '从底层建立身体与发力' },
                  { icon: '💃', title: '技术系统', items: '胯 / 胸 / 西米 / 旋转', desc: '从结构掌握全部技巧' },
                  { icon: '✨', title: '表达系统', items: '手臂 / 头部 / 舞感', desc: '从训练提升舞台高级感' },
                  { icon: '🎵', title: '创编系统', items: '音乐理解 / 编舞', desc: '从学习走向创作' },
                  { icon: '📐', title: '教学系统', items: '课程结构 / 变现', desc: '从学员走向教学与变现' },
                ].map((sys, i) => (
                  <div key={i} className="text-center bg-white rounded-xl p-5 border border-sand/20 shadow-sm hover:shadow-md transition-all">
                    <span className="text-3xl mb-3 block">{sys.icon}</span>
                    <h3 className="font-bold text-text mb-1">{sys.title}</h3>
                    <p className="text-xs text-gold-dark font-medium mb-1">{sys.items}</p>
                    <p className="text-xs text-text-muted">{sys.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 学习路径 */}
          <ScrollAnimation>
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-sand/20 shadow-sm mb-16">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-3 border border-gold/20">
                  📍 学习路径
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                  一条清晰的成长路径
                </h2>
                <p className="text-text-secondary text-sm">从0到专业，只需要这一条路径</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {[
                  { step: '①', label: '零基础入门', sub: '建立基础' },
                  { step: '②', label: '身体能力', sub: '呼吸+肌力' },
                  { step: '③', label: '技术体系', sub: '全部技巧' },
                  { step: '④', label: '表达能力', sub: '舞感/手臂' },
                  { step: '⑤', label: '专项突破', sub: '西米/旋转' },
                  { step: '⑥', label: '编舞能力', sub: '创作表达' },
                  { step: '⑦', label: '教学能力', sub: '授课变现' },
                ].map((p, i) => (
                  <div key={i} className="text-center p-3 bg-gold/5 rounded-xl border border-gold/10 hover:bg-gold/10 hover:border-gold/30 transition-all">
                    <div className="text-2xl mb-1">{p.step}</div>
                    <div className="font-semibold text-xs text-text">{p.label}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{p.sub}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-text-muted mt-4">不再迷路，每一步都清晰</p>
            </div>
          </ScrollAnimation>

          {/* 六大课程体系 */}
          <ScrollAnimation>
            <div className="mb-16">
              <div className="text-center mb-8">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-3 border border-gold/20">
                  📚 课程体系
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                  六大课程体系，覆盖全阶段成长
                </h2>
                <p className="text-text-secondary text-sm">无论你处于哪个阶段，都能找到适合自己的课程</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: '🌱', title: '入门系统', desc: '从0开始建立基础', courses: '零基础入门课 / 亲传教练系统课' },
                  { icon: '💪', title: '身体开发系统', desc: '解决不会发力问题', courses: '呼吸课 / 肌力课' },
                  { icon: '🔥', title: '技术体系', desc: '掌握全部技巧', courses: '7+1技巧班 / 技巧大全' },
                  { icon: '⚡', title: '专项突破系统', desc: '快速提升关键能力', courses: '西米 / 旋转 / 手臂 / 头部' },
                  { icon: '💃', title: '表达系统', desc: '提升高级感', courses: '胸腰舞感' },
                  { icon: '🎵', title: '编舞系统', desc: '从舞者到创作者', courses: 'SWOD编舞师课程' },
                ].map((sys, i) => (
                  <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-5 border border-sand/20 shadow-sm hover:shadow-md transition-all">
                    <span className="text-2xl flex-shrink-0">{sys.icon}</span>
                    <div>
                      <h4 className="font-bold text-text mb-1">{sys.title}</h4>
                      <p className="text-xs text-text-muted mb-1">{sys.desc}</p>
                      <p className="text-[10px] text-gold-dark">{sys.courses}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 学员真实变化 */}
          <ScrollAnimation>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 md:p-8 border border-green-200/60 mb-16">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-3 border border-green-200">
                  🌟 学员变化
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                  改变不是感觉，是结果
                </h2>
                <p className="text-sm text-text-secondary">数千名学员的学习证明：SWOD 系统让改变真实发生</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { before: '从完全不会', after: '能完成整套舞蹈', icon: '🚀', desc: '零基础入门课程后，从手忙脚乱到完整演绎' },
                  { before: '西米不稳控制差', after: '西米稳定度明显提升', icon: '✅', desc: '疯狂西米锻造营后，从抖不动到随心所欲控制节奏' },
                  { before: '旋转头晕转不稳', after: '旋转连续能力提升', icon: '🔄', desc: '黄金陀螺旋转课后，能连续完成多圈技巧组合' },
                  { before: '动作生硬不干净', after: '动作更干净、更高级', icon: '✨', desc: '技巧大全+表达课程后，动作质感飞跃式提升' },
                  { before: '只会模仿不会编', after: '能独立编舞创作', icon: '🎨', desc: '编舞师课程后，从模仿到创作了自己的第一部作品' },
                  { before: '只会跳不会教课', after: '从学员开始带课', icon: '👩‍🏫', desc: '亲传教练系统课后，成功开设自己的教学班' },
                ].map((t, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm border border-green-100">
                    <span className="text-xl flex-shrink-0">{t.icon}</span>
                    <div>
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="text-red-400 line-through">{t.before}</span>
                        <span className="text-green-500">→</span>
                      </div>
                      <div className="font-semibold text-sm text-green-700">{t.after}</div>
                      <p className="text-xs text-text-muted mt-1">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 推荐课程入口 */}
          <ScrollAnimation>
            <div className="mb-16">
              <div className="text-center mb-8">
                <span className="inline-block px-3 py-1 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-3 border border-gold/20">
                  🎯 推荐课程
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                  从一门课程开始你的 SWOD 之旅
                </h2>
                <p className="text-text-secondary text-sm">不管你处于哪个阶段，总有一门课程适合你</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    badge: '🔥 零基础入门',
                    title: '东方舞零基础入门课程',
                    desc: '从0开始，课节以统一平台实时目录为准',
                    link: '/courses/12?source=platform',
                    color: 'from-green-500 to-emerald-600'
                  },
                  {
                    badge: '🔥 主推｜最推荐',
                    title: '零基础·亲传教练系统课',
                    desc: '从入门到教练，课节以统一平台实时目录为准',
                    link: '/courses/19?source=platform',
                    color: 'from-gold to-gold-dark'
                  },
                  {
                    badge: '⚡ 专项爆款',
                    title: '疯狂西米·全维度解锁锻造营',
                    desc: '打基础+复合+Chuchu，课节以统一平台实时目录为准',
                    link: '/courses/8?source=platform',
                    color: 'from-purple-500 to-purple-700'
                  },
                  {
                    badge: '🏆 顶级系统',
                    title: '云·弟子班',
                    desc: '一套课打通全部能力路径',
                    link: '/courses/5?source=platform',
                    color: 'from-crimson to-crimson-dark'
                  },
                ].map((rec, i) => (
                  <Link
                    key={i}
                    href={rec.link}
                    className="group bg-white rounded-xl overflow-hidden shadow-sm border border-sand/20 hover:shadow-lg hover:-translate-y-1 transition-all"
                  >
                    <div className={`bg-gradient-to-r ${rec.color} p-4 text-white`}>
                      <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{rec.badge}</span>
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-text text-sm mb-1 group-hover:text-gold-dark transition-colors">{rec.title}</h4>
                      <p className="text-xs text-text-secondary">{rec.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          {/* 强转化 + 收口 */}
          <ScrollAnimation>
            <div className="text-center bg-gradient-to-br from-crimson-dark/10 via-gold/10 to-black/5 rounded-2xl px-8 py-12 border border-gold/20 mb-8">
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                如果你认真想学东方舞
              </h2>
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full border border-red-100">
                  <span className="text-red-400">✕</span>
                  <span className="text-sm text-text-secondary">到处拼课程</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full border border-red-100">
                  <span className="text-red-400">✕</span>
                  <span className="text-sm text-text-secondary">靠感觉练</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-full border border-red-100">
                  <span className="text-red-400">✕</span>
                  <span className="text-sm text-text-secondary">重复走弯路</span>
                </div>
              </div>
              <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                选<span className="text-gold-dark font-semibold">一套系统</span>，而不是一门课。<br />
                用<span className="text-gold-dark font-semibold">正确的方法</span>，走<span className="text-gold-dark font-semibold">清晰的路</span>，<br />
                从入门到舞台，从舞者到教练。
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/enroll"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-gold/30 transition-all"
                >
                  立即进入 SWOD 系统学习
                </Link>
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-gold/40 text-gold-dark font-semibold rounded-xl hover:bg-gold/5 transition-all"
                >
                  查看全部课程路径
                </Link>
              </div>
              <p className="text-xs text-text-muted mt-5">
                从入门到专业 · 从学习到教学 · 从兴趣到能力
              </p>
            </div>
          </ScrollAnimation>

          {/* 底部信任叠加 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { value: '18年', label: '教学经验沉淀', icon: '⏳' },
              { value: '1000+', label: '系统课程结构', icon: '📚' },
              { value: '102种', label: '技巧完整体系', icon: '💃' },
              { value: '15门', label: '线上系统课程', icon: '🎯' },
              { value: '万+', label: '学员学习验证', icon: '👩‍🎓' },
            ].map((stat, i) => (
              <div key={i} className="text-center bg-white rounded-xl p-4 border border-sand/20 shadow-sm hover:shadow-md transition-all">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-bold text-gold-dark">{stat.value}</div>
                <div className="text-xs text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
