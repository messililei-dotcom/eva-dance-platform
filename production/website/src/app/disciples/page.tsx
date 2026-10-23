'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Award, Calendar, Grid3X3, List, MapPin, Search, Sparkles, Users } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import { cn } from '@/lib/utils';
import { Disciple, disciples } from '@/data/disciples';

const cities = Array.from(new Set(disciples.map(d => d.city))).sort();
const years = Array.from(new Set(disciples.map(d => d.joinYear))).sort();
const provinces = Array.from(new Set(disciples.map(d => d.province))).sort();

function shuffleDisciples(items: Disciple[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function DisciplesPage() {
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [orderedDisciples, setOrderedDisciples] = useState(disciples);

  useEffect(() => {
    setOrderedDisciples(shuffleDisciples(disciples));
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return orderedDisciples.filter(d => {
      const searchable = `${d.name} ${d.displayName} ${d.city} ${d.province} ${d.bio}`.toLowerCase();
      if (keyword && !searchable.includes(keyword)) return false;
      if (filterCity !== 'all' && d.city !== filterCity) return false;
      if (filterYear !== 'all' && d.joinYear !== filterYear) return false;
      return true;
    });
  }, [filterCity, filterYear, orderedDisciples, search]);

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <section className="relative overflow-hidden bg-[#7A1616] px-4 pb-6 pt-20 text-white md:pb-16 md:pt-36">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,169,110,0.26),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/16 to-transparent" />

        <div className="relative mx-auto grid max-w-7xl gap-5 md:gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#C8A96E]/35 bg-white/10 px-3 py-1.5 backdrop-blur md:mb-5 md:gap-2 md:px-4 md:py-2">
              <Award className="h-3.5 w-3.5 text-[#E8D5B7] md:h-4 md:w-4" />
              <span className="text-xs font-medium text-[#E8D5B7] md:text-sm">终身制师徒传承</span>
            </div>

            <h1 className="mb-2 font-serif text-3xl font-bold tracking-wide md:mb-4 md:text-6xl">
              传承弟子
            </h1>

            <p className="max-w-2xl text-sm font-light leading-6 text-white/82 md:text-2xl md:leading-8">
              真实弟子名录与形象写真，记录伊娃东方舞师徒体系在全国各地的传承脉络。
            </p>

            <div className="mt-4 grid max-w-2xl grid-cols-3 gap-2 md:mt-8 md:gap-3">
              <Stat icon={Users} label="传承弟子" value={`${disciples.length}位`} />
              <Stat icon={MapPin} label="覆盖城市" value={`${cities.length}城`} />
              <Stat icon={Calendar} label="传承届别" value={`${years.length}届`} />
            </div>
          </div>

          <div className="hidden border-l border-white/20 pl-8 lg:block">
            <p className="mb-4 text-sm text-[#E8D5B7]">地区分布</p>
            <div className="flex flex-wrap gap-2">
              {provinces.map(province => (
                <span key={province} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/86">
                  {province}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-40 hidden border-b border-[#E8D5B7]/70 bg-[#FAF7F2]/95 px-4 py-4 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-[#E8D5B7] bg-white p-1 shadow-sm">
            <ViewButton active={viewMode === 'grid'} icon={Grid3X3} label="网格" onClick={() => setViewMode('grid')} />
            <ViewButton active={viewMode === 'list'} icon={List} label="列表" onClick={() => setViewMode('list')} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A7A7A]" />
              <input
                type="text"
                placeholder="搜索姓名、昵称或城市"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E8D5B7] bg-white pl-9 pr-3 text-sm text-[#2D2D2D] outline-none transition focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/25 sm:w-56"
              />
            </div>

            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="h-10 rounded-lg border border-[#E8D5B7] bg-white px-3 text-sm text-[#2D2D2D] outline-none transition focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/25"
            >
              <option value="all">全部城市</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>

            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="h-10 rounded-lg border border-[#E8D5B7] bg-white px-3 text-sm text-[#2D2D2D] outline-none transition focus:border-[#C8A96E] focus:ring-2 focus:ring-[#C8A96E]/25"
            >
              <option value="all">全部拜师年月</option>
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>

          <div className="text-sm text-[#4A4A4A]">
            找到 <span className="font-semibold text-[#8B1A1A]">{filtered.length}</span> 位弟子
          </div>
        </div>
      </section>

      <section className="px-4 py-5 md:py-10">
        <div className="mx-auto max-w-7xl">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-[#E8D5B7]/60 bg-white py-16 text-center">
              <Users className="mx-auto mb-4 h-14 w-14 text-[#C8A96E]/70" />
              <h3 className="mb-2 font-serif text-xl font-bold text-[#2D2D2D]">暂无匹配结果</h3>
              <p className="text-[#4A4A4A]">请调整搜索或筛选条件</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-5">
              {filtered.map((disciple, i) => (
                <div key={disciple.id}>
                  <ScrollAnimation delay={i * 20}>
                    <article className="group overflow-hidden rounded-lg border border-[#E8D5B7]/70 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#C8A96E] hover:shadow-xl">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#E8D5B7]/30">
                      <Image
                        src={disciple.photo}
                        alt={`${disciple.name}形象写真`}
                        fill
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        priority={i < 4}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 via-black/20 to-transparent p-4 pt-16">
                        <h2 className="font-serif text-2xl font-bold text-white">{disciple.name}</h2>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-[#8B1A1A]">{disciple.joinYear}拜师</p>
                        <span className="shrink-0 rounded-full bg-[#C8A96E]/14 px-2.5 py-1 text-xs text-[#8B1A1A]">{disciple.province} · {disciple.city}</span>
                      </div>
                      <p className="mb-3 line-clamp-3 text-sm leading-6 text-[#4A4A4A]">{disciple.bio}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {disciple.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-[#FAF7F2] px-2 py-1 text-xs text-[#7A4A2A]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </ScrollAnimation>
              </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((disciple, i) => (
                <ScrollAnimation key={disciple.id} delay={i * 20}>
                  <article className="grid grid-cols-[86px_1fr] gap-4 rounded-lg border border-[#E8D5B7]/70 bg-white p-3 shadow-sm transition hover:border-[#C8A96E] hover:shadow-md sm:grid-cols-[112px_1fr_auto] sm:items-center">
                    <div className="relative h-28 overflow-hidden rounded-lg bg-[#E8D5B7]/30 sm:h-32">
                      <Image
                        src={disciple.photo}
                        alt={`${disciple.name}形象写真`}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-xl font-bold text-[#2D2D2D]">{disciple.name}</h2>
                        <span className="rounded-full bg-[#8B1A1A]/10 px-2 py-0.5 text-xs text-[#8B1A1A]">{disciple.joinYear}拜师</span>
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#7A7A7A]">
                        <span>{disciple.province} · {disciple.city}</span>
                        <span>·</span>
                        <span>{disciple.joinYear}拜师</span>
                        <span>·</span>
                        <span>{disciple.displayName}</span>
                      </div>
                      <p className="line-clamp-2 text-sm leading-6 text-[#4A4A4A]">{disciple.bio}</p>
                    </div>
                    <div className="hidden items-center gap-1 text-[#C8A96E] sm:flex">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium">传承名录</span>
                    </div>
                  </article>
                </ScrollAnimation>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-[#E8D5B7]/60 bg-white px-4 py-8">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-sm text-[#4A4A4A]">照片与弟子资料已按公开展示口径整理，后续可继续补充个人简介、教学成果与代表作品。</p>
          <p className="mt-2 text-xs text-[#7A7A7A]">伊娃东方舞 · 传承弟子名录</p>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/16 bg-white/10 p-2.5 backdrop-blur md:p-3">
      <Icon className="mb-1 h-3.5 w-3.5 text-[#E8D5B7] md:mb-2 md:h-4 md:w-4" />
      <div className="font-serif text-xl font-bold text-white md:text-2xl">{value}</div>
      <div className="text-[11px] text-white/70 md:text-xs">{label}</div>
    </div>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Grid3X3;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition',
        active ? 'bg-[#C8A96E] text-white shadow-sm' : 'text-[#4A4A4A] hover:bg-[#E8D5B7]/35'
      )}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
