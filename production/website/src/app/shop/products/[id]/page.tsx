import { notFound } from 'next/navigation';
import { findPublicProduct } from '@/lib/product-share';
import { productShareDescription } from '@/lib/product-presentation';
import { buildShareMetadata } from '@/lib/share-metadata';
import ShopStorefront from '../../storefront';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const product = findPublicProduct((await params).id);
  if (!product) return { title: '商品已下架或不存在', robots: { index: false } };
  return buildShareMetadata({ title: product.name, description: productShareDescription({ ...product, priceFen: Math.round(Number(product.sale_price) * 100) }), image: product.image, path: `/shop/products/${encodeURIComponent(product.id)}` });
}
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!findPublicProduct(id)) notFound();
  return <ShopStorefront initialProductId={id} />;
}
