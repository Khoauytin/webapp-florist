import { notFound, redirect } from "next/navigation";
import { getOrder } from "@/server/services/orders.service";
import { listCategories, searchOrderableProducts } from "@/server/services/catalog.service";
import { OrderForm } from "@/components/admin/order-form";
import type { OrderFormValues } from "@/components/admin/order-form-model";
import { dbDateToYmd } from "@/lib/dates";
import { isUuid } from "@/lib/ids";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Sửa đơn" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const o = await getOrder(id);
  if (!o) notFound();
  if (o.status === "CANCELLED") redirect(`/admin/orders/${id}`);
  const initial: OrderFormValues = {
    customerId: o.customerId,
    customerName: o.customer.name,
    customerPhone: o.customer.phone,
    customerAddress: o.customer.address ?? "",
    sameRecipient: o.recipientName === o.customer.name && o.recipientPhone === o.customer.phone,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    channel: o.channel,
    receiveType: o.receiveType,
    deliveryAddress: o.deliveryAddress ?? "",
    deliveryDate: dbDateToYmd(o.deliveryDate),
    deliveryTimeFrom: o.deliveryTimeFrom ?? "",
    deliveryTimeTo: o.deliveryTimeTo ?? "",
    courierName: o.courierName ?? "",
    shippingFee: o.shippingFee,
    discount: o.discount,
    deposit: o.deposit,
    cardMessage: o.cardMessage ?? "",
    note: o.note ?? "",
    // Existing lines keep the name and price agreed when the order was taken.
    lines: o.items.map((i) => ({
      key: i.id,
      id: i.id,
      productId: i.productId,
      productVariantId: i.productVariantId,
      variantName: i.variantNameSnapshot,
      code: i.productCodeSnapshot,
      name: i.nameSnapshot,
      price: i.unitPriceSnapshot,
      isPriceEditable: false,
      imageUrl: i.product.images[0]?.url ?? null,
      extraPrice: i.extraPrice,
      extraNote: i.extraNote ?? "",
      qty: i.qty,
      note: i.note ?? "",
    })),
  };
  const [categoryRows, productRows] = await Promise.all([listCategories(), searchOrderableProducts("")]);
  const categories = categoryRows.map((c) => ({ id: c.id, name: c.name }));
  const products = productRows.map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price, imageUrl: p.images[0]?.url ?? null, variants: p.variants }));
  return <OrderForm orderId={o.id} code={o.code} initial={initial} initialProducts={products} categories={categories} />;
}
