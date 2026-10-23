'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

interface SlideData {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  link?: string;
}

const slides: SlideData[] = [
  {
    id: 1,
    title: '伊娃东方舞',
    subtitle: '专注东方舞师资培训 · 十二年匠心传承',
    description: '从零基础到专业教师，系统化课程体系助力每一位热爱东方舞的你',
    image: '/images/school/campus-1.jpg',
    link: '/courses'
  },
  {
    id: 2,
    title: '师资认证体系',
    subtitle: '培养10000+专业舞蹈教师',
    description: '完善的师资培训认证体系，助力学员成长为专业东方舞教师',
    image: '/images/courses/offline/heritage-disciple-program.jpg',
    link: '/courses/certification'
  },
  {
    id: 3,
    title: '国际舞蹈节',
    subtitle: 'Aiwa Aiwa Raks国际东方舞艺术节',
    description: '成功举办多届国际东方舞艺术节，学员与大师同台献艺',
    image: '/images/school/classroom-1.jpg',
    link: '/news'
  },
  {
    id: 4,
    title: '线下集训营',
    subtitle: '沉浸式学习体验',
    description: '定期举办线下集训营，面对面指导，快速提升舞蹈技能',
    image: '/images/courses/offline/weekend-dance-training.jpg',
    link: '/courses/offline'
  }
];

export default function CarouselSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // 自动播放
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  // 手动切换
  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // 3秒后恢复自动播放
    setTimeout(() => setIsAutoPlaying(true), 3000);
  }, []);

  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % slides.length);
  }, [currentSlide, goToSlide]);

  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + slides.length) % slides.length);
  }, [currentSlide, goToSlide]);

  return (
    <section className="relative h-[600px] md:h-[700px] overflow-hidden">
      {/* 轮播图片 */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <Image
            src={slide.image}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-crimson-dark/70 via-crimson/40 to-gold-dark/50" />
          
          {/* 内容叠加层 */}
          <div className="absolute inset-0 bg-black/40" />
          
          {/* 内容区域 */}
          <div className="relative z-20 h-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl text-center">
              {/* 标题 */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
                {slide.title}
              </h1>
              
              {/* 副标题 */}
              <h2 className="text-gold text-2xl sm:text-3xl md:text-4xl mb-6">
                {slide.subtitle}
              </h2>
              
              {/* 描述 */}
              <p className="text-white/80 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
                {slide.description}
              </p>
              
              {/* 按钮 */}
              {slide.link && (
                <a
                  href={slide.link}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-full hover:shadow-xl hover:shadow-gold/30 transition-all"
                >
                  了解详情
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 左右切换箭头 */}
      <button
        onClick={prevSlide}
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
        aria-label="上一张"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      
      <button
        onClick={nextSlide}
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
        aria-label="下一张"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* 底部指示器 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-gold w-8'
                : 'bg-white/50 hover:bg-white/70'
            }`}
            aria-label={`切换到第${index + 1}张`}
          />
        ))}
      </div>

      {/* 滚动提示 */}
      <div className="absolute bottom-8 right-8 z-30 flex items-center gap-2 text-white/60">
        <span className="text-xs">向下滚动</span>
        <ChevronRight className="w-4 h-4 rotate-90 animate-bounce" />
      </div>
    </section>
  );
}
