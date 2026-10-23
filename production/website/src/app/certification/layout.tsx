import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '师资认证与证书查询',
  shareTitle: '伊娃东方舞师资认证',
  description: '查询伊娃东方舞师资认证证书。',
  path: '/certification',
});

export default function CertificationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
