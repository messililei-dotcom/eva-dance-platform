import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('我的比赛');

export default function DashboardEventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
