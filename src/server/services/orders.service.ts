import { Prisma, type OrderChannel, type OrderStatus, type ReceiveType } from "@/generated/prisma/client";
import { prisma, lockOrder, type Tx } from "@/server/db/prisma";
import { AppError, NotFoundError } from "@/server/errors";
import { MoneyError, computeMoney, remaining } from "@/server/domain/order-totals";
import { canDelete, moveStatus, type StatusMove } from "@/server/domain/order-status";
import { formatOrderCode } from "@/server/domain/order-code";
import { normalizePhone } from "@/server/domain/phone";
import { addDays, isYmd, todayVn, ymdToDbDate, type Ymd } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

// ===== Inputs =====

export interface OrderItemInput {
  /** existing order line when editing; its name/price snapshot is kept */
  id?: string | null;
  productId: string;
  /** selected variant for a variant product; omitted selects its first card */
  productVariantId?: string | null;
  /** quoted price for a new catalog item that has no listed price */
  unitPrice?: number | null;
  /** added to each unit on top of the line price, with its reason */
  extraPrice?: number;
  extraNote?: string;
  qty: number;
  note?: string;
}

export interface OrderInput {
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  channel: OrderChannel;
  receiveType: ReceiveType;
  deliveryAddress?: string;
  deliveryDate: Ymd;
  deliveryTimeFrom?: string | null;
  deliveryTimeTo?: string | null;
  courierName?: string;
  shippingFee: number;
  discount: number;
  deposit: number;
  cardMessage?: string;
  note?: string;
  items: OrderItemInput[];
}

const blank = (s?: string | null) => (s && s.trim() ? s.trim() : null);

function requirePhone(raw: string, field: string) {
  const phone = normalizePhone(raw);
  if (!phone) throw new AppError("Số điện thoại không hợp lệ.", { [field]: "Số điện thoại không hợp lệ" });
  return phone;
}

function logistics(input: OrderInput) {
  if (!isYmd(input.deliveryDate)) throw new AppError("Vui lòng chọn ngày giao.", { deliveryDate: "Bắt buộc" });
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  const from = input.deliveryTimeFrom || null;
  const to = input.deliveryTimeTo || null;
  if (from && !re.test(from)) throw new AppError("Giờ giao không hợp lệ.", { deliveryTimeFrom: "Giờ không hợp lệ" });
  if (to && !re.test(to)) throw new AppError("Giờ giao không hợp lệ.", { deliveryTimeTo: "Giờ không hợp lệ" });
  if (from && to && to < from) throw new AppError("Giờ kết thúc phải sau giờ bắt đầu.", { deliveryTimeTo: "Phải sau giờ bắt đầu" });
  return {
    channel: input.channel,
    receiveType: input.receiveType,
    deliveryAddress: input.receiveType === "DELIVERY" ? blank(input.deliveryAddress) : null,
    deliveryDate: ymdToDbDate(input.deliveryDate),
    deliveryTimeFrom: from,
    deliveryTimeTo: to,
    courierName: input.receiveType === "DELIVERY" ? blank(input.courierName) : null,
    cardMessage: blank(input.cardMessage),
    note: blank(input.note),
  };
}

function money(lines: { unitPrice: number; qty: number }[], input: OrderInput) {
  try {
    return computeMoney(lines, input.discount, input.shippingFee, input.deposit);
  } catch (e) {
    if (e instanceof MoneyError) throw new AppError(e.message, { [e.field]: e.message });
    throw e;
  }
}

async function nextOrderCode(tx: Tx): Promise<string> {
  const day = todayVn();
  const rows = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO order_counters (day, last_seq) VALUES (${ymdToDbDate(day)}::date, 1)
    ON CONFLICT (day) DO UPDATE SET last_seq = order_counters.last_seq + 1
    RETURNING last_seq`;
  return formatOrderCode(day, rows[0].last_seq);
}

/** Find by normalized phone or create (insert-or-ignore, safe when two orders arrive together). */
async function resolveCustomer(tx: Tx, input: OrderInput) {
  if (input.customerId) {
    const c = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!c) throw new NotFoundError("Không tìm thấy khách hàng.");
    // The id comes from a phone lookup in the form; trust it only if the typed phone still matches.
    if (!input.customerPhone?.trim() || normalizePhone(input.customerPhone) === c.phone) return c;
  }
  const phone = requirePhone(input.customerPhone, "customerPhone");
  const name = blank(input.customerName);
  const existing = await tx.customer.findUnique({ where: { phone } });
  if (existing) {
    if (!existing.address && blank(input.customerAddress)) {
      return tx.customer.update({ where: { id: existing.id }, data: { address: blank(input.customerAddress) } });
    }
    return existing;
  }
  if (!name) throw new AppError("Vui lòng nhập tên khách hàng.", { customerName: "Bắt buộc" });
  await tx.$executeRaw`
    INSERT INTO customers (id, name, phone, address, created_at, updated_at)
    VALUES (gen_random_uuid(), ${name}, ${phone}, ${blank(input.customerAddress)}, now(), now())
    ON CONFLICT (phone) DO NOTHING`;
  return tx.customer.findUniqueOrThrow({ where: { phone } });
}

/** "Cộng thêm tiền": the reason is kept only while there is an amount. */
function extra(item: OrderItemInput) {
  const extraPrice = item.extraPrice ?? 0;
  return { extraPrice, extraNote: extraPrice ? blank(item.extraNote) : null };
}

/** Snapshots for new lines. Hidden and unpriced products can be ordered; archived ones cannot. */
async function snapshotNewLines(tx: Tx, items: OrderItemInput[]) {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const p = byId.get(item.productId);
    if (!p || p.isArchived) throw new AppError("Có mẫu không còn bán. Hãy xóa dòng đó khỏi đơn.");
    const variant = item.productVariantId ? p.variants.find((row) => row.id === item.productVariantId) : p.variants[0];
    if (p.variants.length && !variant) throw new AppError(`Biến thể của mẫu "${p.name}" không hợp lệ. Hãy chọn lại.`, { items: `Chọn lại biến thể cho "${p.name}"` });
    if (!p.variants.length && item.productVariantId) throw new AppError(`Mẫu "${p.name}" không có biến thể. Hãy chọn lại.`, { items: `Chọn lại mẫu "${p.name}"` });
    const unitPrice = variant?.price ?? item.unitPrice ?? p.price;
    if (unitPrice === null || unitPrice === undefined) throw new AppError(`Vui lòng nhập đơn giá cho mẫu "${p.name}".`, { items: `Nhập đơn giá cho "${p.name}"` });
    if (!Number.isInteger(unitPrice) || unitPrice < 0 || unitPrice > 2_000_000_000) throw new AppError(`Đơn giá của mẫu "${p.name}" không hợp lệ.`, { items: "Đơn giá không hợp lệ" });
    return {
      productId: p.id,
      productVariantId: variant?.id ?? null,
      productCodeSnapshot: p.code,
      nameSnapshot: p.name,
      variantNameSnapshot: variant?.name ?? null,
      unitPriceSnapshot: unitPrice,
      ...extra(item),
      qty: item.qty,
      note: blank(item.note),
    };
  });
}

function checkItems(items: OrderItemInput[]) {
  if (!items.length) throw new AppError("Đơn hàng cần ít nhất một mẫu.", { items: "Chưa có mẫu nào" });
  if (items.length > 50) throw new AppError("Một đơn tối đa 50 dòng.");
  for (const i of items) {
    if (!Number.isInteger(i.qty) || i.qty <= 0 || i.qty > 10000) throw new AppError("Số lượng phải là số nguyên từ 1 đến 10000.", { items: "Số lượng không hợp lệ" });
    if (i.unitPrice !== undefined && i.unitPrice !== null && (!Number.isInteger(i.unitPrice) || i.unitPrice < 0 || i.unitPrice > 2_000_000_000)) {
      throw new AppError("Đơn giá không hợp lệ.", { items: "Đơn giá không hợp lệ" });
    }
    if (i.extraPrice !== undefined && (!Number.isInteger(i.extraPrice) || i.extraPrice < 0 || i.extraPrice > 2_000_000_000)) {
      throw new AppError("Tiền cộng thêm không hợp lệ.", { items: "Tiền cộng thêm không hợp lệ" });
    }
  }
}

// ===== Create / update =====

export async function createOrder(input: OrderInput): Promise<{ id: string; code: string }> {
  checkItems(input.items);
  return prisma.$transaction(async (tx) => {
    const customer = await resolveCustomer(tx, input);
    const lines = await snapshotNewLines(tx, input.items);
    const m = money(lines.map((l) => ({ unitPrice: l.unitPriceSnapshot + l.extraPrice, qty: l.qty })), input);
    const code = await nextOrderCode(tx);
    const order = await tx.order.create({
      data: {
        code,
        customerId: customer.id,
        recipientName: blank(input.recipientName) ?? customer.name,
        recipientPhone: input.recipientPhone ? requirePhone(input.recipientPhone, "recipientPhone") : customer.phone,
        ...logistics(input),
        ...m,
        items: { create: lines.map((l, i) => ({ ...l, sortOrder: i })) },
      },
    });
    return { id: order.id, code };
  });
}

/**
 * Edit everything except a cancelled order (restore it first). Existing lines keep their name and
 * price snapshot; only quantity, note and the added amount change. New lines are priced today; removed lines go.
 */
export async function updateOrder(orderId: string, input: OrderInput) {
  checkItems(input.items);
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    if (order.status === "CANCELLED") throw new AppError("Đơn đã hủy. Khôi phục đơn trước khi sửa.");
    const customer = await resolveCustomer(tx, input);
    const existing = new Map(order.items.map((i) => [i.id, i]));
    const fresh = input.items.filter((i) => !i.id || !existing.has(i.id));
    const freshLines = await snapshotNewLines(tx, fresh);
    const lines = input.items.map((item, index) => {
      const old = item.id ? existing.get(item.id) : undefined;
      if (old) return { kind: "keep" as const, id: old.id, unitPrice: old.unitPriceSnapshot, data: { qty: item.qty, note: blank(item.note), ...extra(item), sortOrder: index } };
      return { kind: "new" as const, data: { ...freshLines[fresh.indexOf(item)], sortOrder: index } };
    });
    const m = money(lines.map((l) => (l.kind === "keep" ? { unitPrice: l.unitPrice + l.data.extraPrice, qty: l.data.qty } : { unitPrice: l.data.unitPriceSnapshot + l.data.extraPrice, qty: l.data.qty })), input);
    const keep = lines.flatMap((l) => (l.kind === "keep" ? [l.id] : []));
    await tx.orderItem.deleteMany({ where: { orderId, id: { notIn: keep } } });
    for (const l of lines) if (l.kind === "keep") await tx.orderItem.update({ where: { id: l.id }, data: l.data });
    await tx.order.update({
      where: { id: orderId },
      data: {
        customerId: customer.id,
        recipientName: blank(input.recipientName) ?? customer.name,
        recipientPhone: input.recipientPhone ? requirePhone(input.recipientPhone, "recipientPhone") : customer.phone,
        ...logistics(input),
        ...m,
        items: { create: lines.flatMap((l) => (l.kind === "new" ? [l.data] : [])) },
      },
    });
  });
}

// ===== Status, deposit, delete =====

const STATUS_TIMESTAMPS: Record<OrderStatus, Prisma.OrderUpdateInput> = {
  NEW: { deliveringAt: null, completedAt: null, cancelledAt: null },
  DELIVERING: { completedAt: null, cancelledAt: null },
  COMPLETED: { cancelledAt: null },
  CANCELLED: {},
};

export async function changeStatus(orderId: string, move: StatusMove) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    const to = moveStatus(order.status, move);
    if (!to) throw new AppError("Không thể chuyển trạng thái này. Hãy tải lại trang.");
    const now = new Date();
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...STATUS_TIMESTAMPS[to],
        ...(to === "DELIVERING" && move === "next" ? { deliveringAt: now } : {}),
        ...(to === "COMPLETED" ? { completedAt: now } : {}),
        ...(to === "CANCELLED" ? { cancelledAt: now } : {}),
      },
    });
    return to;
  });
}

/** "Đã thu đủ": set the deposit to the total so nothing remains. */
export async function markPaidInFull(orderId: string) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    await tx.order.update({ where: { id: orderId }, data: { deposit: order.total } });
    return order.total;
  });
}

export async function deleteOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Không tìm thấy đơn.");
    if (!canDelete(order.status)) throw new AppError("Chỉ xóa được đơn Mới hoặc đơn đã Hủy.");
    await tx.order.delete({ where: { id: orderId } });
    return order.code;
  });
}

// ===== Queries =====

const listInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { orderBy: { sortOrder: "asc" }, select: { nameSnapshot: true, qty: true } },
} satisfies Prisma.OrderInclude;

export type OrderListRow = Prisma.OrderGetPayload<{ include: typeof listInclude }>;

const scheduleOrder: Prisma.OrderOrderByWithRelationInput[] = [
  { deliveryDate: "asc" },
  { deliveryTimeFrom: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
];

export async function ordersInRange(from: Ymd, to: Ymd, status?: OrderStatus) {
  return prisma.order.findMany({
    where: { deliveryDate: { gte: ymdToDbDate(from), lte: ymdToDbDate(to) }, ...(status ? { status } : {}) },
    orderBy: scheduleOrder,
    include: listInclude,
  });
}

export async function statusCounts(from: Ymd, to: Ymd) {
  const groups = await prisma.order.groupBy({
    by: ["status"],
    where: { deliveryDate: { gte: ymdToDbDate(from), lte: ymdToDbDate(to) } },
    _count: { _all: true },
  });
  const counts: Record<OrderStatus, number> = { NEW: 0, DELIVERING: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

/** One status entry per order in the range, for the calendar dots. */
export async function calendarMarks(from: Ymd, to: Ymd) {
  const groups = await prisma.order.groupBy({
    by: ["deliveryDate", "status"],
    where: { deliveryDate: { gte: ymdToDbDate(from), lte: ymdToDbDate(to) } },
    _count: { _all: true },
  });
  const marks: Record<Ymd, { statuses: OrderStatus[]; count: number }> = {};
  for (const g of groups) {
    const day = g.deliveryDate.toISOString().slice(0, 10);
    marks[day] ??= { statuses: [], count: 0 };
    for (let i = 0; i < g._count._all; i++) marks[day].statuses.push(g.status);
    marks[day].count += g._count._all;
  }
  const order: OrderStatus[] = ["NEW", "DELIVERING", "COMPLETED", "CANCELLED"];
  for (const m of Object.values(marks)) m.statuses.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return marks;
}

/**
 * "Tổng hợp cần làm" (spec 4): only NEW orders whose delivery date is in the range.
 * Delivering, completed and cancelled orders are excluded from counts and money.
 */
export async function todoSummary(from: Ymd, to: Ymd) {
  const orders = await prisma.order.findMany({
    where: { status: "NEW", deliveryDate: { gte: ymdToDbDate(from), lte: ymdToDbDate(to) } },
    select: {
      total: true,
      deposit: true,
      items: {
        select: {
          productId: true,
          nameSnapshot: true,
          productCodeSnapshot: true,
          qty: true,
          product: { select: { images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
        },
      },
    },
  });
  const total = orders.reduce((s, o) => s + o.total, 0);
  const deposit = orders.reduce((s, o) => s + o.deposit, 0);
  const per = new Map<string, { productId: string; code: string; name: string; qty: number; imageUrl: string | null }>();
  for (const o of orders) {
    for (const i of o.items) {
      const row = per.get(i.productId) ?? {
        productId: i.productId,
        code: i.productCodeSnapshot,
        name: i.nameSnapshot,
        qty: 0,
        imageUrl: i.product.images[0]?.url ?? null,
      };
      row.qty += i.qty;
      per.set(i.productId, row);
    }
  }
  const products = [...per.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "vi"));
  return { count: orders.length, total, deposit, remaining: total - deposit, products };
}

/** The four overview cards (spec 4, "Thẻ tổng quan"). */
/** Monday to Sunday around `today`. Pure date math, so callers can use it before any query runs. */
export function weekBounds(today: Ymd): { weekFrom: Ymd; weekTo: Ymd } {
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const weekFrom = addDays(today, -dow);
  return { weekFrom, weekTo: addDays(weekFrom, 6) };
}

export async function overview(today: Ymd = todayVn()) {
  const { weekFrom, weekTo } = weekBounds(today);
  const [todayCount, weekCount, newOrders] = await Promise.all([
    prisma.order.count({ where: { deliveryDate: ymdToDbDate(today), status: { not: "CANCELLED" } } }),
    prisma.order.count({ where: { deliveryDate: { gte: ymdToDbDate(weekFrom), lte: ymdToDbDate(weekTo) }, status: { not: "CANCELLED" } } }),
    prisma.order.findMany({ where: { status: "NEW" }, select: { total: true, deposit: true } }),
  ]);
  return {
    todayCount,
    weekCount,
    newCount: newOrders.length,
    owedNew: newOrders.reduce((s, o) => s + remaining(o), 0),
    weekFrom,
    weekTo,
  };
}

/** Shop-wide totals shown on the shop information page. */
export async function shopTotals() {
  const [completed, totalTasks, cancelledTasks] = await Promise.all([
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "CANCELLED" } }),
  ]);
  return { totalRevenue: completed._sum.total ?? 0, totalTasks, cancelledTasks };
}

export type ProductRanking = "quantity" | "revenue";

interface TopSellingProductRow {
  productId: string;
  code: string;
  name: string;
  quantity: bigint;
  revenue: bigint;
}

/** Top five products from completed orders, ranked by sold quantity or item revenue. */
export async function topSellingProducts(rankBy: ProductRanking = "quantity") {
  const orderBy =
    rankBy === "revenue"
      ? Prisma.sql`SUM(oi.qty::bigint * (oi.unit_price_snapshot::bigint + oi.extra_price::bigint)) DESC, SUM(oi.qty)::bigint DESC`
      : Prisma.sql`SUM(oi.qty)::bigint DESC, SUM(oi.qty::bigint * (oi.unit_price_snapshot::bigint + oi.extra_price::bigint)) DESC`;
  const rows = await prisma.$queryRaw<TopSellingProductRow[]>`
    SELECT
      p.id AS "productId",
      p.code,
      p.name,
      SUM(oi.qty)::bigint AS quantity,
      SUM(oi.qty::bigint * (oi.unit_price_snapshot::bigint + oi.extra_price::bigint))::bigint AS revenue
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'COMPLETED'
    GROUP BY p.id, p.code, p.name
    ORDER BY ${orderBy}, p.name ASC, p.code ASC
    LIMIT 5`;
  return rows.map((row) => ({
    productId: row.productId,
    code: row.code,
    name: row.name,
    quantity: Number(row.quantity),
    revenue: Number(row.revenue),
  }));
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { id: true, isArchived: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } } },
      },
    },
  });
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function customerOrders(customerId: string) {
  return prisma.order.findMany({ where: { customerId }, orderBy: [{ deliveryDate: "desc" }, { createdAt: "desc" }], include: listInclude, take: 100 });
}

export function describeTotal(o: { total: number; deposit: number }) {
  const left = remaining(o);
  return left ? `Còn ${formatMoney(left)}` : "Đã thu đủ";
}
