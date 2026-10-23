import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PlaceholderImageProps {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export default function PlaceholderImage({
  src = '/images/placeholder.svg',
  alt,
  className,
  priority = false,
}: PlaceholderImageProps) {
  // 检查是否为占位图
  const isPlaceholder = src === '/images/placeholder.svg';
  const usesLocalImage = src.startsWith('/images/') || src.startsWith('/api/course/series/cover/');
  const avifSource = src.startsWith('/images/courses/') && src.endsWith('.webp')
    ? src.replace(/\.webp$/, '.avif')
    : '';
  
  if (isPlaceholder) {
    return (
      <div className={cn('relative bg-sand/30 flex items-center justify-center', className)}>
        <svg className="w-12 h-12 text-sand" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center bg-gold/10">
          <span className="text-gold-dark/60 font-serif text-sm">图片筹备中 · {alt}</span>
        </div>
      </div>
    );
  }

  if (usesLocalImage) {
    return (
      <div className="relative w-full h-full">
        <picture className="block h-full w-full">
          {avifSource && <source srcSet={avifSource} type="image/avif" />}
          <img
            src={src}
            alt={alt}
            className={cn('w-full h-full object-cover', className)}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        </picture>
      </div>
    );
  }

  // 使用实际图片，固定尺寸
  return (
    <div className="relative w-full h-full">
      <Image
        src={src}
        alt={alt}
        width={400}
        height={400}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
        className={cn('w-full h-full object-cover', className)}
        priority={priority}
      />
    </div>
  );
}
