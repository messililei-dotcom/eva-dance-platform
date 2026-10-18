'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: '🏠', label: '首页' },
  { href: '/courses', icon: '📚', label: '课程' },
  { href: '/offline', icon: '🏫', label: '线下' },
  { href: '/about', icon: '✨', label: '关于' },
  { href: '/contact', icon: '📞', label: '联系' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const hideOnVideoLearning = /^\/courses\/[^/]+\/videos(?:\/|$)/.test(pathname || '');

  if (hideOnVideoLearning) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A1A]/95 backdrop-blur-xl border-t border-white/10 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname?.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 px-2 rounded-lg transition-all duration-200',
                isActive 
                  ? 'text-[#C8A96E]' 
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <span className={cn(
                'text-lg leading-none transition-transform duration-200',
                isActive && 'scale-110'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'text-[10px] font-medium leading-none',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
