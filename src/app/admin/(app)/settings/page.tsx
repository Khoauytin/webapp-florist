import Link from "next/link";
import { getShopSettings } from "@/server/services/settings.service";
import { shopTotals, topSellingProducts, type ProductRanking } from "@/server/services/orders.service";
import { logoutAction } from "@/server/actions/auth.actions";
import { formatPhone } from "@/server/domain/phone";
import { formatMoney, formatNumber } from "@/lib/format";
import { Icon } from "@/components/admin/icon";
import { SettingsForm } from "@/components/admin/settings-forms";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Thông tin shop" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const percentage = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const rank: ProductRanking = sp.rank === "revenue" ? "revenue" : "quantity";
  const [s, totals, products] = await Promise.all([getShopSettings(), shopTotals(), topSellingProducts(rank)]);
  const cancellationRate = totals.totalTasks === 0 ? 0 : (totals.cancelledTasks / totals.totalTasks) * 100;
  return (
    <>
      <Link className="back" href="/admin">
        <Icon name="back" />
        Tổng quan
      </Link>
      <h1 style={{ margin: "8px 0 16px" }}>Thông tin shop</h1>
      <section className="shop-totals" aria-label="Tổng quan toàn hệ thống">
        <div className="shop-total shop-total-revenue">
          <span className="shop-total-label">Tổng doanh thu</span>
          <strong>{formatMoney(totals.totalRevenue)}</strong>
          <small>Đơn đã hoàn thành</small>
        </div>
        <div className="shop-total shop-total-tasks">
          <span className="shop-total-label">Tổng công việc</span>
          <strong>{formatNumber(totals.totalTasks)}</strong>
          <small>Tất cả đơn trong hệ thống</small>
        </div>
        <div className="shop-total shop-total-cancelled">
          <span className="shop-total-label">Tỷ lệ hủy đơn</span>
          <strong>{percentage.format(cancellationRate)}%</strong>
          <small>
            {formatNumber(totals.cancelledTasks)}/{formatNumber(totals.totalTasks)} đơn đã hủy
          </small>
        </div>
      </section>
      <InstallAppCard />
      <section className="section" aria-labelledby="top-products-heading">
        <div className="shead shop-products-head">
          <div className="shop-products-title">
            <h2 id="top-products-heading">Top 5 sản phẩm bán chạy</h2>
            <p className="muted small">Chỉ tính các đơn đã hoàn thành</p>
          </div>
          <nav className="seg shop-rank-switch" aria-label="Xếp hạng sản phẩm theo">
            <Link className="segbtn" href="/admin/settings" aria-current={rank === "quantity" ? "page" : undefined} scroll={false}>
              Số lượng
            </Link>
            <Link className="segbtn" href="/admin/settings?rank=revenue" aria-current={rank === "revenue" ? "page" : undefined} scroll={false}>
              Doanh thu
            </Link>
          </nav>
        </div>
        {products.length ? (
          <ol className="shop-product-list">
            {products.map((product, index) => (
              <li className="card shop-product-row" key={product.productId}>
                <span className="shop-product-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="shop-product-copy">
                  <b>{product.name}</b>
                  <small>{product.code}</small>
                </span>
                <span className="shop-product-stats">
                  <span className={`shop-product-stat${rank === "quantity" ? " is-primary" : ""}`}>
                    <b>{formatNumber(product.quantity)}</b>
                    <small>đã bán</small>
                  </span>
                  <span className={`shop-product-stat${rank === "revenue" ? " is-primary" : ""}`}>
                    <b>{formatMoney(product.revenue)}</b>
                    <small>doanh thu</small>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="card pad muted">Chưa có sản phẩm nào trong đơn đã hoàn thành.</div>
        )}
      </section>
      <section className="section" aria-labelledby="shop-contact-heading">
        <div className="shead">
          <h2 id="shop-contact-heading">Thông tin hiển thị cho khách</h2>
        </div>
        <SettingsForm
          key={s.updatedAt.toISOString()}
          initial={{
            shopName: s.shopName,
            phone: s.phone ? formatPhone(s.phone) : "",
            zaloPhone: s.zaloPhone ? formatPhone(s.zaloPhone) : "",
            facebookUrl: s.facebookUrl ?? "",
            messengerUrl: s.messengerUrl ?? "",
            tiktokUrl: s.tiktokUrl ?? "",
          }}
        />
      </section>
      <div className="actions" style={{ marginTop: 16 }}>
        <a className="btn btn-light" href="/" target="_blank" rel="noopener">
          <Icon name="globe" className="icon-sm" />
          Xem trang khách
        </a>
        <Link className="btn btn-light" href="/admin/password">
          <Icon name="key" className="icon-sm" />
          Đổi mật khẩu
        </Link>
        <form action={logoutAction}>
          <button className="btn btn-danger" type="submit">
            <Icon name="out" className="icon-sm" />
            Đăng xuất
          </button>
        </form>
      </div>
    </>
  );
}
