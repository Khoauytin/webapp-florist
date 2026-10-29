import Link from "next/link";
import { listCategories, listProducts, productCounts } from "@/server/services/catalog.service";
import { Icon } from "@/components/admin/icon";
import { ProductGrid, QuickEdit } from "@/components/admin/products";
import { SearchForm } from "@/components/admin/search-form";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Sản phẩm" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const cat = typeof sp.cat === "string" && isUuid(sp.cat) ? sp.cat : undefined;
  const show = sp.show === "visible" || sp.show === "hidden" || sp.show === "noprice" ? sp.show : undefined;
  const quick = sp.mode === "quick";
  const [categories, counts, rows] = await Promise.all([listCategories(), productCounts(), listProducts({ q, categoryId: cat, visibility: show })]);
  const all = [...counts.values()].reduce((a, b) => a + b, 0);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, cat, show, mode: quick ? "quick" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };
  const data = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    price: r.variants[0]?.price ?? r.price,
    variantCount: r.variants.length,
    isVisible: r.isVisible,
    imageUrl: r.images[0]?.url ?? null,
  }));

  return (
    <>
      <div className="shead">
        <h1>Sản phẩm</h1>
        <div className="actions">
          <Link className="btn btn-light btn-sm" href="/admin/categories">
            <Icon name="tag" className="icon-sm" />
            Danh mục
          </Link>
          <Link className="btn btn-accent" href="/admin/products/new" aria-label="Thêm sản phẩm">
            <Icon name="plus" />
          </Link>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <SearchForm value={q} placeholder="Tìm theo tên hoặc mã" label="Tìm sản phẩm" />
      </div>
      <div className="chips" role="group" aria-label="Lọc theo danh mục" style={{ margin: "12px -16px 8px" }}>
        <Link className="chip" href={href({ cat: undefined })} aria-pressed={!cat} role="button">
          Tất cả ({all})
        </Link>
        {categories.map((c) => (
          <Link key={c.id} className="chip" href={href({ cat: c.id })} aria-pressed={cat === c.id} role="button">
            {c.name} ({counts.get(c.id) ?? 0})
          </Link>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Lọc theo trạng thái" style={{ margin: "0 -16px 12px" }}>
        {(
          [
            [undefined, "Mọi trạng thái"],
            ["visible", "Đang hiện trên web"],
            ["hidden", "Đang ẩn"],
            ["noprice", "Chưa có giá"],
          ] as const
        ).map(([k, l]) => (
          <Link key={l} className="chip" href={href({ show: k })} aria-pressed={show === k} role="button">
            {l}
          </Link>
        ))}
      </div>
      <div className="shead">
        <span className="muted small">{rows.length} mẫu · mẫu mờ là đang ẩn khỏi web</span>
        <div className="seg" role="group" aria-label="Chế độ xem">
          <Link className="segbtn" href={href({ mode: undefined })} aria-pressed={!quick} role="button">
            Lưới
          </Link>
          <Link className="segbtn" href={href({ mode: "quick" })} aria-pressed={quick} role="button">
            Sửa nhanh
          </Link>
        </div>
      </div>
      {quick ? <QuickEdit key={JSON.stringify(data.map((d) => d.id))} rows={data} /> : <ProductGrid key={JSON.stringify(data.map((d) => [d.id, d.isVisible]))} rows={data} />}
    </>
  );
}
