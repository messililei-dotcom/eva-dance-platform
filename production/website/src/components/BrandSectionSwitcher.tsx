import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandSection = 'culture' | 'selection';

const sections: Array<{ id: BrandSection; label: string; href: string }> = [
  { id: 'culture', label: '品牌文化', href: '/about' },
  { id: 'selection', label: '伊娃甄选', href: '/shop/selection' },
];

export default function BrandSectionSwitcher({ active }: { active: BrandSection }) {
  return (
    <nav
      aria-label="品牌栏目选择"
      className="mb-6 inline-flex rounded-full border border-white/20 bg-black/10 p-1 shadow-sm backdrop-blur-sm"
    >
      {sections.map((section) => {
        const isActive = section.id === active;
        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'min-w-[6.5rem] rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-white text-crimson-dark shadow-sm'
                : 'text-white/85 hover:bg-white/10 hover:text-white',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
