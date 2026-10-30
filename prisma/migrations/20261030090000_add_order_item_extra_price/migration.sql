-- "Cộng thêm tiền": an amount added to each unit of an order line, with its reason.
ALTER TABLE "order_items"
  ADD COLUMN "extra_price" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extra_note" TEXT;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_extra_price_nonneg" CHECK ("extra_price" >= 0);
