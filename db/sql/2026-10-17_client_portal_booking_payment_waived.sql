-- Per-client waiver for portal upfront booking payment (diagnostic + trip).
-- Run BEFORE deploying app code that reads clients.portal_booking_payment_waived.
-- Date: 2026-10-17

BEGIN;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS portal_booking_payment_waived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN clients.portal_booking_payment_waived IS
    'When true, client may book a portal window without Square prepayment (global portal_scheduling.payment.requires_payment still applies for others).';

COMMIT;
