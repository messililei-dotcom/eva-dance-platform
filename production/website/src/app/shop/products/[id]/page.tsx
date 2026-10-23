import { notFound } from 'next/navigation';
import { findPublicProduct } from '@/lib/product-share';
import { buildShareMetadata } from '@/lib/share-metadata';
import ShopStorefront from '../../storefront';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const product = findPublicProduct((await params).id);
  if (!product) return { title: '商品已下架或不存在', robots: { index: false } };
  return buildShareMetadata({ title: product.name, description: [product.category, product.spec, product.size, product.color, '伊娃甄选 · 官方商城'].filter(Boolean).join(' · '), image: product.image, path: `/shop/products/${encodeURIComponent(product.id)}` });
}
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!findPublicProduct(id)) notFound();
  return <ShopStorefront initialProductId={id} />;
}
