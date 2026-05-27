-- Run in Supabase SQL Editor (after work_order_payments table exists)
-- Adds Venmo to payment_method_enum for field-recorded payments

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_method_enum'
      AND e.enumlabel = 'venmo'
  ) THEN
    ALTER TYPE payment_method_enum ADD VALUE 'venmo';
  END IF;
END $$;
