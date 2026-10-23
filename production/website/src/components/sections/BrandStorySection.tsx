import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Heart, Star } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

export default function BrandStorySection() {
  return (
    <section className="bg-warm-white py-6 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16">
          <ScrollAnimation animation="slide-left">
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg shadow-xl md:aspect-[5/4]">
                <Image
                  src="/images/school/oriental-dance-passion-main-2026.jpg"
                  alt="伊娃国际东方舞学院中非舞蹈艺术交流基地授牌现场"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-crimson-dark/35 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-3 right-2 flex items-center gap-2 rounded-lg bg-white p-3 shadow-lg md:-bottom-6 md:-right-6 md:gap-3 md:p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/20 md:h-10 md:w-10">
                  <Heart className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="text-xs text-text-muted">东方舞热爱</p>
                  <p className="font-serif font-bold text-text">12年+ 专注</p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation animation="slide-right">
            <div>
              <span className="mb-3 inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-dark md:mb-4 md:text-sm">
                品牌文化
              </span>
              <h2 className="mb-4 font-serif text-2xl font-bold leading-tight text-text md:mb-6 md:text-4xl">
                用一套清晰的训练语言传播东方舞文化
              </h2>
              <div className="space-y-3 text-sm leading-6 text-text-secondary md:space-y-4 md:text-base md:leading-relaxed">
                <p>
                  伊娃东方舞以东方舞的文化根脉为起点，尊重音乐、风格、身体线条与女性表达，不把舞蹈简化为动作模仿，而是把审美、技巧和教学能力一起训练。
                </p>
                <p>
                  SWOD 教学系统则把呼吸、核心、胸腰、旋转、西米、甩发、手臂、编舞和教学法拆解成可学习、可复盘、可传授的路径。首页中的出版作品、线上学院、成品舞、线下培训、传承弟子和学员地图，都围绕这条文化传播路径展开。
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 md:mt-8 md:gap-4">
                <div className="flex items-center gap-2 rounded-full bg-gold/10 px-3 py-2 md:px-4">
                  <Star className="w-4 h-4 text-gold" />
                  <span className="text-sm text-gold-dark font-medium">SWOD系统课程</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-gold/10 px-3 py-2 md:px-4">
                  <Star className="w-4 h-4 text-gold" />
                  <span className="text-sm text-gold-dark font-medium">师资传承路径</span>
                </div>
              </div>

              <Link
                href="/about/brand-story"
                className="mt-5 inline-flex items-center gap-2 font-medium text-gold transition-all hover:gap-3 md:mt-8"
              >
                了解更多品牌文化 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}
