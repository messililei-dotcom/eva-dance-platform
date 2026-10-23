import { pageMetadata } from '@/lib/page-catalog';

export const metadata = pageMetadata('students');

export default function StudentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
