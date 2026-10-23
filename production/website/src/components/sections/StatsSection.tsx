import { Users, Globe, MapPin, Calendar } from 'lucide-react';
import AnimatedCounter from '@/components/AnimatedCounter';
import ScrollAnimation from '@/components/ScrollAnimation';

const stats = [
  { icon: Users, value: 10000, suffix: '+', label: '毕业学员', desc: '遍布全国50+城市' },
  { icon: Globe, value: 5, suffix: '届', label: '国际舞蹈节', desc: '全球影响力持续扩大' },
  { icon: MapPin, value: 50, suffix: '+', label: '覆盖城市', desc: '全国范围师资网络' },
  { icon: Calendar, value: 15, suffix: '期', label: '集训营', desc: '多年办学经验' },
];

export default function StatsSection() {
  return (
    <section className="py-10 md:py-14 bg-gradient-to-br from-crimson-dark via-crimson to-crimson-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gold rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-gold rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <ScrollAnimation>
          <div className="text-center mb-8 md:mb-10">
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-3">
              核心数据
            </span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">
              用数字说话
            </h2>
            <p className="text-white/70 max-w-xl mx-auto">
              十二年深耕东方舞教育，用长期教学成果证明品质
            </p>
          </div>
        </ScrollAnimation>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <ScrollAnimation key={stat.label} delay={i * 150}>
              <div className="text-center p-6 md:p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-gold/30 transition-all group">
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-gold/20 rounded-xl mb-4 group-hover:bg-gold/30 transition-colors">
                  <stat.icon className="w-6 h-6 md:w-7 md:h-7 text-gold" />
                </div>
                <div className="counter-value text-3xl md:text-4xl lg:text-5xl mb-2">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <h3 className="font-serif font-semibold text-white text-lg mb-1">{stat.label}</h3>
                <p className="text-white/50 text-xs">{stat.desc}</p>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
