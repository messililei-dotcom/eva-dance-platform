import { pageMetadata } from '@/lib/page-catalog';

export const metadata = pageMetadata('about');

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
