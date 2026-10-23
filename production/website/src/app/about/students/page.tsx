import ScrollAnimation from '@/components/ScrollAnimation';
import PlaceholderImage from '@/components/PlaceholderImage';

export default function StudentsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-4">
              弟子展示墙
            </span>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
              10000+ 毕业学员
            </h1>
            <p className="text-white/70 max-w-xl mx-auto">
              遍布全国 50+ 城市的东方舞教师网络
            </p>
          </ScrollAnimation>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-warm-white border-b border-sand/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { number: '10000+', label: '毕业学员' },
                { number: '50+', label: '覆盖城市' },
                { number: '98%', label: '就业率' },
                { number: '15', label: '期集训营' },
              ].map((stat, i) => (
                <div key={i} className="text-center p-4">
                  <div className="counter-value text-2xl md:text-3xl mb-2">{stat.number}</div>
                  <div className="text-text-secondary text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Student Photos Grid */}
      <section className="py-16 md:py-24 bg-warm-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                学员风采
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                展示部分优秀学员的学习成果与舞台风采
              </p>
            </div>
          </ScrollAnimation>

          {/* Photo Grid - 100 placeholders */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 100 }).map((_, i) => (
              <ScrollAnimation key={i} delay={(i % 10) * 50}>
                <div className="aspect-square bg-sand/30 rounded-lg overflow-hidden relative group">
                  <PlaceholderImage
                    alt={`学员 ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">学员 {i + 1}</span>
                  </div>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      {/* China Map */}
      <section className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                全国分布
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                东方舞教师网络覆盖全国50+城市，持续连接各地教学与演出资源
              </p>
            </div>
          </ScrollAnimation>

          <div className="flex justify-center">
            <div className="w-full max-w-4xl aspect-[16/9] bg-gradient-to-br from-sand/30 to-gold/10 rounded-2xl flex items-center justify-center relative overflow-hidden">
              <PlaceholderImage
                alt="中国地图"
                className="w-full h-full object-contain p-8"
              />
              {/* City markers would go here */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-6 bg-white/80 backdrop-blur-sm rounded-xl">
                  <h3 className="font-serif font-bold text-text mb-2">50+ 城市</h3>
                  <p className="text-text-secondary text-sm">北京 · 上海 · 广州 · 深圳 · 杭州 · 成都 · 武汉 · 西安 · 南京 · 天津...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
