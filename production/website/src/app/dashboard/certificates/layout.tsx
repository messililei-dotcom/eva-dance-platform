import { privatePageMetadata } from '@/lib/page-catalog';

export const metadata = privatePageMetadata('我的证书');

export default function CertificatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
