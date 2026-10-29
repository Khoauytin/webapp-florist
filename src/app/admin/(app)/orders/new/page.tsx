import { listCategories, searchOrderableProducts } from "@/server/services/catalog.service";
import { findCustomerByPhone } from "@/server/services/customers.service";
import { OrderForm } from "@/components/admin/order-form";
import { emptyOrder } from "@/components/admin/order-form-model";
import { isYmd, todayVn } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Tạo đơn" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NewOrderPage({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const sp = await searchParams;
  const date = typeof sp.date === "string" && isYmd(sp.date) ? sp.date : todayVn();
  const initial = emptyOrder(date);
  const customer = typeof sp.phone === "string" ? await findCustomerByPhone(sp.phone) : null;
  if (customer) {
    Object.assign(initial, { customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address ?? "", deliveryAddress: customer.address ?? "" });
  }
  const [categoryRows, productRows] = await Promise.all([listCategories(), searchOrderableProducts("")]);
  const categories = categoryRows.map((c) => ({ id: c.id, name: c.name }));
  const products = productRows.map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price, imageUrl: p.images[0]?.url ?? null, variants: p.variants }));
  return <OrderForm orderId={null} initial={initial} initialProducts={products} categories={categories} />;
}
