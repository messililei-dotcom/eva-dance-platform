import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  number?: string;
  icon?: LucideIcon;
  badge?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}

export default function SectionHeader({
  number,
  icon,
  badge,
  title,
  subtitle,
  align = 'center'
}: SectionHeaderProps) {
  const Icon = icon;
  
  return (
    <div className={`mb-4 md:mb-12 ${align === 'center' ? 'text-center' : ''}`}>
      {/* 编号+图标 */}
      {(number || Icon) && (
        <div className={`mb-1 flex items-center gap-2 md:mb-3 md:gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
          {number && (
            <span className="font-serif text-2xl md:text-4xl font-bold text-gold/30">
              {number}
            </span>
          )}
          {Icon && (
            <Icon className="w-5 h-5 md:w-8 md:h-8 text-gold" />
          )}
        </div>
      )}
      
      {/* Badge */}
      {badge && (
        <span className="mb-2 inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-medium text-gold-dark md:mb-3 md:text-sm">
          {badge}
        </span>
      )}
      
      {/* Title */}
      <h2 className="font-serif text-2xl font-bold leading-tight text-text md:mb-4 md:text-4xl lg:text-5xl">
        {title}
      </h2>

      {subtitle && (
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-text-secondary md:mt-3 md:text-base">
          {subtitle}
        </p>
      )}
      
      {/* 分隔线 */}
      <div className={`mt-3 md:mt-6 ${align === 'center' ? 'flex justify-center' : ''}`}>
        <div className="h-0.5 w-12 rounded-full bg-gradient-to-r from-gold to-gold-dark md:h-1 md:w-16" />
      </div>
    </div>
  );
}
