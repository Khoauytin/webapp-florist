"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/admin/icon";
import { ErrorAlert, MoneyInput, Switch, toast } from "@/components/admin/ui";
import { findCustomerAction, saveOrderAction, searchProductsAction } from "@/server/actions/orders.actions";
import type { FormLine, OrderFormValues, PickCategory, PickProduct } from "@/components/admin/order-form-model";
import { formatMoney } from "@/lib/format";
import { CHANNEL_LABELS, type ChannelKey } from "@/lib/labels";

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

function Pic({ url, w, h }: { url: string | null; w: number; h: number }) {
  if (!url)
    return (
      <span className="noimg" style={w ? { width: w, height: h } : undefined} aria-hidden="true">
        <Icon name="image" className="icon-sm" />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={w || 300} height={h || 400} loading="lazy" />;
}

export function OrderForm({
  orderId,
  code,
  initial,
  initialProducts,
  categories,
}: {
  orderId: string | null;
  code?: string;
  initial: OrderFormValues;
  initialProducts: PickProduct[];
  categories: PickCategory[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [found, setFound] = useState<string | null>(initial.customerId ? initial.customerName : null);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [results, setResults] = useState(initialProducts);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const lookupSeq = useRef(0);
  const set = <K extends keyof OrderFormValues>(k: K, val: OrderFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    if (!q && !categoryId) {
      seq.current += 1;
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchProductsAction(q, categoryId || null);
        if (n === seq.current) setResults(rows);
      } catch {
        if (n === seq.current) setResults([]);
      } finally {
        if (n === seq.current) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      if (seq.current === n) seq.current += 1;
    };
  }, [categoryId, initialProducts, q]);

  const subtotal = v.lines.reduce((s, l) => s + (l.price ?? 0) * l.qty, 0);
  const total = Math.max(0, subtotal - v.discount) + v.shippingFee;
  const owed = Math.max(0, total - v.deposit);
  const shown = q || categoryId ? results : initialProducts;
  const isSearching = !!(q || categoryId) && searching;
  const selectedQty = new Map<string, number>();
  const selectedVariantQty = new Map<string, number>();
  for (const line of v.lines) selectedQty.set(line.productId, (selectedQty.get(line.productId) ?? 0) + line.qty);
  for (const line of v.lines) {
    const key = `${line.productId}:${line.productVariantId ?? ""}`;
    selectedVariantQty.set(key, (selectedVariantQty.get(key) ?? 0) + line.qty);
  }

  const lookup = async () => {
    if (v.customerPhone.replace(/\D/g, "").length < 9) return;
    const seq = ++lookupSeq.current;
    const c = await findCustomerAction(v.customerPhone);
    if (seq !== lookupSeq.current) return; // a newer lookup is running
    if (c) {
      setV((s) => ({ ...s, customerId: c.id, customerName: c.name, customerAddress: c.address ?? "", deliveryAddress: s.deliveryAddress || c.address || "" }));
      setFound(c.name);
    } else {
      setV((s) => ({ ...s, customerId: null }));
      setFound(null);
    }
  };
  const add = (p: PickProduct, variant = p.variants[0] ?? null) => {
    setV((s) => {
      const existing = s.lines.find((l) => l.productId === p.id && l.productVariantId === (variant?.id ?? null) && !l.id);
      if (existing) return { ...s, lines: s.lines.map((l) => (l === existing ? { ...l, qty: Math.min(10000, l.qty + 1) } : l)) };
      const line: FormLine = {
        key: newKey(),
        productId: p.id,
        productVariantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        code: p.code,
        name: p.name,
        price: variant?.price ?? p.price,
        isPriceEditable: !variant && p.price === null,
        imageUrl: p.imageUrl,
        qty: 1,
        note: "",
      };
      return { ...s, lines: [...s.lines, line] };
    });
    const price = variant?.price ?? p.price;
    toast(price === null ? `Đã thêm ${p.name} · nhập đơn giá bên dưới` : `Đã thêm ${p.name}${variant ? ` · ${variant.name}` : ""}`);
  };
  const updateLine = (key: string, patch: Partial<FormLine>) => setV((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const updateQuotedPrice = (key: string, price: number | null) => {
    updateLine(key, { price });
    if (price !== null && fieldErrors.items) {
      setFieldErrors((errors) => {
        const next = { ...errors };
        delete next.items;
        return next;
      });
      setError(null);
    }
  };
  const removeLine = (key: string) => setV((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== key) }));

  const submit = () => {
    const missingPrice = v.lines.find((line) => line.price === null);
    if (missingPrice) {
      const message = `Vui lòng nhập đơn giá cho ${missingPrice.name}.`;
      setError(message);
      setFieldErrors({ items: message });
      document.getElementById(`lp-${missingPrice.key}`)?.focus();
      return;
    }
    start(async () => {
      setError(null);
      setFieldErrors({});
      const r = await saveOrderAction(orderId, {
        customerId: v.customerId,
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        customerAddress: v.customerAddress || v.deliveryAddress,
        recipientName: v.sameRecipient ? undefined : v.recipientName,
        recipientPhone: v.sameRecipient ? undefined : v.recipientPhone,
        channel: v.channel,
        receiveType: v.receiveType,
        deliveryAddress: v.deliveryAddress,
        deliveryDate: v.deliveryDate,
        deliveryTimeFrom: v.deliveryTimeFrom || null,
        deliveryTimeTo: v.deliveryTimeTo || null,
        courierName: v.courierName,
        shippingFee: v.shippingFee,
        discount: v.discount,
        deposit: v.deposit,
        cardMessage: v.cardMessage,
        note: v.note,
        items: v.lines.map((l) => ({
          id: l.id ?? null,
          productId: l.productId,
          productVariantId: l.productVariantId,
          unitPrice: l.isPriceEditable ? l.price : undefined,
          qty: l.qty,
          note: l.note || undefined,
        })),
      });
      if (r.ok) {
        toast(r.message ?? "Đã lưu");
        router.push(`/admin/orders/${r.id}`);
        router.refresh();
      } else {
        setError(r.error ?? "Có lỗi xảy ra");
        setFieldErrors(r.fieldErrors ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const fe = fieldErrors;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <Link className="back" href={orderId ? `/admin/orders/${orderId}` : "/admin"}>
        <Icon name="back" />
        Hủy
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>{orderId ? `Sửa đơn ${code}` : "Tạo đơn mới"}</h1>
      <div className="stack">
        <ErrorAlert message={error} />

        <section className="card pad stack" aria-labelledby="f1">
          <h2 id="f1">Khách hàng</h2>
          <div className="field">
            <label htmlFor="ph">
              Số điện thoại <span className="req">*</span>
            </label>
            <input
              className="input"
              id="ph"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={v.customerPhone}
              aria-invalid={fe.customerPhone ? true : undefined}
              onChange={(e) => {
                set("customerPhone", e.target.value);
                if (found) {
                  setFound(null);
                  set("customerId", null);
                }
              }}
              onBlur={lookup}
            />
            {fe.customerPhone ? <span className="err">{fe.customerPhone}</span> : <span className="hint">Nhập số để tìm khách cũ. Khách mới sẽ được tạo khi lưu.</span>}
          </div>
          {found ? (
            <div className="found" role="status">
              <span>
                <b>{found}</b>
                <br />
                <span className="small">Khách cũ{v.customerAddress ? ` · ${v.customerAddress}` : ""}</span>
              </span>
              <Icon name="check" />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="cn">
                Tên khách <span className="req">*</span>
              </label>
              <input className="input" id="cn" value={v.customerName} onChange={(e) => set("customerName", e.target.value)} maxLength={120} aria-invalid={fe.customerName ? true : undefined} />
              {fe.customerName ? <span className="err">{fe.customerName}</span> : null}
            </div>
          )}
          <div className="field">
            <span className="label" id="ch-l">
              Kênh đặt
            </span>
            <div className="chips" role="group" aria-labelledby="ch-l">
              {(Object.keys(CHANNEL_LABELS) as ChannelKey[]).map((c) => (
                <button key={c} className="chip" type="button" aria-pressed={v.channel === c} onClick={() => set("channel", c)}>
                  {CHANNEL_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="card pad stack" aria-labelledby="f2">
          <h2 id="f2">Sản phẩm</h2>
          <div className="field">
            <span className="label" id="product-category-label">
              Danh mục
            </span>
            <div className="chips" role="group" aria-labelledby="product-category-label">
              <button className="chip" type="button" aria-pressed={!categoryId} onClick={() => setCategoryId("")}>
                Tất cả
              </button>
              {categories.map((category) => (
                <button key={category.id} className="chip" type="button" aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          <div className="search">
            <Icon name="search" />
            <label className="sr" htmlFor="ps">
              Tìm mẫu
            </label>
            <input className="input" id="ps" placeholder="Tìm mẫu theo tên hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </div>
          <p className="muted small" aria-live="polite">
            {isSearching ? "Đang tải sản phẩm..." : `${shown.length} mẫu · chạm vào ảnh để thêm`}
          </p>
          <div className="picker-grid" role="group" aria-label="Chạm để thêm mẫu">
            {!isSearching && shown.length ? (
              shown.map((p) => {
                const qty = selectedQty.get(p.id) ?? 0;
                const firstVariant = p.variants[0] ?? null;
                const shownPrice = firstVariant?.price ?? p.price;
                return (
                  <div key={p.id} className="pick-wrap">
                    <button className="pick" type="button" onClick={() => add(p)} aria-pressed={qty > 0} aria-label={`Thêm ${p.name}${firstVariant ? `, ${firstVariant.name}` : ""}${qty ? `, đang có ${qty}` : ""}`}>
                      <span className="pick-photo">
                        <Pic url={p.imageUrl} w={0} h={0} />
                        {qty ? <span className="pick-count">{qty}</span> : null}
                      </span>
                      <span className="nm">{p.name}</span>
                      {firstVariant ? <span className="pick-default">Mặc định · {firstVariant.name}</span> : null}
                      <span className="pr">{shownPrice === null ? "Liên hệ báo giá" : formatMoney(shownPrice)}</span>
                    </button>
                    {p.variants.length ? (
                      <div className="pick-variants" role="group" aria-label={`Chọn biến thể ${p.name}`}>
                        {p.variants.map((variant) => {
                          const variantQty = selectedVariantQty.get(`${p.id}:${variant.id}`) ?? 0;
                          return (
                            <button key={variant.id} type="button" aria-pressed={variantQty > 0} onClick={() => add(p, variant)}>
                              <span>{variant.name}</span>
                              <b>{formatMoney(variant.price)}</b>
                              {variantQty ? <small>× {variantQty}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              !isSearching && <p className="muted small">Không tìm thấy mẫu.</p>
            )}
          </div>
          {v.lines.length ? (
            <div>
              {v.lines.map((l) => (
                <div key={l.key} className="selline">
                  <Pic url={l.imageUrl} w={56} h={56} />
                  <div className="top">
                    <div>
                      <b>{l.name}</b>
                      {l.variantName ? <div className="line-variant">{l.variantName}</div> : null}
                      <div className="muted xs">
                        {l.code} · {l.id ? "Giá lúc đặt" : l.isPriceEditable ? "Giá báo khách" : "Giá catalog"}
                      </div>
                    </div>
                    <b>{l.price === null ? "Chưa nhập giá" : formatMoney(l.price * l.qty)}</b>
                  </div>
                  <div className="line-controls">
                    <div className="field">
                      <span className="label">Số lượng</span>
                      <div className="qty" role="group" aria-label={`Số lượng ${l.name}`}>
                        <button type="button" aria-label={l.qty > 1 ? "Giảm" : "Bỏ mẫu này"} onClick={() => (l.qty > 1 ? updateLine(l.key, { qty: l.qty - 1 }) : removeLine(l.key))}>
                          <Icon name={l.qty > 1 ? "minus" : "trash"} className="icon-sm" />
                        </button>
                        <output>{l.qty}</output>
                        <button type="button" aria-label="Tăng" onClick={() => updateLine(l.key, { qty: Math.min(10000, l.qty + 1) })}>
                          <Icon name="plus" className="icon-sm" />
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      {l.isPriceEditable ? (
                        <>
                          <label htmlFor={`lp-${l.key}`}>Đơn giá (đ)</label>
                          <MoneyInput id={`lp-${l.key}`} value={l.price} onChange={(price) => updateQuotedPrice(l.key, price)} placeholder="Nhập giá đã báo khách" invalid={l.price === null && !!fe.items} />
                        </>
                      ) : (
                        <>
                          <span className="label">{l.id ? "Đơn giá lúc đặt" : "Đơn giá"}</span>
                          <output className="fixed-price">{formatMoney(l.price ?? 0)}</output>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="field line-note">
                    <label htmlFor={`ln-${l.key}`}>Ghi chú cho mẫu</label>
                    <input className="input" id={`ln-${l.key}`} placeholder="Ví dụ: tông hồng, nơ trắng" value={l.note} onChange={(e) => updateLine(l.key, { note: e.target.value })} maxLength={300} />
                  </div>
                </div>
              ))}
              {fe.items ? <p className="err">{fe.items}</p> : null}
            </div>
          ) : (
            <p className={fe.items ? "err" : "muted small"}>{fe.items ?? "Chạm vào ảnh mẫu bên trên để thêm vào đơn."}</p>
          )}
        </section>

        <section className="card pad stack" aria-labelledby="f3">
          <h2 id="f3">Giao nhận</h2>
          <div className="seg" role="group" aria-label="Hình thức nhận">
            <button type="button" aria-pressed={v.receiveType === "DELIVERY"} onClick={() => set("receiveType", "DELIVERY")}>
              Giao tận nơi
            </button>
            <button type="button" aria-pressed={v.receiveType === "PICKUP"} onClick={() => set("receiveType", "PICKUP")}>
              Đến lấy
            </button>
          </div>
          <div className="field">
            <label htmlFor="dd">
              {v.receiveType === "PICKUP" ? "Ngày nhận (hạn chót)" : "Ngày giao (hạn chót)"} <span className="req">*</span>
            </label>
            <input className="input" id="dd" type="date" value={v.deliveryDate} onChange={(e) => set("deliveryDate", e.target.value)} aria-invalid={fe.deliveryDate ? true : undefined} />
            {fe.deliveryDate ? <span className="err">{fe.deliveryDate}</span> : null}
          </div>
          <div className="row2">
            <div className="field">
              <label htmlFor="tf">Từ giờ</label>
              <input className="input" id="tf" type="time" step={900} value={v.deliveryTimeFrom} onChange={(e) => set("deliveryTimeFrom", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="tt">Đến giờ</label>
              <input className="input" id="tt" type="time" step={900} value={v.deliveryTimeTo} onChange={(e) => set("deliveryTimeTo", e.target.value)} />
              {fe.deliveryTimeTo ? <span className="err">{fe.deliveryTimeTo}</span> : null}
            </div>
          </div>
          {v.receiveType === "DELIVERY" ? (
            <>
              <div className="field">
                <label htmlFor="ad">Địa chỉ giao</label>
                <input className="input" id="ad" value={v.deliveryAddress} onChange={(e) => set("deliveryAddress", e.target.value)} maxLength={300} autoComplete="street-address" />
              </div>
              <div className="field">
                <label htmlFor="cr">Người giao</label>
                <input className="input" id="cr" value={v.courierName} onChange={(e) => set("courierName", e.target.value)} maxLength={120} placeholder="Không bắt buộc" />
              </div>
            </>
          ) : null}
          <label className="check-row" style={{ justifyContent: "flex-start" }}>
            <Switch checked={v.sameRecipient} onChange={(b) => set("sameRecipient", b)} label="Người nhận là người đặt" />
            Người nhận là người đặt
          </label>
          {!v.sameRecipient ? (
            <div className="row2">
              <div className="field">
                <label htmlFor="rn">Người nhận</label>
                <input className="input" id="rn" value={v.recipientName} onChange={(e) => set("recipientName", e.target.value)} maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="rp">SĐT người nhận</label>
                <input className="input" id="rp" type="tel" inputMode="tel" value={v.recipientPhone} onChange={(e) => set("recipientPhone", e.target.value)} aria-invalid={fe.recipientPhone ? true : undefined} />
                {fe.recipientPhone ? <span className="err">{fe.recipientPhone}</span> : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="card pad stack" aria-labelledby="f4">
          <h2 id="f4">Tiền và ghi chú</h2>
          <div className="row2">
            <div className="field">
              <label htmlFor="sh">Phí ship (đ)</label>
              <MoneyInput id="sh" value={v.shippingFee} onChange={(n) => set("shippingFee", n ?? 0)} />
            </div>
            <div className="field">
              <label htmlFor="dc">Giảm giá (đ)</label>
              <MoneyInput id="dc" value={v.discount} onChange={(n) => set("discount", n ?? 0)} invalid={!!fe.discount} />
              {fe.discount ? <span className="err">{fe.discount}</span> : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor="dp">Đã cọc (đ)</label>
            <MoneyInput id="dp" value={v.deposit} onChange={(n) => set("deposit", n ?? 0)} invalid={!!fe.deposit} describedBy="dp-hint" />
            {fe.deposit ? <span className="err">{fe.deposit}</span> : <span className="hint" id="dp-hint">Khách trả nốt thì sửa bằng tổng tiền, hoặc bấm “Đã thu đủ” trong chi tiết đơn.</span>}
          </div>
          <div className="field">
            <label htmlFor="cm">Lời chúc trên thiệp</label>
            <input className="input" id="cm" value={v.cardMessage} onChange={(e) => set("cardMessage", e.target.value)} maxLength={500} placeholder="Không bắt buộc" />
          </div>
          <div className="field">
            <label htmlFor="nt">Ghi chú</label>
            <textarea className="textarea" id="nt" value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} />
          </div>
        </section>
      </div>

      <div className="sticky">
        <div>
          <div className="t">Tổng {formatMoney(total)} · Còn lại</div>
          <div className="v">{formatMoney(owed)}</div>
        </div>
        <button className="btn btn-ink" type="submit" disabled={pending}>
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Đang lưu...
            </>
          ) : orderId ? (
            "Lưu thay đổi"
          ) : (
            "Lưu đơn"
          )}
        </button>
      </div>
    </form>
  );
}
