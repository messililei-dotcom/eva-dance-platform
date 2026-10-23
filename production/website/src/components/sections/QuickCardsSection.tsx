// 快捷卡片组件（模仿科技平台的4个横向卡片）
'use client';

import Link from 'next/link';
import { Gift, Calendar, Award, BookOpen, ArrowRight } from 'lucide-react';
import { quickCards } from '@/config/navigation_v2';

const iconMap = {
  gift: Gift,
  calendar: Calendar,
  award: Award,
  book: BookOpen,
};

export default function QuickCardsSection() {
  return (
    <section className="relative z-20 bg-warm-white pb-6 pt-1 md:pb-12 md:pt-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 text-center md:mb-6">
          <span className="inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-dark">
            品牌文化路径
          </span>
          <h2 className="mt-2 font-serif text-xl font-bold text-[#1A1A1A] md:text-3xl">
            从文化理解走向教学传承
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-[#6E6256] md:text-sm md:leading-6">
            文化根脉、训练系统、师资传承与出版教材，共同构成伊娃东方舞的长期教学路径。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {quickCards.map((card) => {
            const IconComponent = iconMap[card.icon as keyof typeof iconMap];
            
            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative overflow-hidden rounded-xl border border-sand/40 bg-white/95 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-xl"
              >
                {/* 背景渐变 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                
                {/* 内容区 */}
                <div className="relative p-3 md:p-5">
                  {/* 标签 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`${card.tagColor} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                      {card.tag}
                    </span>
                    <IconComponent className="w-5 h-5 text-gold/60 group-hover:text-gold transition-colors" />
                  </div>
                  
                  {/* 标题 */}
                  <h3 className="mb-1 font-serif text-sm font-bold leading-5 text-[#1A1A1A] transition-colors group-hover:text-crimson md:text-lg md:leading-normal">
                    {card.title}
                  </h3>
                  
                  {/* 副标题 */}
                  <p className="mb-2 line-clamp-2 text-xs font-medium leading-5 text-gold md:text-sm">
                    {card.subtitle}
                  </p>
                  
                  {/* 描述 */}
                  <p className="mb-3 line-clamp-3 text-[11px] leading-5 text-[#4A4A4A]/75 md:text-xs">
                    {card.description}
                  </p>
                  
                  {/* 行动按钮 */}
                  <div className="flex items-center gap-1 text-xs font-medium text-crimson transition-all group-hover:gap-2 md:text-sm">
                    <span>了解详情</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                
                {/* 底部装饰线 */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${card.bgGradient} opacity-30`} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
