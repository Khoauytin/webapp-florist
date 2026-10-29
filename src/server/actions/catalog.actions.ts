"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/server/auth/session";
import { INVALID_ID, toActionState, type ActionState } from "@/server/errors";
import {
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  moveCategory,
  previewProductCode,
  quickUpdate,
  setCategoryVisible,
  setProductVisible,
  updateCategory,
  updateProduct,
} from "@/server/services/catalog.service";
import { addProductImage, removeProductImage, setPrimaryImage } from "@/server/services/images.service";
import { idsValid } from "@/lib/ids";

function refresh(productId?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/");
  if (productId) revalidatePath(`/admin/products/${productId}`);
}

async function run(fn: () => Promise<unknown>, message: string, productId?: string): Promise<ActionState> {
  try {
    await actionUser();
    await fn();
    refresh(productId);
    return { ok: true, message };
  } catch (e) {
    return toActionState(e);
  }
}

const productSchema = z.object({
  name: z.string().max(200),
  categoryId: z.string().uuid({ message: "Chọn danh mục" }),
  price: z.number().int().min(0).max(2_000_000_000).nullable(),
  size: z.string().max(120).optional(),
  color: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  isVisible: z.boolean(),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().max(120),
        price: z.number().int().min(0).max(2_000_000_000).nullable(),
      }),
    )
    .max(20)
    .optional(),
});

export type ProductPayload = z.input<typeof productSchema>;

export async function saveProductAction(productId: string | null, payload: ProductPayload): Promise<ActionState & { id?: string; code?: string }> {
  if (!idsValid(productId)) return INVALID_ID;
  const parsed = productSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Vui lòng kiểm tra lại thông tin sản phẩm.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message.startsWith("Invalid") ? "Không hợp lệ" : i.message])) };
  try {
    await actionUser();
    const p = productId ? await updateProduct(productId, parsed.data) : await createProduct(parsed.data);
    refresh(p.id);
    return { ok: true, id: p.id, code: p.code, message: productId ? "Đã lưu sản phẩm" : `Đã tạo ${p.code}` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function previewCodeAction(categoryId: string) {
  await actionUser();
  return idsValid(categoryId) ? previewProductCode(categoryId) : null;
}

export async function setProductVisibleAction(productId: string, visible: boolean) {
  if (!idsValid(productId)) return INVALID_ID;
  return run(() => setProductVisible(productId, Boolean(visible)), visible ? "Đã hiện trên web" : "Đã ẩn khỏi web", productId);
}

export async function archiveProductAction(productId: string) {
  if (!idsValid(productId)) return INVALID_ID;
  return run(() => archiveProduct(productId), "Đã lưu trữ sản phẩm", productId);
}

export async function deleteProductAction(productId: string) {
  if (!idsValid(productId)) return INVALID_ID;
  return run(() => deleteProduct(productId), "Đã xóa sản phẩm");
}

const quickSchema = z.array(z.object({ id: z.string().uuid(), name: z.string().max(200), price: z.number().int().min(0).max(2_000_000_000).nullable(), isVisible: z.boolean() })).max(500);

export async function quickUpdateAction(rows: z.input<typeof quickSchema>) {
  const parsed = quickSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Có giá trị không hợp lệ." } satisfies ActionState;
  return run(() => quickUpdate(parsed.data), `Đã lưu ${parsed.data.length} sản phẩm`);
}

export async function uploadImageAction(productId: string, form: FormData): Promise<ActionState> {
  if (!idsValid(productId)) return INVALID_ID;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Chưa chọn ảnh." };
  return run(async () => addProductImage(productId, { bytes: Buffer.from(await file.arrayBuffer()), type: file.type }), "Đã thêm ảnh", productId);
}

export async function setPrimaryImageAction(productId: string, imageId: string) {
  if (!idsValid(productId, imageId)) return INVALID_ID;
  return run(() => setPrimaryImage(imageId), "Đã đặt làm ảnh chính", productId);
}

export async function removeImageAction(productId: string, imageId: string) {
  if (!idsValid(productId, imageId)) return INVALID_ID;
  return run(() => removeProductImage(imageId), "Đã xóa ảnh", productId);
}

const categorySchema = z.object({ name: z.string().max(80), codePrefix: z.string().max(6), isVisible: z.boolean().optional() });

export async function saveCategoryAction(categoryId: string | null, payload: z.input<typeof categorySchema>) {
  if (!idsValid(categoryId)) return INVALID_ID;
  const parsed = categorySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Dữ liệu chưa hợp lệ." } satisfies ActionState;
  const { name, codePrefix, isVisible } = parsed.data;
  return run(
    () => (categoryId ? updateCategory(categoryId, { name, codePrefix, isVisible: isVisible ?? true }) : createCategory({ name, codePrefix })),
    categoryId ? "Đã lưu danh mục" : "Đã thêm danh mục",
  );
}

export async function setCategoryVisibleAction(categoryId: string, visible: boolean) {
  if (!idsValid(categoryId)) return INVALID_ID;
  return run(() => setCategoryVisible(categoryId, Boolean(visible)), visible ? "Danh mục đã hiện trên web" : "Danh mục đã ẩn khỏi web");
}

export async function moveCategoryAction(categoryId: string, direction: "up" | "down") {
  if (!idsValid(categoryId)) return INVALID_ID;
  return run(() => moveCategory(categoryId, direction === "up" ? "up" : "down"), "Đã đổi thứ tự");
}

export async function deleteCategoryAction(categoryId: string) {
  if (!idsValid(categoryId)) return INVALID_ID;
  return run(() => deleteCategory(categoryId), "Đã xóa danh mục");
}
