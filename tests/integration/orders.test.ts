import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  calendarMarks,
  changeStatus,
  createOrder,
  deleteOrder,
  getOrder,
  markPaidInFull,
  overview,
  shopTotals,
  topSellingProducts,
  todoSummary,
  updateOrder,
} from "@/server/services/orders.service";
import { setProductVisible, updateProduct } from "@/server/services/catalog.service";
import { makeCategory, makeProduct, orderInput, resetDb } from "./helpers";

afterAll(() => prisma.$disconnect());
beforeEach(() => resetDb());

async function setup() {
  const bo = await makeCategory();
  const red = await makeProduct(bo.id, { code: "BO-005", name: "Bó hoa sáp đỏ", price: 380000 });
  const box = await makeProduct(bo.id, { code: "BO-006", name: "Hộp hoa hồng đỏ", price: 650000 });
  return { bo, red, box };
}

describe("creating and editing orders", () => {
  it("stores money with deposit and keeps the price at order time", async () => {
    const { red, box, bo } = await setup();
    const { id, code } = await createOrder(orderInput([{ productId: red.id, qty: 20, note: "Bàn tiệc" }, { productId: box.id, qty: 1 }], { discount: 350000, shippingFee: 50000, deposit: 3000000 }));
    expect(code).toMatch(/^DH-\d{6}-001$/);
    await updateProduct(red.id, { name: "Bó hoa sáp đỏ mới", categoryId: bo.id, price: 400000, isVisible: true });
    const o = await getOrder(id);
    expect(o).toMatchObject({ subtotal: 8250000, total: 7950000, deposit: 3000000, status: "NEW" });
    expect(o?.items[0]).toMatchObject({ nameSnapshot: "Bó hoa sáp đỏ", unitPriceSnapshot: 380000, note: "Bàn tiệc" });
  });

  it("requires a delivery date and rejects deposits above the total", async () => {
    const { red } = await setup();
    await expect(createOrder(orderInput([{ productId: red.id, qty: 1 }], { deliveryDate: "" }))).rejects.toThrow(/ngày giao/);
    await expect(createOrder(orderInput([{ productId: red.id, qty: 1 }], { deposit: 500000 }))).rejects.toThrow(/cọc/);
  });

  it("lets hidden products be ordered and accepts a quoted price for unpriced ones", async () => {
    const { red, bo } = await setup();
    await setProductVisible(red.id, false);
    await expect(createOrder(orderInput([{ productId: red.id, qty: 1 }]))).resolves.toBeTruthy();
    const unpriced = await makeProduct(bo.id, { price: null, name: "Hoa bó 12" });
    const { id } = await createOrder(orderInput([{ productId: unpriced.id, unitPrice: 420000, qty: 2 }]));
    expect(await getOrder(id)).toMatchObject({ subtotal: 840000, total: 840000 });
    expect((await getOrder(id))?.items[0]).toMatchObject({ unitPriceSnapshot: 420000, qty: 2 });
    await expect(createOrder(orderInput([{ productId: unpriced.id, qty: 1 }]))).rejects.toThrow(/nhập đơn giá/i);
  });

  it("selects the first variant by default and snapshots the selected variant name and price", async () => {
    const { bo } = await setup();
    const product = await makeProduct(bo.id, { name: "Bó gấu", price: null });
    const variants = await Promise.all([
      prisma.productVariant.create({ data: { productId: product.id, name: "1 gấu", price: 390000, sortOrder: 0 } }),
      prisma.productVariant.create({ data: { productId: product.id, name: "3 gấu", price: 490000, sortOrder: 1 } }),
    ]);

    const firstOrder = await createOrder(orderInput([{ productId: product.id, qty: 1 }]));
    expect((await getOrder(firstOrder.id))?.items[0]).toMatchObject({
      productVariantId: variants[0].id,
      variantNameSnapshot: "1 gấu",
      unitPriceSnapshot: 390000,
    });

    const selectedOrder = await createOrder(orderInput([{ productId: product.id, productVariantId: variants[1].id, unitPrice: 1, qty: 2 }]));
    expect((await getOrder(selectedOrder.id))?.items[0]).toMatchObject({
      productVariantId: variants[1].id,
      variantNameSnapshot: "3 gấu",
      unitPriceSnapshot: 490000,
      qty: 2,
    });
  });

  it("rejects a variant from another product and keeps old snapshots after a variant is edited or deleted", async () => {
    const { bo } = await setup();
    const first = await makeProduct(bo.id, { name: "Bó gấu", price: null });
    const second = await makeProduct(bo.id, { name: "Bó khác", price: null });
    const chosen = await prisma.productVariant.create({ data: { productId: first.id, name: "3 gấu", price: 490000, sortOrder: 0 } });
    const wrong = await prisma.productVariant.create({ data: { productId: second.id, name: "Size L", price: 700000, sortOrder: 0 } });

    await expect(createOrder(orderInput([{ productId: first.id, productVariantId: wrong.id, qty: 1 }]))).rejects.toThrow(/không hợp lệ/i);
    const order = await createOrder(orderInput([{ productId: first.id, productVariantId: chosen.id, qty: 1 }]));
    await prisma.productVariant.update({ where: { id: chosen.id }, data: { name: "5 gấu", price: 650000 } });
    let line = (await getOrder(order.id))!.items[0];
    expect(line).toMatchObject({ variantNameSnapshot: "3 gấu", unitPriceSnapshot: 490000 });

    await prisma.productVariant.delete({ where: { id: chosen.id } });
    line = (await getOrder(order.id))!.items[0];
    expect(line).toMatchObject({ productVariantId: null, variantNameSnapshot: "3 gấu", unitPriceSnapshot: 490000 });

    await updateOrder(order.id, orderInput([{ id: line.id, productId: first.id, productVariantId: null, qty: 2 }]));
    line = (await getOrder(order.id))!.items[0];
    expect(line).toMatchObject({ qty: 2, productVariantId: null, variantNameSnapshot: "3 gấu", unitPriceSnapshot: 490000 });
  });

  it("editing keeps existing line prices, prices new lines today, and removes dropped lines", async () => {
    const { red, box, bo } = await setup();
    const { id } = await createOrder(orderInput([{ productId: red.id, qty: 2 }, { productId: box.id, qty: 1 }]));
    const [redLine] = (await getOrder(id))!.items;
    await updateProduct(red.id, { name: "Bó hoa sáp đỏ", categoryId: bo.id, price: 999000, isVisible: true });
    const extra = await makeProduct(bo.id, { price: null });
    await updateOrder(id, orderInput([{ id: redLine.id, productId: red.id, qty: 3 }, { productId: extra.id, unitPrice: 100000, qty: 2 }], { deposit: 100000 }));
    const o = (await getOrder(id))!;
    expect(o.items.map((i) => [i.nameSnapshot, i.unitPriceSnapshot, i.qty])).toEqual([["Bó hoa sáp đỏ", 380000, 3], [extra.name, 100000, 2]]);
    expect(o.total).toBe(3 * 380000 + 200000);
    expect(o.items[0].id).toBe(redLine.id);
  });

  it("reuses the customer found by phone, even when two orders arrive together", async () => {
    const { red } = await setup();
    await Promise.all([
      createOrder(orderInput([{ productId: red.id, qty: 1 }], { customerPhone: "+84 935 662 019" })),
      createOrder(orderInput([{ productId: red.id, qty: 1 }], { customerPhone: "0935.662.019" })),
    ]);
    expect(await prisma.customer.count()).toBe(1);
  });

  it("ignores a stale customer id when the typed phone belongs to someone else", async () => {
    const { red } = await setup();
    await createOrder(orderInput([{ productId: red.id, qty: 1 }]));
    const lan = await prisma.customer.findFirstOrThrow();
    await createOrder(orderInput([{ productId: red.id, qty: 1 }], { customerId: lan.id, customerPhone: "0912 345 678", customerName: "Trần Minh" }));
    const minh = await prisma.customer.findUniqueOrThrow({ where: { phone: "0912345678" } });
    expect(minh.name).toBe("Trần Minh");
    expect(await prisma.order.count({ where: { customerId: minh.id } })).toBe(1);
  });
});

describe("status, payment and delete", () => {
  it("moves forward, back, cancels and restores with timestamps", async () => {
    const { red } = await setup();
    const { id } = await createOrder(orderInput([{ productId: red.id, qty: 1 }]));
    expect(await changeStatus(id, "next")).toBe("DELIVERING");
    expect((await getOrder(id))?.deliveringAt).toBeTruthy();
    expect(await changeStatus(id, "next")).toBe("COMPLETED");
    expect((await getOrder(id))?.completedAt).toBeTruthy();
    await expect(changeStatus(id, "cancel")).rejects.toThrow();
    expect(await changeStatus(id, "back")).toBe("DELIVERING");
    expect((await getOrder(id))?.completedAt).toBeNull();
    expect(await changeStatus(id, "cancel")).toBe("CANCELLED");
    await expect(updateOrder(id, orderInput([{ productId: red.id, qty: 1 }]))).rejects.toThrow(/Khôi phục/);
    expect(await changeStatus(id, "restore")).toBe("NEW");
    expect((await getOrder(id))?.deliveringAt).toBeNull();
  });

  it("marks an order paid in full", async () => {
    const { red } = await setup();
    const { id } = await createOrder(orderInput([{ productId: red.id, qty: 2 }], { deposit: 100000 }));
    await markPaidInFull(id);
    expect((await getOrder(id))?.deposit).toBe(760000);
  });

  it("deletes only new or cancelled orders", async () => {
    const { red } = await setup();
    const a = await createOrder(orderInput([{ productId: red.id, qty: 1 }]));
    const b = await createOrder(orderInput([{ productId: red.id, qty: 1 }]));
    await changeStatus(b.id, "next");
    await expect(deleteOrder(b.id)).rejects.toThrow(/Chỉ xóa/);
    await deleteOrder(a.id);
    expect(await getOrder(a.id)).toBeNull();
    expect(await prisma.orderItem.count({ where: { orderId: a.id } })).toBe(0);
  });
});

describe("calendar, overview and to-do summary", () => {
  it("calculates completed revenue and stored task count for the shop", async () => {
    const { red } = await setup();
    expect(await shopTotals()).toEqual({ totalRevenue: 0, totalTasks: 0, cancelledTasks: 0 });

    await createOrder(orderInput([{ productId: red.id, qty: 1 }]));
    const completed = await createOrder(orderInput([{ productId: red.id, qty: 2 }]));
    await changeStatus(completed.id, "next");
    await changeStatus(completed.id, "next");
    const cancelled = await createOrder(orderInput([{ productId: red.id, qty: 3 }]));
    await changeStatus(cancelled.id, "cancel");

    expect(await shopTotals()).toEqual({ totalRevenue: 760000, totalTasks: 3, cancelledTasks: 1 });
  });

  it("returns the top five completed-order products by quantity or item revenue", async () => {
    const { bo, red, box } = await setup();
    const third = await makeProduct(bo.id, { code: "BO-007", name: "Hoa thứ ba", price: 100000 });
    const fourth = await makeProduct(bo.id, { code: "BO-008", name: "Hoa thứ tư", price: 200000 });
    const fifth = await makeProduct(bo.id, { code: "BO-009", name: "Hoa thứ năm", price: 300000 });
    const sixth = await makeProduct(bo.id, { code: "BO-010", name: "Hoa thứ sáu", price: 400000 });
    const exactTie = await makeProduct(bo.id, { code: "BO-011", name: "A - cùng hạng", price: 400000 });
    const completed = await createOrder(
      orderInput([
        { productId: red.id, qty: 4 },
        { productId: box.id, qty: 6 },
        { productId: third.id, qty: 5 },
        { productId: fourth.id, qty: 4 },
        { productId: fifth.id, qty: 4 },
        { productId: sixth.id, qty: 2 },
        { productId: exactTie.id, qty: 2 },
      ]),
    );
    await changeStatus(completed.id, "next");
    await changeStatus(completed.id, "next");
    const completedAgain = await createOrder(orderInput([{ productId: red.id, qty: 6 }]));
    await changeStatus(completedAgain.id, "next");
    await changeStatus(completedAgain.id, "next");
    await updateProduct(red.id, { name: red.name, categoryId: bo.id, price: 1, isVisible: true });
    await createOrder(orderInput([{ productId: sixth.id, qty: 100 }]));
    const delivering = await createOrder(orderInput([{ productId: sixth.id, qty: 300 }]));
    await changeStatus(delivering.id, "next");
    const cancelled = await createOrder(orderInput([{ productId: sixth.id, qty: 200 }]));
    await changeStatus(cancelled.id, "cancel");

    const byQuantity = await topSellingProducts("quantity");
    expect(byQuantity).toHaveLength(5);
    expect(byQuantity.map((product) => product.productId)).toEqual([red.id, box.id, third.id, fifth.id, fourth.id]);
    expect(byQuantity[0]).toMatchObject({ quantity: 10, revenue: 3800000 });

    const byRevenue = await topSellingProducts("revenue");
    expect(byRevenue).toHaveLength(5);
    expect(byRevenue.map((product) => product.productId)).toEqual([box.id, red.id, fifth.id, fourth.id, exactTie.id]);
    expect(byRevenue[0]).toMatchObject({ quantity: 6, revenue: 3900000 });
  });

  it("sums only NEW orders in the range, with quantity per product", async () => {
    const { red, box } = await setup();
    await prisma.productImage.createMany({
      data: [
        { productId: red.id, storagePath: "products/red/1.webp", url: "https://img.test/red-1.webp", sortOrder: 0, isPrimary: false },
        { productId: red.id, storagePath: "products/red/2.webp", url: "https://img.test/red-2.webp", sortOrder: 1, isPrimary: true },
      ],
    });
    const a = await createOrder(orderInput([{ productId: red.id, qty: 20 }, { productId: box.id, qty: 1 }], { deliveryDate: "2026-10-27", deposit: 3000000 }));
    await createOrder(orderInput([{ productId: red.id, qty: 6 }], { deliveryDate: "2026-10-28", deposit: 1000000 }));
    const delivering = await createOrder(orderInput([{ productId: red.id, qty: 5 }], { deliveryDate: "2026-10-27" }));
    await changeStatus(delivering.id, "next");
    const done = await createOrder(orderInput([{ productId: box.id, qty: 1 }], { deliveryDate: "2026-10-27" }));
    await changeStatus(done.id, "next");
    await changeStatus(done.id, "next");
    await createOrder(orderInput([{ productId: box.id, qty: 1 }], { deliveryDate: "2026-11-05" }));

    const month = await todoSummary("2026-10-01", "2026-10-31");
    expect(month).toMatchObject({ count: 2, total: 20 * 380000 + 650000 + 6 * 380000, deposit: 4000000 });
    expect(month.remaining).toBe(month.total - 4000000);
    expect(month.products.map((p) => [p.code, p.qty])).toEqual([["BO-005", 26], ["BO-006", 1]]);
    expect(month.products.map((p) => p.imageUrl)).toEqual(["https://img.test/red-2.webp", null]);

    const day = await todoSummary("2026-10-27", "2026-10-27");
    expect(day.count).toBe(1);
    expect(a.id).toBeTruthy();
  });

  it("returns one calendar marker per order and counts the overview cards", async () => {
    const { red } = await setup();
    await createOrder(orderInput([{ productId: red.id, qty: 1 }], { deliveryDate: "2026-10-27", deposit: 80000 }));
    await createOrder(orderInput([{ productId: red.id, qty: 1 }], { deliveryDate: "2026-10-27" }));
    const c = await createOrder(orderInput([{ productId: red.id, qty: 1 }], { deliveryDate: "2026-10-27" }));
    await changeStatus(c.id, "cancel");
    await createOrder(orderInput([{ productId: red.id, qty: 2 }], { deliveryDate: "2026-11-01" }));
    await createOrder(orderInput([{ productId: red.id, qty: 1 }], { deliveryDate: "2026-11-05" }));

    const marks = await calendarMarks("2026-10-01", "2026-11-30");
    expect(marks["2026-10-27"]).toEqual({ statuses: ["NEW", "NEW", "CANCELLED"], count: 3 });
    expect(marks["2026-11-01"].statuses).toEqual(["NEW"]);

    const ov = await overview("2026-10-27");
    expect(ov).toMatchObject({ todayCount: 2, weekCount: 3, newCount: 4, weekFrom: "2026-10-26", weekTo: "2026-11-01" });
    expect(ov.owedNew).toBe(380000 - 80000 + 380000 + 760000 + 380000);
  });
});
