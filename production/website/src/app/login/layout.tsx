import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('学员登录');

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
