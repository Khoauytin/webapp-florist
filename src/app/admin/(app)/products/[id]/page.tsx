import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listCategories } from "@/server/services/catalog.service";
import { Icon } from "@/components/admin/icon";
import { ImageManager, ProductForm } from "@/components/admin/product-form";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Sửa sản phẩm" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [p, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!p || p.isArchived) notFound();
  return (
    <>
      <Link className="back" href="/admin/products">
        <Icon name="back" />
        Sản phẩm
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>{p.name}</h1>
      <div className="stack">
        <ImageManager productId={p.id} images={p.images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary }))} />
        <ProductForm
          key={p.updatedAt.toISOString()}
          productId={p.id}
          code={p.code}
          categories={categories.map((c) => ({ id: c.id, name: c.name, codePrefix: c.codePrefix }))}
          initial={{
            name: p.name,
            categoryId: p.categoryId,
            price: p.price,
            size: p.size ?? "",
            color: p.color ?? "",
            description: p.description ?? "",
            isVisible: p.isVisible,
            variants: p.variants.map((variant) => ({ id: variant.id, key: variant.id, name: variant.name, price: variant.price })),
          }}
          initialPreview={null}
        />
      </div>
    </>
  );
}
