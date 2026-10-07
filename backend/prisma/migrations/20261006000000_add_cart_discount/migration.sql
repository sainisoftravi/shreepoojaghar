ALTER TABLE "sales_invoices"
  ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "sales_invoices"
SET "subtotal" = "total_amount";

ALTER TABLE "invoice_items"
  ADD COLUMN "gross_line_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "invoice_items"
SET "gross_line_total" = "line_total";

ALTER TABLE "sales_invoice_refunds"
  ADD COLUMN "subtotal_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_reversed" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "sales_invoice_refunds"
SET "subtotal_amount" = "refund_amount";

ALTER TABLE "products"
  DROP COLUMN "discount_percent";
