import type { Metadata } from "next";
import { publicCatalog } from "@/server/services/catalog.service";
import { getShopSettings } from "@/server/services/settings.service";
import { CatalogApp, type CatalogCategory, type CatalogProduct } from "@/components/catalog/catalog-app";
import "./catalog.css";

// Always read fresh data: the owner edits products and contact links from the admin.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getShopSettings();
  return {
    title: `${s.shopName}: hoa lụa, hoa sáp handmade`,
    description: `Các mẫu hoa bó, hoa hộp, hoa giỏ và hoa lồng đèn handmade của ${s.shopName}, kèm giá và kích thước.`,
  };
}

const COLORS = ["#F2798A", "#F58A2E", "#F2C230", "#A990E2", "#7EAFDC", "#5FB89A"];

export default async function HomePage() {
  const [cats, s] = await Promise.all([publicCatalog(), getShopSettings()]);
  const categories: CatalogCategory[] = cats.map((c, i) => ({ id: c.id, name: c.name, color: COLORS[i % COLORS.length] }));
  const products: CatalogProduct[] = cats.flatMap((c) =>
    c.products.map((p) => ({
      code: p.code,
      name: p.name,
      price: p.price,
      size: p.size,
      color: p.color,
      description: p.description,
      images: p.images.map((i) => i.url),
      categoryId: c.id,
      variants: p.variants.map((variant) => ({ id: variant.id, name: variant.name, price: variant.price })),
    })),
  );
  return (
    <CatalogApp
      categories={categories}
      products={products}
      shop={{
        name: s.shopName,
        phone: s.phone,
        zalo: s.zaloPhone ? `https://zalo.me/${s.zaloPhone}` : null,
        facebook: s.facebookUrl,
        messenger: s.messengerUrl ?? s.facebookUrl,
        tiktok: s.tiktokUrl,
      }}
    />
  );
}
