import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('学员中心');

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
