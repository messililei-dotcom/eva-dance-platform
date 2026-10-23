import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

export const metadata: Metadata = buildShareMetadata({
  title: '网课系统App安装教程',
  shareTitle: '伊娃东方舞网课App安装教程',
  description: '无需应用商店，教你在iPhone、安卓手机、Windows或Mac上安装伊娃东方舞网课系统App。',
  path: '/install',
  image: '/icons/pwa/icon-512-20261006.png',
  type: 'article',
  publishedTime: '2026-08-09',
});

export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return children;
}
