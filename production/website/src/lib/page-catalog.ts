import type { Metadata } from 'next';
import { buildShareMetadata } from '@/lib/share-metadata';

type PageDefinition = {
  title: string;
  shareTitle?: string;
  description: string;
  path: string;
  image?: string;
};

export const PAGE_CATALOG = {
  about: {
    title: '关于伊娃东方舞',
    shareTitle: '关于伊娃东方舞',
    description: '了解伊娃东方舞品牌、SWOD教学体系、教材与师资传承。',
    path: '/about',
  },
  brandStory: {
    title: '品牌故事与SWOD教学体系',
    shareTitle: '伊娃东方舞品牌故事',
    description: '从东方舞课堂经验到SWOD系统课程、教材、作品与师资传承。',
    path: '/about/brand-story',
  },
  partners: {
    title: '合作伙伴',
    shareTitle: '伊娃东方舞合作伙伴',
    description: '伊娃东方舞出版、教学、赛事与行业合作伙伴。',
    path: '/about/partners',
  },
  publications: {
    title: '教材与出版',
    shareTitle: '伊娃东方舞教材与出版',
    description: '伊娃东方舞教材、专业出版物与东方舞标准化教学成果。',
    path: '/about/publications',
  },
  students: {
    title: '学员风采',
    shareTitle: '伊娃东方舞学员风采',
    description: '伊娃东方舞学员成长、课堂训练与舞台成果展示。',
    path: '/about/students',
  },
  danceCollection: {
    title: '成品舞课程',
    shareTitle: '伊娃东方舞成品舞',
    description: '伊娃原创东方舞、国风与新现代融舞成品舞作品。',
    path: '/courses',
  },
  festival: {
    title: '国际东方舞艺术节',
    shareTitle: '伊娃国际东方舞艺术节',
    description: '伊娃东方舞国际艺术节、舞台展演与赛事活动。',
    path: '/festival',
  },
  festival2023: {
    title: '2023长沙国际东方舞艺术节',
    shareTitle: '2023长沙东方舞艺术节',
    description: '2023长沙国际东方舞艺术节活动回顾与精彩内容。',
    path: '/festival/2023-changsha',
  },
  offlineSchedule: {
    title: '线下课程排期',
    shareTitle: '伊娃东方舞线下排期',
    description: '查看伊娃东方舞线下集训营、大师班与师资班开课安排。',
    path: '/offline/schedule',
  },
} satisfies Record<string, PageDefinition>;

export type PageCatalogKey = keyof typeof PAGE_CATALOG;

export function pageMetadata(key: PageCatalogKey): Metadata {
  return buildShareMetadata(PAGE_CATALOG[key]);
}

export function privatePageMetadata(title: string): Metadata {
  return {
    title,
    description: '伊娃东方舞学员专属服务页面。',
    alternates: { canonical: 'https://www.swod.com.cn/' },
    robots: { index: false, follow: false, noarchive: true },
    openGraph: {
      title: '伊娃东方舞',
      description: '东方舞系统课程、线下培训与师资认证。',
      url: 'https://www.swod.com.cn/',
      siteName: '伊娃东方舞',
      type: 'website',
      images: [{ url: 'https://www.swod.com.cn/icons/icon-512-20261005.png', width: 512, height: 512 }],
      locale: 'zh_CN',
    },
    other: {
      'weixin:title': '伊娃东方舞',
      'weixin:description': '东方舞系统课程、线下培训与师资认证。',
      'weixin:image': 'https://www.swod.com.cn/icons/icon-512-20261005.png',
    },
  };
}
