'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Music, Play, ArrowRight, Sparkles } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import SectionHeader from '@/components/SectionHeader';
import { danceCollection } from '@/config/dance-collection';
import Image from 'next/image';

const difficultyColors: Record<string, string> = {
  '初级': 'bg-green-100 text-green-700',
  '中级': 'bg-gold/10 text-gold-dark',
  '中高级': 'bg-orange-100 text-orange-700',
  '高级': 'bg-crimson/10 text-crimson',
};

export default function DanceCollectionSection() {
  const [featuredDances, setFeaturedDances] = useState(() => danceCollection.slice(0, 4));

  useEffect(() => {
    const shuffled = [...danceCollection].sort(() => Math.random() - 0.5);
    setFeaturedDances(shuffled.slice(0, 4));
  }, []);

  return (
    <section className="bg-gradient-to-b from-[#F8F1EB] to-warm-white py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <SectionHeader
            number="03"
            icon={Music}
            badge="成品舞专栏"
            title="让东方舞文化进入舞台表达"
            subtitle="从经典东方舞、民俗风格到国风与现代融合，成品舞专栏承载不同风格的审美与情绪表达。"
          />
        </ScrollAnimation>

        {/* Dance Grid - 4:3 course covers */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:mb-6 md:grid-cols-4 md:gap-4">
          {featuredDances.map((dance, i) => (
            <div key={dance.id}>
              <ScrollAnimation delay={i * 100}>
                <Link
                  href="/courses"
                  className="group block overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:border-purple-200 hover:shadow-xl"
                >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-purple-50 to-gold-50">
                  <Image
                    src={dance.image}
                    alt={dance.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  {/* Badges */}
                  <div className="absolute left-2 top-2 flex gap-1.5 md:left-3 md:top-3 md:gap-2">
                    {dance.isNew && (
                      <span className="rounded-md bg-gold-dark px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2 md:py-1 md:text-xs">
                        NEW
                      </span>
                    )}
                    {dance.isHot && (
                      <span className="rounded-md bg-crimson px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2 md:py-1 md:text-xs">
                        HOT
                      </span>
                    )}
                  </div>
                  {/* Type badge */}
                  <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3">
                    <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm md:px-2 md:text-xs">
                      {dance.type}
                    </span>
                  </div>
                </div>

                {/* Info */}
                  <div className="p-2.5 md:p-4">
                  <h3 className="mb-1 line-clamp-1 text-xs font-semibold text-text-primary transition-colors group-hover:text-crimson md:text-sm">
                    {dance.title}
                  </h3>
                  {dance.subtitle && (
                    <p className="mb-1.5 line-clamp-1 text-[11px] text-text-muted md:mb-2 md:text-xs">
                      {dance.subtitle}
                    </p>
                  )}
                  <p className="mb-1.5 line-clamp-2 text-[11px] leading-4 text-text-secondary md:mb-3 md:text-xs md:leading-5">
                    {dance.description}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    {dance.difficulty && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium md:px-2 md:text-xs ${difficultyColors[dance.difficulty] || 'bg-gray-100 text-gray-600'}`}>
                        {dance.difficulty}
                      </span>
                    )}
                    <span className="truncate text-[10px] text-text-muted md:text-xs">{dance.instructor}</span>
                  </div>
                </div>
                </Link>
              </ScrollAnimation>
            </div>
          ))}
        </div>

        {/* View All */}
        <ScrollAnimation>
          <div className="text-center">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-full border-2 border-crimson px-4 py-2.5 text-sm font-medium text-crimson transition-all hover:bg-crimson hover:text-white md:px-6 md:py-3 md:text-base"
            >
              进入线上学院
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
