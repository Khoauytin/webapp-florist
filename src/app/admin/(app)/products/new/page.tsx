import Link from "next/link";
import { listCategories, previewProductCode } from "@/server/services/catalog.service";
import { Icon } from "@/components/admin/icon";
import { ProductForm } from "@/components/admin/product-form";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Thêm sản phẩm" };

export default async function NewProductPage() {
  await requireUser();
  const categories = await listCategories();
  const first = categories[0];
  return (
    <>
      <Link className="back" href="/admin/products">
        <Icon name="back" />
        Sản phẩm
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>Thêm sản phẩm</h1>
      <ProductForm
        productId={null}
        categories={categories.map((c) => ({ id: c.id, name: c.name, codePrefix: c.codePrefix }))}
        initial={{ name: "", categoryId: first?.id ?? "", price: null, size: "", color: "", description: "", isVisible: true, variants: [] }}
        initialPreview={first ? await previewProductCode(first.id) : null}
      />
      <p className="muted small" style={{ marginTop: 12 }}>
        Ảnh được thêm sau khi tạo sản phẩm.
      </p>
    </>
  );
}
