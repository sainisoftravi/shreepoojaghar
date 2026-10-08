-- =============================================
-- Shree Pooja Ghar - Complete Schema for Supabase
-- Paste this in Supabase SQL Editor and Run
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categories
CREATE TABLE IF NOT EXISTS "categories" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name_en"    TEXT NOT NULL,
  "name_hi"    TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS "products" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "barcode"             TEXT UNIQUE,
  "name_en"             TEXT NOT NULL,
  "name_hi"             TEXT,
  "image_url"           TEXT,
  "category_id"         TEXT NOT NULL REFERENCES "categories"("id"),
  "base_unit"           TEXT NOT NULL DEFAULT 'piece',
  "allow_decimal_qty"   BOOLEAN NOT NULL DEFAULT false,
  "low_stock_threshold" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "total_stock_base"    DECIMAL(12,3) NOT NULL DEFAULT 0,
  "min_alert_qty"       INTEGER NOT NULL DEFAULT 0,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON "products"("barcode");
CREATE INDEX IF NOT EXISTS idx_products_name_en ON "products"("name_en");
CREATE INDEX IF NOT EXISTS idx_products_category ON "products"("category_id");

-- Product Units
CREATE TABLE IF NOT EXISTS "product_units" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "product_id"       TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "name_en"          TEXT NOT NULL,
  "name_hi"          TEXT,
  "factor_to_base"   DECIMAL(12,4) NOT NULL,
  "is_purchase_unit" BOOLEAN NOT NULL DEFAULT false,
  "is_sell_unit"     BOOLEAN NOT NULL DEFAULT true,
  "margin_percent"   DECIMAL(8,2) NOT NULL DEFAULT 0,
  "selling_price"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  "price_override"   DECIMAL(10,2),
  "min_qty"          DECIMAL(12,3) NOT NULL DEFAULT 1,
  "qty_step"         DECIMAL(12,3) NOT NULL DEFAULT 1,
  "barcode"          TEXT,
  "sort_order"       INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("product_id", "name_en")
);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON "product_units"("product_id");

-- Product Batches
CREATE TABLE IF NOT EXISTS "product_batches" (
  "id"                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "product_id"              TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "purchase_unit_id"        TEXT REFERENCES "product_units"("id") ON DELETE SET NULL,
  "purchase_qty"            DECIMAL(12,3),
  "purchase_price_per_unit" DECIMAL(14,4),
  "qty_received_base"       DECIMAL(12,3) NOT NULL DEFAULT 0,
  "qty_remaining_base"      DECIMAL(12,3) NOT NULL DEFAULT 0,
  "cost_per_base"           DECIMAL(14,4) NOT NULL DEFAULT 0,
  "purchase_cost"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "selling_price"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "initial_stock"           INTEGER NOT NULL DEFAULT 0,
  "current_stock"           INTEGER NOT NULL DEFAULT 0,
  "vendor"                  TEXT,
  "received_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batches_product ON "product_batches"("product_id");

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email"      TEXT UNIQUE NOT NULL,
  "name"       TEXT NOT NULL,
  "password"   TEXT NOT NULL,
  "role"       TEXT NOT NULL DEFAULT 'CASHIER',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS "customers" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "phone"          TEXT UNIQUE NOT NULL,
  "phone_lookup"   TEXT UNIQUE,
  "name"           TEXT,
  "first_name"     TEXT,
  "total_orders"   INTEGER NOT NULL DEFAULT 0,
  "lifetime_spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "last_purchase"  TIMESTAMPTZ,
  "tags"           TEXT[] NOT NULL DEFAULT '{}',
  "last_category"  TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON "customers"("phone");

-- UPI Accounts
CREATE TABLE IF NOT EXISTS "upi_accounts" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "upi_id"     TEXT UNIQUE NOT NULL,
  "name"       TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shop Settings
CREATE TABLE IF NOT EXISTS "shop_settings" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "key"        TEXT UNIQUE NOT NULL,
  "value"      TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Invoices
CREATE TABLE IF NOT EXISTS "sales_invoices" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoice_no"       TEXT UNIQUE NOT NULL,
  "idempotency_key"  TEXT UNIQUE,
  "request_hash"     TEXT,
  "customer_id"      TEXT REFERENCES "customers"("id"),
  "customer_phone"   TEXT,
  "customer_name"    TEXT,
  "subtotal"         DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount_amount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total_amount"     DECIMAL(10,2) NOT NULL,
  "total_profit"     DECIMAL(10,2) NOT NULL,
  "payment_mode"     TEXT NOT NULL,
  "wa_status"        TEXT NOT NULL DEFAULT 'PENDING',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_no ON "sales_invoices"("invoice_no");
CREATE INDEX IF NOT EXISTS idx_invoices_phone ON "sales_invoices"("customer_phone");

-- Invoice Items
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoice_id"       TEXT NOT NULL REFERENCES "sales_invoices"("id") ON DELETE CASCADE,
  "product_id"       TEXT NOT NULL,
  "product_name"     TEXT NOT NULL,
  "unit_name"        TEXT NOT NULL DEFAULT 'piece',
  "factor_to_base"   DECIMAL(12,4) NOT NULL DEFAULT 1,
  "qty_in_unit"      DECIMAL(12,3) NOT NULL DEFAULT 1,
  "qty_base"         DECIMAL(12,3) NOT NULL DEFAULT 1,
  "refunded_qty_base" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "unit_price"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "gross_line_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount_amount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "line_total"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "cogs"             DECIMAL(10,2) NOT NULL DEFAULT 0,
  "profit"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "batch_id"         TEXT,
  "quantity"         INTEGER NOT NULL DEFAULT 1,
  "unit_cost"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "unit_sale_price"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "line_profit"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON "invoice_items"("invoice_id");

-- Invoice Item Batch Allocations
CREATE TABLE IF NOT EXISTS "invoice_item_batch_allocations" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoice_item_id" TEXT NOT NULL REFERENCES "invoice_items"("id") ON DELETE CASCADE,
  "batch_id"        TEXT NOT NULL REFERENCES "product_batches"("id") ON DELETE CASCADE,
  "qty_base"        DECIMAL(12,3) NOT NULL,
  "cost_per_base"   DECIMAL(14,4) NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocations_item ON "invoice_item_batch_allocations"("invoice_item_id");
CREATE INDEX IF NOT EXISTS idx_allocations_batch ON "invoice_item_batch_allocations"("batch_id");

-- Sales Invoice Refunds
CREATE TABLE IF NOT EXISTS "sales_invoice_refunds" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoice_id"       TEXT NOT NULL REFERENCES "sales_invoices"("id") ON DELETE CASCADE,
  "invoice_item_id"  TEXT NOT NULL REFERENCES "invoice_items"("id") ON DELETE CASCADE,
  "idempotency_key"  TEXT UNIQUE,
  "refund_no"        TEXT UNIQUE NOT NULL,
  "qty_in_unit"      DECIMAL(12,3) NOT NULL,
  "qty_base"         DECIMAL(12,3) NOT NULL,
  "refund_amount"    DECIMAL(10,2) NOT NULL,
  "subtotal_amount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount_reversed" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "cogs_reversed"    DECIMAL(10,2) NOT NULL,
  "profit_reversed"  DECIMAL(10,2) NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON "sales_invoice_refunds"("invoice_id");

-- Audit Logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id"    TEXT,
  "action"     TEXT NOT NULL,
  "entity"     TEXT NOT NULL,
  "entity_id"  TEXT NOT NULL,
  "details"    JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Done!
SELECT 'Schema created successfully! 🎉' AS result;
