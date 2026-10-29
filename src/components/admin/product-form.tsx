"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { Dialog, ErrorAlert, Field, MoneyInput, Switch, toast } from "@/components/admin/ui";
import {
  archiveProductAction,
  deleteProductAction,
  previewCodeAction,
  removeImageAction,
  saveProductAction,
  setPrimaryImageAction,
  uploadImageAction,
} from "@/server/actions/catalog.actions";

export interface ProductFormValues {
  name: string;
  categoryId: string;
  price: number | null;
  size: string;
  color: string;
  description: string;
  isVisible: boolean;
  variants: { id?: string; key: string; name: string; price: number | null }[];
}

let variantKeySeq = 0;
const newVariantKey = () => `variant-${++variantKeySeq}`;

export function ProductForm({
  productId,
  code,
  initial,
  categories,
  initialPreview,
}: {
  productId: string | null;
  code?: string;
  initial: ProductFormValues;
  categories: { id: string; name: string; codePrefix: string }[];
  initialPreview: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [preview, setPreview] = useState(initialPreview);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const changeCategory = (id: string) => {
    set("categoryId", id);
    if (!productId && id) start(async () => setPreview(await previewCodeAction(id)));
  };
  const save = () =>
    start(async () => {
      setError(null);
      setFe({});
      const r = await saveProductAction(productId, {
        ...v,
        size: v.size || undefined,
        color: v.color || undefined,
        description: v.description || undefined,
        variants: v.variants.map(({ id, name, price }) => ({ id, name, price })),
      });
      if (!r.ok) {
        setError(r.error ?? "Có lỗi xảy ra");
        setFe(r.fieldErrors ?? {});
        return;
      }
      toast(productId ? (r.message ?? "Đã lưu") : `Đã tạo ${r.code}. Thêm ảnh cho mẫu ngay bên dưới.`);
      if (!productId) router.push(`/admin/products/${r.id}`);
      router.refresh();
    });
  const archive = () =>
    start(async () => {
      const r = await archiveProductAction(productId!);
      if (!r.ok) return setError(r.error ?? "Có lỗi xảy ra");
      toast(r.message ?? "Đã lưu trữ");
      router.push("/admin/products");
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      setDeleteError(null);
      const r = await deleteProductAction(productId!);
      if (!r.ok) return setDeleteError(r.error ?? "Không thể xóa sản phẩm");
      toast(r.message ?? "Đã xóa sản phẩm");
      router.push("/admin/products");
      router.refresh();
    });
  const addVariant = () =>
    setV((current) => ({
      ...current,
      variants: [...current.variants, { key: newVariantKey(), name: "", price: current.variants.length ? null : current.price }],
    }));
  const updateVariant = (key: string, patch: Partial<ProductFormValues["variants"][number]>) =>
    setV((current) => ({ ...current, variants: current.variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)) }));
  const removeVariant = (key: string) => setV((current) => ({ ...current, variants: current.variants.filter((variant) => variant.key !== key) }));
  const moveVariant = (index: number, direction: -1 | 1) =>
    setV((current) => {
      const swap = index + direction;
      if (swap < 0 || swap >= current.variants.length) return current;
      const variants = [...current.variants];
      [variants[index], variants[swap]] = [variants[swap], variants[index]];
      return { ...current, variants };
    });

  return (
    <form
      className="card pad stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      <div className="autocode">
        <Icon name="tag" className="icon-sm" />
        {productId ? (
          <span>
            Mã sản phẩm <b>{code}</b> (không đổi)
          </span>
        ) : preview ? (
          <span>
            Mã sẽ tự sinh khi lưu: <b>{preview}</b>
          </span>
        ) : (
          <span>Chọn danh mục để xem mã sẽ được tạo.</span>
        )}
      </div>
      <ErrorAlert message={error} />
      <Field label="Tên mẫu" htmlFor="pn" error={fe.name} required>
        <input className="input" id="pn" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={200} placeholder="Ví dụ: Bó hồng pastel" aria-invalid={fe.name ? true : undefined} />
      </Field>
      <Field label="Danh mục" htmlFor="pc" error={fe.categoryId} required>
        <select className="input fselect" id="pc" value={v.categoryId} onChange={(e) => changeCategory(e.target.value)} aria-invalid={fe.categoryId ? true : undefined}>
          <option value="">Chọn danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.codePrefix})
            </option>
          ))}
        </select>
      </Field>
      {v.variants.length ? null : (
        <Field label="Giá (đ)" htmlFor="pp" error={fe.price} hint="Để trống thì trang khách hiện “Liên hệ báo giá”. Mẫu chưa có giá chưa thêm vào đơn được.">
          <MoneyInput id="pp" value={v.price} onChange={(n) => set("price", n)} placeholder="Liên hệ báo giá" describedBy="pp-hint" />
        </Field>
      )}
      <section className="variant-editor" aria-labelledby="variant-title">
        <div className="variant-editor-head">
          <div>
            <h2 id="variant-title">Biến thể</h2>
            <p className="hint">Dùng cho size hoặc lựa chọn như 1 gấu, 3 gấu. Mỗi card có giá riêng.</p>
          </div>
          {!v.variants.length ? (
            <button className="btn btn-light btn-sm" type="button" onClick={addVariant}>
              <Icon name="plus" className="icon-sm" />
              Thêm biến thể
            </button>
          ) : null}
        </div>
        {fe.variants ? <p className="err">{fe.variants}</p> : null}
        {v.variants.length ? (
          <div className="variant-list">
            {v.variants.map((variant, index) => (
              <article className="variant-card" key={variant.key}>
                <div className="variant-card-head">
                  <div>
                    <b>Biến thể {index + 1}</b>
                    {index === 0 ? <span className="variant-default">Mặc định</span> : null}
                  </div>
                  <div className="variant-card-actions">
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => moveVariant(index, -1)} disabled={index === 0} aria-label={`Đưa biến thể ${index + 1} lên`}>
                      <Icon name="up" className="icon-sm" />
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => moveVariant(index, 1)} disabled={index === v.variants.length - 1} aria-label={`Đưa biến thể ${index + 1} xuống`}>
                      <Icon name="down" className="icon-sm" />
                    </button>
                    <button className="btn btn-ghost btn-sm variant-remove" type="button" onClick={() => removeVariant(variant.key)} aria-label={`Xóa biến thể ${index + 1}`}>
                      <Icon name="trash" className="icon-sm" />
                    </button>
                  </div>
                </div>
                <div className="row2">
                  <Field label="Tên biến thể" htmlFor={`variant-name-${variant.key}`} required>
                    <input
                      className="input"
                      id={`variant-name-${variant.key}`}
                      value={variant.name}
                      onChange={(event) => updateVariant(variant.key, { name: event.target.value })}
                      maxLength={120}
                      placeholder="Ví dụ: Size S hoặc 3 gấu"
                    />
                  </Field>
                  <Field label="Giá (đ)" htmlFor={`variant-price-${variant.key}`} required>
                    <MoneyInput id={`variant-price-${variant.key}`} value={variant.price} onChange={(price) => updateVariant(variant.key, { price })} placeholder="Nhập giá" />
                  </Field>
                </div>
              </article>
            ))}
            <button className="btn btn-light btn-block" type="button" onClick={addVariant} disabled={v.variants.length >= 20}>
              <Icon name="plus" />
              {v.variants.length >= 20 ? "Đã đủ 20 biến thể" : "Thêm card biến thể"}
            </button>
          </div>
        ) : (
          <p className="muted small">Không bắt buộc. Nếu thêm biến thể, giá chính phía trên sẽ không được sử dụng.</p>
        )}
      </section>
      <div className="row2">
        <Field label="Kích thước" htmlFor="psz">
          <input className="input" id="psz" value={v.size} onChange={(e) => set("size", e.target.value)} maxLength={120} placeholder="40 x 55 cm" />
        </Field>
        <Field label="Màu sắc" htmlFor="pcl">
          <input className="input" id="pcl" value={v.color} onChange={(e) => set("color", e.target.value)} maxLength={120} placeholder="Hồng, trắng" />
        </Field>
      </div>
      <Field label="Mô tả" htmlFor="pd">
        <textarea className="textarea" id="pd" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
      </Field>
      <label className="check-row">
        Hiện trên web
        <Switch checked={v.isVisible} onChange={(b) => set("isVisible", b)} label="Hiện trên web" />
      </label>
      <button className="btn btn-ink btn-block" type="submit" disabled={pending}>
        {pending ? "Đang lưu..." : productId ? "Lưu sản phẩm" : "Tạo sản phẩm"}
      </button>
      {productId ? (
        <button className="btn btn-light btn-block" type="button" onClick={() => setArchiving(true)} disabled={pending}>
          Lưu trữ mẫu này
        </button>
      ) : null}
      {productId ? (
        <button
          className="btn btn-danger btn-block"
          type="button"
          disabled={pending}
          onClick={() => {
            setDeleteError(null);
            setDeleting(true);
          }}
        >
          <Icon name="trash" />
          Xóa vĩnh viễn
        </button>
      ) : null}
      <Dialog open={archiving} onClose={() => setArchiving(false)} label="Lưu trữ mẫu">
        <h2>Lưu trữ mẫu {code}?</h2>
        <p className="muted">Mẫu sẽ biến khỏi trang khách và danh sách chọn khi tạo đơn. Các đơn cũ vẫn giữ nguyên tên và giá đã đặt.</p>
        <div className="actions">
          <button className="btn btn-light" type="button" onClick={() => setArchiving(false)}>
            Không
          </button>
          <button className="btn btn-danger" type="button" onClick={archive} disabled={pending}>
            Lưu trữ
          </button>
        </div>
      </Dialog>
      <Dialog open={deleting} onClose={() => setDeleting(false)} label="Xóa sản phẩm">
        <h2>Xóa vĩnh viễn mẫu {code}?</h2>
        <ErrorAlert message={deleteError} />
        <p className="muted">Sản phẩm và toàn bộ ảnh sẽ bị xóa, không thể khôi phục. Sản phẩm đã có trong đơn hàng sẽ không xóa được; bạn vẫn có thể ẩn khỏi web hoặc lưu trữ.</p>
        <div className="actions">
          <button className="btn btn-light" type="button" onClick={() => setDeleting(false)} disabled={pending}>
            Không
          </button>
          <button className="btn btn-danger" type="button" onClick={remove} disabled={pending}>
            {pending ? "Đang xóa..." : "Xóa vĩnh viễn"}
          </button>
        </div>
      </Dialog>
      <Link className="btn btn-light btn-block" href="/admin/products">
        Quay lại danh sách
      </Link>
    </form>
  );
}

/** Downscale in the browser so phone photos upload fast and stay under the request limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.88));
}

export function ImageManager({ productId, images }: { productId: string; images: { id: string; url: string; isPrimary: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    start(async () => {
      for (const file of Array.from(files)) {
        let blob: Blob = file;
        try {
          blob = await shrink(file);
        } catch {
          /* keep the original if the browser cannot decode it */
        }
        const fd = new FormData();
        fd.set("file", new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: blob.type || file.type }));
        const r = await uploadImageAction(productId, fd);
        if (!r.ok) {
          setMsg(r.error ?? "Không tải được ảnh");
          break;
        }
      }
      if (input.current) input.current.value = "";
      toast("Đã cập nhật ảnh");
      router.refresh();
    });
  };
  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Đã lưu") : (r.error ?? "Có lỗi xảy ra"));
      router.refresh();
    });

  return (
    <section className="card pad stack" aria-labelledby="h-img">
      <h2 id="h-img">Ảnh</h2>
      {images.length ? (
        <div className="imggrid">
          {images.map((img) => (
            <figure key={img.id} className={img.isPrimary ? "primary" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.isPrimary ? "Ảnh chính" : "Ảnh mẫu"} width={120} height={160} loading="lazy" />
              <figcaption>
                {img.isPrimary ? (
                  <span className="pill st-NEW">Ảnh chính</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => act(() => setPrimaryImageAction(productId, img.id))}>
                    Đặt chính
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => act(() => removeImageAction(productId, img.id))} aria-label="Xóa ảnh này">
                  Xóa
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted small">Chưa có ảnh. Ảnh đầu tiên sẽ là ảnh chính trên trang khách.</p>
      )}
      <ErrorAlert message={msg} />
      <div>
        <input ref={input} id="img-upload" type="file" accept="image/*" multiple className="sr" onChange={(e) => upload(e.target.files)} />
        <label htmlFor="img-upload" className="btn btn-light" aria-disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : <Icon name="image" />}
          {pending ? "Đang tải ảnh..." : "Thêm ảnh"}
        </label>
      </div>
    </section>
  );
}
