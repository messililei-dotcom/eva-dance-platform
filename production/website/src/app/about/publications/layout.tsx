import { pageMetadata } from '@/lib/page-catalog';

export const metadata = pageMetadata('publications');

export default function PublicationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
