ALTER TABLE "customers"
  ADD COLUMN "phone_lookup" TEXT;

CREATE UNIQUE INDEX "customers_phone_lookup_key"
  ON "customers"("phone_lookup");
