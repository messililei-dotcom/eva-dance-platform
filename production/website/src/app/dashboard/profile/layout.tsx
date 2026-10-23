import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('个人资料');

export default function DashboardProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
