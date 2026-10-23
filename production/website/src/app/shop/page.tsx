import ShopStorefront from "./storefront";
import { buildShareMetadata } from "@/lib/share-metadata";
export const metadata = buildShareMetadata({
  title: "伊娃甄选 · 伊娃东方舞商城",
  description: "伊娃东方舞官方电商商城，精选舞服与练习装备，快递包邮。",
  path: "/shop",
});
export default function ShopPage() {
  return <ShopStorefront />;
}
