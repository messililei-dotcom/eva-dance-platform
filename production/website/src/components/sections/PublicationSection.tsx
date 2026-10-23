import Link from 'next/link';
import Image from 'next/image';
import { Award, ArrowRight } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

export default function PublicationSection() {
  return (
    <section className="bg-gradient-to-br from-gold/5 to-sand/20 py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollAnimation>
          <div className="text-center mb-5">
            <span className="inline-block px-3 py-1 bg-gold/20 text-gold-dark text-sm font-medium rounded-full mb-3">
              文化方法
            </span>
            <h2 className="mb-4 font-serif text-2xl font-bold text-text md:text-4xl">
              以出版教材建立东方舞学习标准
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              将长期课堂经验整理成可阅读、可练习、可教学的知识体系，让东方舞文化有章可循。
            </p>
          </div>
        </ScrollAnimation>

        {/* Featured Book */}
        <ScrollAnimation>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Book Cover */}
              <div className="flex items-center justify-center bg-gradient-to-br from-[#E8D5B7]/50 to-[#FAF7F2] p-3 sm:p-5 md:p-6">
                <div className="w-full">
                  <Image
                    src="/images/books/eastern-dance-techniques-ad-20260914.png"
                    alt="伊娃著《东方舞技巧大全》全系统教材，赠送128节技巧视频课"
                    width={1448}
                    height={1086}
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 592px"
                    className="h-auto w-full rounded-lg object-contain shadow-lg"
                  />
                </div>
              </div>

              {/* Book Info */}
              <div className="flex flex-col justify-center p-5 md:p-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-[#C8A96E]" />
                  <span className="text-[#8B1A1A] font-medium text-sm">权威出版物</span>
                </div>
                <h3 className="font-serif text-2xl md:text-3xl font-bold text-[#1A1A1A] mb-2">
                  《东方舞技巧大全》
                </h3>
                <p className="text-[#6B6B6B] mb-4">
                  中东埃及舞蹈术语图解 · 全系统教材 · 中南大学出版社
                </p>
                <p className="text-[#6B6B6B] leading-relaxed mb-6">
                  伊娃老师亲著，系统整理东方舞教学体系。本书涵盖从基本功到进阶技巧的完整内容，把东方舞的动作术语、训练逻辑和教学表达整理成系统参照。
                </p>
                <div className="mb-5 grid grid-cols-3 gap-2 md:gap-4">
                  <div className="rounded-lg bg-[#C8A96E]/10 p-2 text-center md:p-3">
                    <div className="text-xl font-bold text-[#8B1A1A] md:text-3xl">102</div>
                    <div className="text-xs text-[#6B6B6B] mt-1">种技巧</div>
                  </div>
                  <div className="rounded-lg bg-[#C8A96E]/10 p-2 text-center md:p-3">
                    <div className="text-xl font-bold text-[#8B1A1A] md:text-3xl">500</div>
                    <div className="text-xs text-[#6B6B6B] mt-1">种变型</div>
                  </div>
                  <div className="rounded-lg bg-[#C8A96E]/10 p-2 text-center md:p-3">
                    <div className="text-xl font-bold text-[#8B1A1A] md:text-3xl">10</div>
                    <div className="text-xs text-[#6B6B6B] mt-1">年匠心呈现</div>
                  </div>
                </div>
                <Link
                  href="/about/brand-story"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all w-fit"
                >
                  了解详情 <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
