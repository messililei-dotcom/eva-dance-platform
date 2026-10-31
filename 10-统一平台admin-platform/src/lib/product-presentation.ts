const limits = { group_name: 120, storefront_category: 60, detail_text: 12000, detail_images: 10000 } as const;
export function parseProductPresentation(body: Record<string, unknown>): { values: Record<string,string>; error?: string } {
  const values: Record<string,string> = {};
  for (const field of Object.keys(limits) as (keyof typeof limits)[]) {
    if (!(field in body)) continue;
    if (typeof body[field] !== 'string' || body[field].length > limits[field]) return {values:{},error:'商城展示信息格式无效或超出长度限制'};
    values[field] = body[field].trim();
  }
  if (values.detail_images) {
    const images = values.detail_images.split('\n').map(s => s.trim()).filter(Boolean);
    if (images.length > 12 || images.some(url => !/^https:\/\/[^\s]+$/i.test(url) && !/^\/(?:uploads|api\/upload)[/\w.%+-]+$/.test(url))) return {values:{},error:'详情图片最多12张，请使用已上传图片路径或HTTPS图片地址'};
    values.detail_images = images.join('\n');
  }
  return {values};
}
