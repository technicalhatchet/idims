-- Undo: portal_booking_payment_waived on clients

BEGIN;

ALTER TABLE clients
    DROP COLUMN IF EXISTS portal_booking_payment_waived;

COMMIT;
