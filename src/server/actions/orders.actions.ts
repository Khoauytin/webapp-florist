"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import { changeStatus, createOrder, deleteOrder, markPaidInFull, updateOrder } from "@/server/services/orders.service";
import { searchOrderableProducts } from "@/server/services/catalog.service";
import { findCustomerByPhone } from "@/server/services/customers.service";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { isYmd } from "@/lib/dates";
import { idsValid, isUuid } from "@/lib/ids";

const money = z.number().int().min(0).max(2_000_000_000);
const optText = (max: number) => z.string().max(max).optional();
const time = z.union([z.literal(""), z.null(), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ")]).optional();

const orderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(120),
  customerPhone: z.string().max(30),
  customerAddress: optText(300),
  recipientName: optText(120),
  recipientPhone: optText(30),
  channel: z.enum(["FACEBOOK", "ZALO", "TIKTOK", "PHONE", "IN_STORE"]),
  receiveType: z.enum(["DELIVERY", "PICKUP"]),
  deliveryAddress: optText(300),
  deliveryDate: z.string().refine(isYmd, "Vui lòng chọn ngày giao"),
  deliveryTimeFrom: time,
  deliveryTimeTo: time,
  courierName: optText(120),
  shippingFee: money,
  discount: money,
  deposit: money,
  cardMessage: optText(500),
  note: optText(2000),
  items: z
    .array(
      z.object({
        id: z.string().uuid().nullable().optional(),
        productId: z.string().uuid(),
        productVariantId: z.string().uuid().nullable().optional(),
        unitPrice: money.nullable().optional(),
        qty: z.number().int().min(1).max(10000),
        note: optText(300),
      }),
    )
    .min(1, "Đơn hàng cần ít nhất một mẫu")
    .max(50),
});

export type OrderPayload = z.input<typeof orderSchema>;
type Result = ActionState & { id?: string };

function invalid(err: z.ZodError): Result {
  const msg = err.issues[0]?.message;
  return { ok: false, error: msg && !msg.startsWith("Invalid") && !msg.startsWith("Too") ? msg : "Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại." };
}

function refresh(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/admin/orders/${id}`);
}

export async function saveOrderAction(orderId: string | null, payload: OrderPayload): Promise<Result> {
  if (!idsValid(orderId)) return INVALID_ID;
  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await actionUser();
    const input = { ...parsed.data, deliveryTimeFrom: parsed.data.deliveryTimeFrom || null, deliveryTimeTo: parsed.data.deliveryTimeTo || null };
    if (orderId) {
      await updateOrder(orderId, input);
      refresh(orderId);
      return { ok: true, id: orderId, message: "Đã lưu đơn" };
    }
    const { id, code } = await createOrder(input);
    refresh(id);
    return { ok: true, id, message: `Đã tạo đơn ${code}` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function changeStatusAction(orderId: string, move: "next" | "back" | "cancel" | "restore"): Promise<ActionState> {
  if (!idsValid(orderId) || !["next", "back", "cancel", "restore"].includes(move)) return INVALID_ID;
  try {
    await actionUser();
    const to = await changeStatus(orderId, move);
    refresh(orderId);
    return { ok: true, message: `Đã chuyển sang ${ORDER_STATUS_LABELS[to]}` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function markPaidAction(orderId: string): Promise<ActionState> {
  if (!idsValid(orderId)) return INVALID_ID;
  try {
    await actionUser();
    await markPaidInFull(orderId);
    refresh(orderId);
    return { ok: true, message: "Đã ghi nhận thu đủ" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deleteOrderAction(orderId: string): Promise<ActionState> {
  if (!idsValid(orderId)) return INVALID_ID;
  try {
    await actionUser();
    const code = await deleteOrder(orderId);
    refresh();
    return { ok: true, message: `Đã xóa đơn ${code}` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function searchProductsAction(q: string, categoryId?: string | null) {
  await actionUser();
  const category = isUuid(categoryId) ? categoryId : undefined;
  const rows = await searchOrderableProducts(String(q).slice(0, 100), { categoryId: category });
  return rows.map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price, imageUrl: p.images[0]?.url ?? null, variants: p.variants }));
}

export async function findCustomerAction(phone: string) {
  await actionUser();
  const c = await findCustomerByPhone(String(phone).slice(0, 30));
  return c ? { id: c.id, name: c.name, phone: c.phone, address: c.address } : null;
}
