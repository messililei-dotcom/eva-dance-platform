/** Public catalog data only: never include account, address or entitlement data. */
export function productShareDescription(product: {
  priceFen: number;
  category?: string;
  spec?: string;
  size?: string;
  color?: string;
}) {
  return [
    `¥${(product.priceFen / 100).toFixed(2)}`,
    ...new Set([product.category, product.spec, product.size, product.color === '默认' ? '' : product.color].filter(Boolean)),
    '伊娃甄选 · 官方商城',
  ].join(' · ');
}

export type CatalogSku = {
  id: string; name: string; category: string; groupName?: string;
  spec: string; size: string; color: string; priceFen: number; stock: number; image: string;
  detailText?: string; detailImages?: string[];
};
export function productGroupKey(product: CatalogSku) {
  // Grouping is an explicit merchandising decision, never a numeric id or fuzzy-name guess.
  return product.groupName ? JSON.stringify([product.category, product.groupName]) : JSON.stringify(['sku', product.id]);
}
export function groupCatalog<T extends CatalogSku>(products: T[]) {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const key = productGroupKey(product);
    const group = groups.get(key) || [];
    group.push(product); groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([key, variants]) => {
    const representative = variants.find(p => p.stock > 0) || variants[0];
    return { ...representative, key, variants, displayName: representative.groupName || representative.name,
      image: representative.image || variants.find(p => p.image)?.image || '',
      stock: variants.reduce((n,p) => n + p.stock, 0),
      priceFen: Math.min(...variants.map(p => p.priceFen)),
      maxPriceFen: Math.max(...variants.map(p => p.priceFen)),
    };
  });
}
