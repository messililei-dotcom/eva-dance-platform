import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('我的课程');

export default function DashboardCoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
