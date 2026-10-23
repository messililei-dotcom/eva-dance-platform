'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Award, MapPin, Sparkles, Users } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import { Disciple, disciples } from '@/data/disciples';

const showcaseCount = 6;

function shuffle(items: Disciple[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function DisciplesShowcaseSection() {
  const [showcase, setShowcase] = useState<Disciple[]>([]);

  useEffect(() => {
    setShowcase(shuffle(disciples).slice(0, showcaseCount));
  }, []);

  const cityCount = new Set(disciples.map(disciple => disciple.city)).size;
  const provinceCount = new Set(disciples.map(disciple => disciple.province)).size;

  return (
    <section className="bg-[#FAF7F2] px-4 py-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <ScrollAnimation>
          <div className="mb-5 text-center md:mb-9">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#8B1A1A]/10 px-3 py-1 text-sm font-medium text-[#8B1A1A]">
              <Award className="h-4 w-4" />
              传承弟子
            </span>
            <h2 className="font-serif text-2xl font-bold leading-tight text-[#1A1A1A] md:text-4xl">
              师徒传承里的真实身影
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#4A4A4A] md:text-base">
              随机展示伊娃东方舞传承弟子，记录她们在不同城市延展出的课堂、舞台与教学实践。
            </p>

            <div className="mx-auto mt-5 inline-grid max-w-full grid-cols-3 gap-2 rounded-lg border border-[#E8D5B7]/70 bg-white p-2 shadow-sm">
              <Stat icon={Users} value={`${disciples.length}`} label="弟子" />
              <Stat icon={MapPin} value={`${cityCount}`} label="城市" />
              <Stat icon={Sparkles} value={`${provinceCount}`} label="地区" />
            </div>
          </div>
        </ScrollAnimation>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {showcase.length > 0
            ? showcase.map((disciple, index) => (
                <div key={disciple.id}>
                  <ScrollAnimation delay={index * 60}>
                    <Link
                      href="/disciples"
                      className="group block overflow-hidden rounded-lg border border-[#E8D5B7]/70 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#C8A96E] hover:shadow-xl"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-[#E8D5B7]/30">
                        <Image
                          src={disciple.photo}
                          alt={`${disciple.name}形象写真`}
                          fill
                          sizes="(min-width: 1024px) 16vw, (min-width: 768px) 33vw, 50vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-3 pt-12">
                          <h3 className="truncate font-serif text-lg font-bold text-white">{disciple.name}</h3>
                          <p className="truncate text-xs text-white/78">{disciple.province} · {disciple.city}</p>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-xs font-medium text-[#8B1A1A]">{disciple.joinYear}拜师</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4A4A4A]">{disciple.bio}</p>
                      </div>
                    </Link>
                  </ScrollAnimation>
                </div>
              ))
            : Array.from({ length: showcaseCount }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-lg border border-[#E8D5B7]/70 bg-white shadow-sm">
                  <div className="aspect-[3/4] animate-pulse bg-[#E8D5B7]/35" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-2/3 rounded bg-[#E8D5B7]/60" />
                    <div className="h-3 rounded bg-[#E8D5B7]/40" />
                    <div className="h-3 w-5/6 rounded bg-[#E8D5B7]/40" />
                  </div>
                </div>
              ))}
        </div>

        <ScrollAnimation>
          <div className="mt-5 text-center md:mt-7">
            <Link
              href="/disciples"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#C8A96E] px-6 py-3 text-sm font-medium text-[#8B1A1A] transition hover:bg-[#C8A96E] hover:text-white"
            >
              查看传承弟子专栏 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="min-w-16 rounded-md bg-[#FAF7F2] px-3 py-2 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-[#C8A96E]" />
      <div className="font-serif text-xl font-bold text-[#8B1A1A]">{value}</div>
      <div className="text-xs text-[#7A7A7A]">{label}</div>
    </div>
  );
}
