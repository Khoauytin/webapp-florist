import { describe, expect, it } from "vitest";
import { isPriceSort, sortByPrice } from "@/lib/price-sort";

const rows = [
  { id: "a", price: 500000 },
  { id: "b", price: null },
  { id: "c", price: 250000 },
  { id: "d", price: 500000 },
];
const ids = (list: typeof rows) => list.map((r) => r.id).join("");

describe("sortByPrice", () => {
  it("sorts both ways, keeps ties in order and puts unpriced items last", () => {
    expect(ids(sortByPrice(rows, (r) => r.price, "asc"))).toBe("cadb");
    expect(ids(sortByPrice(rows, (r) => r.price, "desc"))).toBe("adcb");
    expect(ids(rows)).toBe("abcd");
  });
  it("accepts only the two directions", () => {
    expect(isPriceSort("asc") && isPriceSort("desc")).toBe(true);
    expect(isPriceSort("price") || isPriceSort(undefined)).toBe(false);
  });
});
