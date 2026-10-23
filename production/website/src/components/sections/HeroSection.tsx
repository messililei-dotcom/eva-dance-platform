'use client';

import Link from 'next/link';
import { ArrowDown, ChevronLeft, ChevronRight, Bell, Calendar, Award, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

// 轮播数据
const slides = [
  {
    id: 1,
    title: '伊娃东方舞',
    subtitle: '让东方舞成为可以传承的文化',
    badge: '品牌文化 · 东方舞传播 · SWOD教学系统',
    description: '以东方舞文化为根，以身体训练、教材体系、作品创作与师资传承为路径，让热爱被训练成稳定的表达能力。',
    image: '/images/school/classroom-1.jpg',
    primaryBtn: { text: '进入品牌文化', href: '/about' },
    secondaryBtn: { text: '探索课程体系', href: '/courses' },
  },
  {
    id: 2,
    title: '根脉与标准',
    subtitle: '从风格理解到动作结构',
    badge: '东方舞文化 · 体系化训练',
    description: '从埃及东方舞的风格根源出发，把呼吸、核心、胸腰、胯部、手臂、旋转与音乐节奏拆解成清晰标准。',
    image: '/images/school/campus-1.jpg',
    primaryBtn: { text: '阅读品牌故事', href: '/about/brand-story' },
    secondaryBtn: { text: '查看教材', href: '/shop' },
  },
  {
    id: 3,
    title: '教材与课堂',
    subtitle: '把经验沉淀为方法',
    badge: '《东方舞技巧大全》 · 线上学院 · 线下集训',
    description: '出版教材、录播课程、线下师资班互相衔接，让学习者知道为什么练、如何练，以及如何把东方舞讲给更多人。',
    image: '/images/books/eastern-dance-techniques-cover.jpg',
    primaryBtn: { text: '了解更多', href: '/about' },
    secondaryBtn: { text: '购买书籍', href: '/shop' },
  },
];

// 新闻公告数据
const newsItems = [
  { id: 1, type: 'news', title: '伊娃老师受邀参加埃及国际东方舞节', date: '2026-04-20', icon: Calendar },
  { id: 2, type: 'notice', title: '2026年5月线上课程开课通知', date: '2026-04-18', icon: Bell },
  { id: 3, type: 'award', title: '学员张丽荣获全国东方舞大赛金奖', date: '2026-04-15', icon: Award },
];

// 快捷入口
const quickLinks = [
  { id: 1, icon: Users, label: '免费试听', href: '/enroll', color: 'bg-gold' },
  { id: 2, icon: Calendar, label: '课程日历', href: '/offline/schedule', color: 'bg-crimson' },
  { id: 3, icon: Award, label: '师资认证', href: '/certification', color: 'bg-gold-dark' },
];

export default function HeroSection() {
  const [loaded, setLoaded] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const slideInterval = useRef<NodeJS.Timeout | null>(null);

  // 自动轮播
  useEffect(() => {
    if (isAutoPlaying) {
      slideInterval.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 5000);
    }
    return () => {
      if (slideInterval.current) clearInterval(slideInterval.current);
    };
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // 3秒后恢复自动播放
    setTimeout(() => setIsAutoPlaying(true), 3000);
  };

  const nextSlide = () => goToSlide((currentSlide + 1) % slides.length);
  const prevSlide = () => goToSlide((currentSlide - 1 + slides.length) % slides.length);

  const slide = slides[currentSlide];

  return (
    <section className="relative hidden min-h-[100svh] items-center justify-center overflow-hidden px-0 pb-16 pt-24 md:flex md:pb-20 md:pt-24 lg:min-h-screen">
      {slides.map((item, index) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            currentSlide === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={item.image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority={index === 0}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-[#2A0909]/90 via-[#6B1010]/72 to-[#B8944E]/64" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-warm-white to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-12">
        {/* 主轮播区 - 占8列 */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center text-center">
          <div className={`transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-2 backdrop-blur-sm md:px-4">
              <span className="w-2 h-2 bg-gold rounded-full animate-pulse" />
              <span className="truncate text-xs text-white/90 md:text-sm">{slide.badge}</span>
            </div>

            {/* Title */}
            <h1 className="mt-5 font-serif text-[2.45rem] font-bold leading-[1.08] text-white sm:text-5xl md:mt-6 md:text-6xl lg:text-7xl">
              {slide.title}
              <span className="mt-2 block text-[2rem] leading-[1.15] text-gold sm:text-4xl md:text-5xl lg:text-6xl">
                {slide.subtitle}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mb-5 mt-4 max-w-3xl text-sm leading-7 text-white/84 sm:text-lg md:text-xl">
              {slide.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link
                href={slide.primaryBtn.href}
                className="group inline-flex justify-center rounded-full bg-gradient-to-r from-gold to-gold-dark px-8 py-3.5 font-medium text-white transition-all hover:shadow-xl hover:shadow-gold/30 sm:items-center sm:gap-2"
              >
                {slide.primaryBtn.text}
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href={slide.secondaryBtn.href}
                className="inline-flex justify-center rounded-full border border-white/30 bg-white/10 px-8 py-3.5 font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                {slide.secondaryBtn.text}
              </Link>
            </div>
          </div>

          {/* 轮播指示器 */}
          <div className={`mt-6 flex items-center gap-2 transition-all duration-1000 delay-500 sm:gap-4 md:mt-8 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
            {/* 左箭头 */}
            <button
              onClick={prevSlide}
              className="rounded-full border border-white/30 bg-white/10 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20"
              aria-label="上一张"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* 数字指示器 */}
            <div className="flex items-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  aria-label={`切换到第 ${index + 1} 张`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all sm:h-10 sm:w-10 sm:text-base ${
                    currentSlide === index
                      ? 'bg-gold text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            {/* 右箭头 */}
            <button
              onClick={nextSlide}
              className="rounded-full border border-white/30 bg-white/10 p-2 text-white backdrop-blur-sm transition-all hover:bg-white/20"
              aria-label="下一张"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* 进度条 */}
          <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/20 sm:w-64">
            <div
              className={`h-full bg-gold transition-all ${isAutoPlaying ? 'animate-progress' : ''}`}
              style={{ width: isAutoPlaying ? '100%' : `${((currentSlide + 1) / slides.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 侧边栏 - 新闻公告 + 快捷入口 */}
        <div className="hidden flex-col gap-4 md:flex lg:col-span-4">
          {/* 新闻公告栏 */}
          <div className={`bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 transition-all duration-1000 delay-700 ${loaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Bell className="w-4 h-4 text-gold" />
                新闻公告
              </h3>
              <Link href="/about" className="text-gold text-sm hover:underline">
                更多 →
              </Link>
            </div>
            <div className="space-y-2">
              {newsItems.map((item) => (
                <Link
                  key={item.id}
                  href="#"
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <item.icon className="w-4 h-4 text-gold mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm truncate group-hover:text-gold transition-colors">
                      {item.title}
                    </p>
                    <p className="text-white/50 text-xs">{item.date}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* 快捷入口 */}
          <div className={`bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 transition-all duration-1000 delay-800 ${loaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-gold rounded-full" />
              快捷入口
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-colors group"
                >
                  <div className={`w-10 h-10 ${link.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <link.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white/80 text-xs group-hover:text-gold transition-colors">
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* 数据统计卡片 */}
          <div className={`bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 transition-all duration-1000 delay-900 ${loaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gold text-2xl font-bold">50+</p>
                <p className="text-white/60 text-xs">国家学员</p>
              </div>
              <div className="text-center">
                <p className="text-gold text-2xl font-bold">12年</p>
                <p className="text-white/60 text-xs">专业培训</p>
              </div>
              <div className="text-center">
                <p className="text-gold text-2xl font-bold">10000+</p>
                <p className="text-white/60 text-xs">毕业学员</p>
              </div>
              <div className="text-center">
                <p className="text-gold text-2xl font-bold">100+</p>
                <p className="text-white/60 text-xs">传承弟子</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={`absolute bottom-5 left-1/2 hidden -translate-x-1/2 transition-all duration-1000 delay-1000 md:block ${loaded ? 'opacity-100' : 'opacity-0'}`}>
        <a href="#endorsement" className="flex flex-col items-center gap-2 text-white/60 hover:text-gold transition-colors">
          <span className="text-xs">向下探索</span>
          <ArrowDown className="w-5 h-5 animate-bounce" />
        </a>
      </div>

      {/* CSS for progress animation */}
      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-progress {
          animation: progress 5s linear infinite;
        }
      `}</style>
    </section>
  );
}
