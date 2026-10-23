import DanceCircleArticlePage, { generateMetadata as generateArticleMetadata } from '@/app/dance-circle/[slug]/page';

export const dynamic = 'force-dynamic';

function articleParams() {
  return { params: Promise.resolve({ slug: 'eva-portrait-2026' }) };
}

export async function generateMetadata() {
  return generateArticleMetadata(articleParams());
}

export default async function EvaProfilePage() {
  return DanceCircleArticlePage(articleParams());
}
