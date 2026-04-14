-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE "subscription_plan" AS ENUM ('trial', 'monthly', 'quarterly', 'yearly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
    CREATE TYPE "payment_provider" AS ENUM ('razorpay');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_tag') THEN
    CREATE TYPE "payment_tag" AS ENUM ('subscription');
  END IF;
END$$;

-- payment_records
CREATE TABLE IF NOT EXISTS "payment_records" (
  "id" TEXT PRIMARY KEY,
  "org_id" TEXT NOT NULL,
  "user_id" TEXT,
  "provider" "payment_provider" NOT NULL,
  "tag" "payment_tag" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "razorpay_order_id" TEXT,
  "razorpay_payment_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payment_records_org_id_idx" ON "payment_records"("org_id");
CREATE INDEX IF NOT EXISTS "payment_records_tag_idx" ON "payment_records"("tag");

-- org_subscriptions
CREATE TABLE IF NOT EXISTS "org_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "org_id" TEXT NOT NULL,
  "plan" "subscription_plan" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "created_by_user_id" TEXT,
  "payment_record_id" TEXT,
  "expiry_notified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_subscriptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "org_subscriptions_payment_record_id_fkey" FOREIGN KEY ("payment_record_id") REFERENCES "payment_records"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "org_subscriptions_org_id_period_end_idx" ON "org_subscriptions"("org_id", "period_end");
