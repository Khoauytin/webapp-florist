export type PriceSort = "asc" | "desc";

export const PRICE_SORT_LABELS: Record<PriceSort, string> = { asc: "Giá tăng dần", desc: "Giá giảm dần" };

export const isPriceSort = (v: unknown): v is PriceSort => v === "asc" || v === "desc";

/** Sort by the price a card shows; items without a price stay last either way. Ties keep their order. */
export function sortByPrice<T>(rows: readonly T[], priceOf: (row: T) => number | null, dir: PriceSort): T[] {
  return [...rows].sort((a, b) => {
    const pa = priceOf(a);
    const pb = priceOf(b);
    if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
    return dir === "asc" ? pa - pb : pb - pa;
  });
}
