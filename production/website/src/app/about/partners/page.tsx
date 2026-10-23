import Link from 'next/link';
import { ArrowLeft, Globe, Users, Star, Award } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-warm-white pt-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900/10 via-warm-white to-gold/10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-full mb-4">
                <Globe className="w-4 h-4 inline mr-2" />
                国际合作
              </span>
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-text mb-4">
                世界级舞蹈大师合作
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                汇聚全球顶尖东方舞艺术家，建立国际舞蹈交流平台
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Featured Partner */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Photo Placeholder */}
                <div className="bg-gradient-to-br from-blue-100 to-gold/10 p-12 flex items-center justify-center min-h-[350px]">
                  <div className="text-center">
                    <div className="w-40 h-40 bg-white rounded-full shadow-lg mx-auto mb-4 flex items-center justify-center border-4 border-gold/30">
                      <Users className="w-16 h-16 text-gold" />
                    </div>
                    <p className="text-text-muted text-sm">（待替换为实际照片）</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-gold fill-gold" />
                    <span className="text-gold-dark font-semibold">埃及国宝级大师</span>
                  </div>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                    Tito Seif
                  </h2>
                  <p className="text-text-secondary text-lg mb-6">
                    蒂托·赛夫 — 国际东方舞泰斗
                  </p>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-gold" />
                      <span className="text-text-secondary text-sm">14岁开始学习东方舞，20+年专业经验</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gold" />
                      <span className="text-text-secondary text-sm">全球巡演，Instagram 46K+粉丝</span>
                    </div>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    通过大师课、工作坊和舞蹈节交流，伊娃东方舞持续引入国际视野，帮助学员接触更丰富的东方舞训练方法与舞台表达。
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          {/* More Partners Placeholder */}
          <ScrollAnimation>
            <div className="text-center py-12 bg-white rounded-2xl shadow-md">
              <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="font-serif text-xl font-bold text-text mb-2">更多国际合作伙伴</h3>
              <p className="text-text-secondary">
                内容筹备中，敬请期待更多国际大师的加入
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Back */}
      <section className="py-12 bg-white border-t border-sand/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/about" className="inline-flex items-center gap-2 text-gold-dark font-medium hover:text-gold transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回权威资质
          </Link>
        </div>
      </section>
    </div>
  );
}
