import type { Metadata } from 'next';
import { getDanceCircleArticle } from '@/data/dance-circle';
import { buildShareMetadata } from '@/lib/share-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getDanceCircleArticle(slug);
  if (!article) return {};
  return buildShareMetadata({
    title: article.title,
    description: article.summary,
    path: `/dance-circle/${encodeURIComponent(article.slug)}`,
    image: article.image,
    type: 'article',
  });
}

export default function LegacyOfflineReportLayout({ children }: Props) {
  return children;
}
