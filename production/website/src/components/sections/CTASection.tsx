'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CTASection() {
  return (
    <section className="relative overflow-hidden py-6 md:py-10">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gold rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm md:mb-6">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-white/90 text-sm">开启你的东方舞之旅</span>
        </div>

        <h2 className="mb-4 font-serif text-2xl font-bold leading-tight text-white md:mb-6 md:text-4xl lg:text-5xl">
          开启你的东方舞教师之路
        </h2>

        <p className="mx-auto mb-4 max-w-2xl text-base leading-relaxed text-white/80 md:mb-6 md:text-lg">
          无论零基础的舞蹈爱好者，还是想要提升教学能力的舞蹈教师，
          <br className="hidden sm:block" />
          伊娃东方舞都能为你提供系统、专业的指导与支持
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/courses"
            className="group px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-full hover:shadow-xl hover:shadow-gold/30 transition-all flex items-center gap-2"
          >
            立即开始
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/contact"
            className="px-8 py-3.5 bg-white/10 backdrop-blur-sm text-white font-medium rounded-full border border-white/30 hover:bg-white/20 transition-all"
          >
            咨询详情
          </Link>
        </div>
      </div>
    </section>
  );
}
