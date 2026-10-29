import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/server/services/orders.service";
import { formatPhone } from "@/server/domain/phone";
import { Icon } from "@/components/admin/icon";
import { StatusPill, Thumb, timeText } from "@/components/admin/orders";
import { OrderMenu } from "@/components/admin/order-menu";
import { OrderActions } from "@/components/admin/order-actions";
import { dbDateToYmd, formatDateTime, formatYmd, weekdayVi } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { CHANNEL_LABELS, ORDER_STATUS_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Chi tiết đơn" };

const FLOW = ["NEW", "DELIVERING", "COMPLETED"] as const;

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const o = await getOrder(id);
  if (!o) notFound();
  const idx = FLOW.indexOf(o.status as (typeof FLOW)[number]);
  const owed = Math.max(0, o.total - o.deposit);
  const date = dbDateToYmd(o.deliveryDate);
  const qty = o.items.reduce((s, i) => s + i.qty, 0);

  return (
    <>
      <Link className="back" href="/admin">
        <Icon name="back" />
        Tổng quan
      </Link>
      <div className="shead" style={{ marginTop: 8 }}>
        <div>
          <h1>{o.customer.name}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            {o.code} · Kênh {CHANNEL_LABELS[o.channel]}
          </p>
        </div>
        <div className="actions" style={{ alignItems: "center", flexWrap: "nowrap" }}>
          <StatusPill status={o.status} />
          <OrderMenu id={o.id} code={o.code} status={o.status} afterDelete="/admin" />
        </div>
      </div>

      <div className="card pad stack">
        {idx >= 0 ? (
          <ol className="steps" aria-label="Tiến trình">
            {FLOW.map((s, k) => (
              <li key={s} className={k < idx ? "done" : k === idx ? "now" : undefined} aria-current={k === idx ? "step" : undefined}>
                {ORDER_STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted">Đơn đã hủy lúc {o.cancelledAt ? formatDateTime(o.cancelledAt) : ""}. Khôi phục để tiếp tục xử lý.</p>
        )}
        <OrderActions id={o.id} status={o.status} owed={owed} />
      </div>

      <section className="section">
        <div className="card pad">
          <h2 style={{ marginBottom: 12 }}>Thời gian</h2>
          <dl className="kv">
            <dt>Hạn giao</dt>
            <dd className="deadline">
              {weekdayVi(date)}, {formatYmd(date)} · {timeText(o)}
            </dd>
            <dt>Tạo lúc</dt>
            <dd>{formatDateTime(o.createdAt)}</dd>
            {o.deliveringAt ? (
              <>
                <dt>Bắt đầu giao</dt>
                <dd>{formatDateTime(o.deliveringAt)}</dd>
              </>
            ) : null}
            {o.completedAt ? (
              <>
                <dt>Hoàn thành</dt>
                <dd>{formatDateTime(o.completedAt)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="card pad">
          <h2 style={{ marginBottom: 12 }}>Khách hàng</h2>
          <dl className="kv">
            <dt>Người đặt</dt>
            <dd>
              <Link className="link" href={`/admin/customers/${o.customer.id}`}>
                {o.customer.name}
              </Link>{" "}
              · <a href={`tel:${o.customer.phone}`}>{formatPhone(o.customer.phone)}</a>
            </dd>
            <dt>Người nhận</dt>
            <dd>
              {o.recipientName} · <a href={`tel:${o.recipientPhone}`}>{formatPhone(o.recipientPhone)}</a>
            </dd>
            <dt>Hình thức</dt>
            <dd>{RECEIVE_TYPE_LABELS[o.receiveType]}</dd>
            {o.deliveryAddress ? (
              <>
                <dt>Địa chỉ</dt>
                <dd>{o.deliveryAddress}</dd>
              </>
            ) : null}
            {o.courierName ? (
              <>
                <dt>Người giao</dt>
                <dd>{o.courierName}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="card pad">
          <div className="shead">
            <h2>Sản phẩm</h2>
            <span className="muted small">{qty} sản phẩm</span>
          </div>
          {o.items.map((i) => (
            <div key={i.id} className="line">
              <Thumb url={i.product.images[0]?.url} size={[56, 56]} />
              <div>
                <div className="nm">{i.nameSnapshot}</div>
                {i.variantNameSnapshot ? <div className="line-variant">{i.variantNameSnapshot}</div> : null}
                <div className="meta">
                  {i.productCodeSnapshot} · {formatMoney(i.unitPriceSnapshot)} × {i.qty}
                </div>
                {i.note ? <div className="note">{i.note}</div> : null}
              </div>
              <b>{formatMoney(i.unitPriceSnapshot * i.qty)}</b>
            </div>
          ))}
        </div>
      </section>

      {o.cardMessage || o.note ? (
        <section className="section">
          <div className="card pad">
            <h2 style={{ marginBottom: 12 }}>Ghi chú</h2>
            <dl className="kv">
              {o.cardMessage ? (
                <>
                  <dt>Lời chúc</dt>
                  <dd>{o.cardMessage}</dd>
                </>
              ) : null}
              {o.note ? (
                <>
                  <dt>Ghi chú</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{o.note}</dd>
                </>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="card pad">
          <h2 style={{ marginBottom: 12 }}>Thanh toán</h2>
          <div className="moneybox">
            <div>
              <span className="muted">Tạm tính</span>
              <span>{formatMoney(o.subtotal)}</span>
            </div>
            <div>
              <span className="muted">Giảm giá</span>
              <span>{o.discount ? `-${formatMoney(o.discount)}` : "0đ"}</span>
            </div>
            <div>
              <span className="muted">Phí ship</span>
              <span>{formatMoney(o.shippingFee)}</span>
            </div>
            <div className="total">
              <span>Tổng tiền</span>
              <span>{formatMoney(o.total)}</span>
            </div>
            <div>
              <span className="muted">Đã cọc</span>
              <span>{formatMoney(o.deposit)}</span>
            </div>
            <div>
              <span className="muted">Còn lại</span>
              <span className={owed ? "left" : "left zero"}>{formatMoney(owed)}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
