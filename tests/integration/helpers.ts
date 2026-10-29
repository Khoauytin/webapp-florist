import { prisma } from "@/server/db/prisma";
import type { OrderInput } from "@/server/services/orders.service";

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Integration tests must run against a *_test database (TEST_DATABASE_URL).");
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    order_items, orders, order_counters, product_variants, product_images, products, product_code_counters,
    categories, customers, shop_settings, sessions, accounts, verifications, users
    RESTART IDENTITY CASCADE`);
}

export async function makeCategory(name = "Hoa bó", codePrefix = "BO", isVisible = true) {
  return prisma.category.create({ data: { name, codePrefix, isVisible } });
}

let seq = 0;
/** Inserts a product with an explicit code (like the catalog import does). */
export async function makeProduct(categoryId: string, opts: { code?: string; price?: number | null; name?: string; isVisible?: boolean } = {}) {
  seq += 1;
  return prisma.product.create({
    data: {
      code: opts.code ?? `T-${String(seq).padStart(3, "0")}`,
      name: opts.name ?? `Mẫu ${seq}`,
      categoryId,
      price: opts.price === undefined ? 350000 : opts.price,
      isVisible: opts.isVisible ?? true,
    },
  });
}

export function orderInput(items: OrderInput["items"], extra: Partial<OrderInput> = {}): OrderInput {
  return {
    customerName: "Lê Thị Lan",
    customerPhone: "0935 662 019",
    channel: "FACEBOOK",
    receiveType: "DELIVERY",
    deliveryAddress: "9 Trần Duy Hưng, Cầu Giấy",
    deliveryDate: "2026-10-27",
    deliveryTimeFrom: "14:00",
    deliveryTimeTo: "15:00",
    shippingFee: 0,
    discount: 0,
    deposit: 0,
    items,
    ...extra,
  };
}
