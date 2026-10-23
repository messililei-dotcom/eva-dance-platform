import Link from 'next/link';
import { ArrowLeft, Book, Award, PenTool } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';
import Image from 'next/image';

export default function PublicationsPage() {
  return (
    <div className="min-h-screen bg-warm-white pt-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gold/10 via-warm-white to-sand/20 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 bg-gold/10 text-gold-dark text-sm font-medium rounded-full mb-4">
                <Book className="w-4 h-4 inline mr-2" />
                出版作品
              </span>
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-text mb-4">
                权威教材与指导书籍
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                十二年教学经验沉淀，系统化东方舞知识体系
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Featured Book */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Book Cover Placeholder */}
                <div className="bg-gradient-to-br from-gold/20 to-sand/30 p-12 flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <div className="w-48 h-64 bg-white rounded-lg shadow-lg mx-auto mb-4 flex flex-col items-center justify-center border-2 border-gold/30">
                      <Book className="w-12 h-12 text-gold mb-3" />
                      <p className="font-serif font-bold text-text text-lg px-4 text-center">东方舞技巧大全</p>
                      <p className="text-text-muted text-sm mt-1">伊娃 著</p>
                      <p className="text-text-muted text-xs mt-2">中南大学出版社</p>
                    </div>
                    <p className="text-text-muted text-sm mt-4">（待替换为实际封面图）</p>
                  </div>
                </div>

                {/* Book Info */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full w-fit mb-4">
                    重点推荐
                  </span>
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-4">
                    《东方舞技巧大全》
                  </h2>
                  <p className="text-text-secondary text-lg mb-6">
                    中东埃及舞蹈术语图解
                  </p>
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <PenTool className="w-5 h-5 text-gold" />
                      <span className="text-text">作者：伊娃</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Book className="w-5 h-5 text-gold" />
                      <span className="text-text">出版社：中南大学出版社</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Award className="w-5 h-5 text-gold" />
                      <div>
                        <p className="text-text font-medium">核心数据</p>
                        <p className="text-text-secondary text-sm">102种技巧 · 500种变型 · 12年匠心呈现</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-text-secondary leading-relaxed">
                    本书围绕东方舞核心技巧、动作变化与教学应用展开，适合作为系统训练、师资备课和课堂复盘的参考资料。
                  </p>
                </div>
              </div>
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
