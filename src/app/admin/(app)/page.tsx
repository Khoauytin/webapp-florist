import Link from "next/link";
import { overview, ordersInRange, statusCounts, weekBounds } from "@/server/services/orders.service";
import { getShopSettings } from "@/server/services/settings.service";
import { Icon } from "@/components/admin/icon";
import { OrderCard } from "@/components/admin/orders";
import { RangeSelect } from "@/components/admin/range-select";
import { endOfMonth, formatYmd, startOfMonth, todayVn, weekdayVi } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/labels";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Tổng quan" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const Flower = () => (
  <svg className="flower" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <circle cx="12" cy="12" r="2.6" />
    <path d="M12 9.4C10.2 7 10.6 3.8 12 3c1.4.8 1.8 4 0 6.4zM14.6 12c2.4-1.8 5.6-1.4 6.4 0-.8 1.4-4 1.8-6.4 0zM12 14.6c1.8 2.4 1.4 5.6 0 6.4-1.4-.8-1.8-4 0-6.4zM9.4 12C7 13.8 3.8 13.4 3 12c.8-1.4 4-1.8 6.4 0z" />
  </svg>
);

export default async function OverviewPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayVn();
  const range = sp.range === "month" || sp.range === "all" ? sp.range : "week";
  const status = (typeof sp.status === "string" && (ORDER_STATUSES as string[]).includes(sp.status) ? sp.status : "NEW") as OrderStatusKey;
  const week = weekBounds(today);
  const [from, to] = range === "week" ? [week.weekFrom, week.weekTo] : range === "month" ? [startOfMonth(today), endOfMonth(today)] : ["2000-01-01", "2100-12-31"];
  // New orders past their date are still to do, so the New list also includes the overdue ones.
  const OPEN_START = "2000-01-01";
  const [ov, list, counts, upToNow, settings] = await Promise.all([
    overview(today),
    ordersInRange(status === "NEW" ? OPEN_START : from, to, status),
    statusCounts(from, to),
    statusCounts(OPEN_START, to),
    getShopSettings(),
  ]);
  counts.NEW = upToNow.NEW;
  const href = (s: string) => `/admin?${new URLSearchParams({ ...(range !== "week" ? { range } : {}), status: s })}`;

  return (
    <>
      <div className="topbar">
        <Link className="hello" href="/admin/settings" aria-label={`Mở Thông tin shop: ${settings.shopName}`}>
          <span className="avatar">BN</span>
          <span className="hello-copy">
            <small>Thông tin shop</small>
            <b>{settings.shopName}</b>
          </span>
          <Icon name="gear" className="icon-sm hello-settings-icon" />
        </Link>
        <Link className="round-btn" href="/admin/today" aria-label={`${ov.todayCount} đơn hôm nay`}>
          <Icon name="bell" />
          {ov.todayCount ? <span className="count">{ov.todayCount}</span> : null}
        </Link>
      </div>
      <div className="shead">
        <h1>Tổng quan</h1>
        <span className="muted small">
          {weekdayVi(today)}, {formatYmd(today)}
        </span>
      </div>
      <div className="ov">
        <Link className="ov-lav" href="/admin/today">
          <Flower />
          <span className="num">{ov.todayCount}</span>
          <span className="lbl">
            Hôm nay <Icon name="next" className="icon-sm" />
          </span>
        </Link>
        <Link className="ov-peach" href="/admin/calendar?view=week&scope=week">
          <Flower />
          <span className="num">{ov.weekCount}</span>
          <span className="lbl">
            Tuần này <Icon name="next" className="icon-sm" />
          </span>
        </Link>
        <Link className="ov-sky" href="/admin?range=all&status=NEW#h-orders">
          <Flower />
          <span className="num">{ov.newCount}</span>
          <span className="lbl">
            Cần làm <Icon name="next" className="icon-sm" />
          </span>
        </Link>
        <Link className="ov-mint" href="/admin?range=all&status=NEW#h-orders">
          <Flower />
          <span className="num money">{formatMoney(ov.owedNew)}</span>
          <span className="lbl">
            Tiền cần thu <Icon name="next" className="icon-sm" />
          </span>
        </Link>
      </div>

      <section className="section" aria-labelledby="h-orders">
        <div className="shead">
          <h2 id="h-orders">Đơn hàng</h2>
          <RangeSelect value={range} status={status} />
        </div>
        <div className="chips" role="group" aria-label="Lọc theo trạng thái" style={{ marginBottom: 12 }}>
          {ORDER_STATUSES.map((s) => (
            <Link key={s} className="chip" href={href(s)} aria-pressed={status === s} role="button">
              {ORDER_STATUS_LABELS[s]} ({counts[s]})
            </Link>
          ))}
        </div>
        <div className="olist">
          {list.length ? (
            list.map((o) => <OrderCard key={o.id} o={o} />)
          ) : (
            <div className="card empty">
              <p className="muted">Không có đơn {ORDER_STATUS_LABELS[status].toLowerCase()} trong khoảng này.</p>
              <Link className="btn btn-ink" href="/admin/orders/new">
                <Icon name="plus" />
                Tạo đơn
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
