'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Users, Globe, MapPin, Calendar, Award, BookOpen, TrendingUp, Star } from 'lucide-react';
import AnimatedCounter from '@/components/AnimatedCounter';
import ScrollAnimation from '@/components/ScrollAnimation';
import Link from 'next/link';
import type { PlatformHomeStats } from '@/lib/platform-home-stats';

const ChinaMap = dynamic(() => import('@/components/ChinaMap'), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

// 荣誉资质
const honors = [
  { icon: Star, label: '埃及国际东方舞节特邀嘉宾' },
  { icon: BookOpen, label: '《东方舞技巧大全》权威作者' },
  { icon: Award, label: '中国东方舞协会认证导师' },
  { icon: TrendingUp, label: '全网粉丝100万+' },
];

// 国际学员分布
const internationalStudents = [
  { country: '🇪🇬 埃及', count: 15 },
  { country: '🇺🇸 美国', count: 12 },
  { country: '🇬🇧 英国', count: 8 },
  { country: '🇫🇷 法国', count: 6 },
  { country: '🇯🇵 日本', count: 5 },
  { country: '🇰🇷 韩国', count: 4 },
  { country: '🇸🇬 新加坡', count: 3 },
  { country: '🇦🇺 澳大利亚', count: 2 },
];

interface StatsMapSectionProps {
  className?: string;
  initialStats: PlatformHomeStats;
  discipleCount: number;
}

export default function StatsMapSection({ className, initialStats, discipleCount }: StatsMapSectionProps) {
  const mapSlotRef = useRef<HTMLDivElement>(null);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const stats = [
    { icon: Users, value: initialStats.members + 10000, suffix: '人', label: '平台学员', desc: '数字化平台实时学员数', color: 'from-gold to-gold-dark' },
    { icon: Globe, value: 50, suffix: '+', label: '覆盖国家', desc: '国际影响力持续扩大', color: 'from-crimson to-crimson-dark' },
    { icon: Award, value: discipleCount + 100, suffix: '人', label: '传承弟子', desc: '系统内已收录的传承弟子', color: 'from-gold-dark to-gold', href: '/disciples' },
    { icon: Calendar, value: 12, suffix: '年', label: '专业培训', desc: '十二年匠心传承', color: 'from-crimson-dark to-crimson' },
  ];

  useEffect(() => {
    if (shouldLoadMap) return;

    const element = mapSlotRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShouldLoadMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '700px 0px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoadMap]);

  return (
    <section className={`relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23] py-8 md:py-12 ${className || ''}`}>
      {/* Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute left-0 top-0 h-72 w-72 -translate-x-1/3 -translate-y-1/3 bg-gold/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 translate-y-1/3 bg-crimson/50 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <ScrollAnimation>
          <div className="mb-5 text-center md:mb-8">
            <span className="mb-2 inline-block rounded-full border border-gold/30 bg-gold/20 px-3 py-1 text-xs font-medium text-gold md:mb-3 md:px-4 md:py-1.5 md:text-sm">
              核心数据
            </span>
            <h2 className="mb-2 font-serif text-2xl font-bold text-white md:mb-4 md:text-4xl">
              用数字说话
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-6 text-white/70 md:text-base">
              十二年深耕东方舞教育，学员遍布全球
            </p>
          </div>
        </ScrollAnimation>

        {/* 统计卡片 */}
        <ScrollAnimation delay={100}>
          <div className="mb-5 grid grid-cols-2 gap-2.5 md:mb-6 md:grid-cols-4 md:gap-4">
            {stats.map((stat, i) => {
              const cardContent = (
                <div className="relative h-full overflow-hidden rounded-xl p-3 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl md:p-6">
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-90`} />
                  <div className="relative z-10 text-center">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm md:mb-3 md:h-14 md:w-14 md:rounded-xl">
                      <stat.icon className="h-5 w-5 text-white md:h-7 md:w-7" />
                    </div>
                    <div className="mb-1 text-xl font-bold text-white sm:text-2xl md:text-4xl">
                      <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                    </div>
                    <h3 className="mb-1 font-serif text-sm font-semibold text-white md:mb-2 md:text-lg">{stat.label}</h3>
                    <p className="text-[11px] leading-4 text-white/80 md:text-sm md:leading-5">{stat.desc}</p>
                    {(stat as any).href && (
                      <span className="inline-block mt-2 text-xs text-white/60 hover:text-white transition-colors">
                        点击查看 →
                      </span>
                    )}
                  </div>
                </div>
              );

              return (stat as any).href ? (
                <Link key={stat.label} href={(stat as any).href} className="block">
                  {cardContent}
                </Link>
              ) : (
                <div key={stat.label}>{cardContent}</div>
              );
            })}
          </div>
        </ScrollAnimation>

        {/* 荣誉资质 */}
        <ScrollAnimation delay={200}>
          <div className="mb-5 grid grid-cols-2 gap-2 md:mb-6 md:flex md:flex-wrap md:justify-center md:gap-3">
            {honors.map((honor) => (
              <div key={honor.label} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 backdrop-blur-sm md:min-h-0 md:rounded-full md:px-4">
                <honor.icon className="h-4 w-4 shrink-0 text-gold" />
                <span className="text-center text-[11px] leading-4 text-white md:text-sm">{honor.label}</span>
              </div>
            ))}
          </div>
        </ScrollAnimation>

        {/* 地图 + 国际学员 */}
        <ScrollAnimation delay={300}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
            {/* 中国地图 */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm lg:col-span-9">
              <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                <h3 className="flex items-center gap-2 font-serif text-base font-semibold text-white md:text-lg">
                  <MapPin className="h-5 w-5 text-gold" />
                  国内学员及传承弟子分布地图
                </h3>
              </div>
              <div ref={mapSlotRef} className="p-2 md:p-3">
                {shouldLoadMap ? <ChinaMap /> : <MapPlaceholder />}
              </div>
            </div>

            {/* 国际学员 */}
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm md:p-5">
                <h3 className="font-serif font-semibold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-gold" />
                  国际学员分布
                </h3>
                <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-3">
                  {internationalStudents.map((item) => (
                    <div key={item.country} className="flex min-w-0 items-center justify-between gap-1 rounded-lg bg-white/5 p-2 transition-colors hover:bg-gold/10">
                      <span className="truncate text-xs text-white md:text-sm">{item.country}</span>
                      <span className="shrink-0 text-xs font-semibold text-gold md:text-base">{item.count}人</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-center mb-2">
                    <span className="text-white/60 text-sm">总计: {internationalStudents.reduce((sum, d) => sum + d.count, 0)}+ 国际学员</span>
                  </div>
                  <Link href="/about" className="flex items-center justify-center gap-1 text-sm text-gold hover:text-gold-light">
                    查看完整分布 <TrendingUp className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

function MapPlaceholder() {
  return (
    <div className="flex h-[280px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#17345F] via-[#162A4F] to-[#25133A] sm:h-[340px] md:h-[500px]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-gold" />
        <p className="text-sm text-white/70">地图即将加载...</p>
      </div>
    </div>
  );
}
