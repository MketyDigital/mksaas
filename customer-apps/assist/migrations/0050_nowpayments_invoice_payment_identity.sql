ALTER TABLE payment_checkouts ADD COLUMN provider_invoice_id TEXT;
ALTER TABLE payment_checkouts ADD COLUMN provider_pay_currency TEXT;
ALTER TABLE payment_checkouts ADD COLUMN provider_payment_status TEXT;
ALTER TABLE payment_checkouts ADD COLUMN provider_actual_paid_fiat_minor INTEGER;

-- Pending NOWPayments rows held the hosted invoice ID in provider_payment_id.
-- Move only pending rows; paid/failed rows may already contain a real payment ID.
UPDATE payment_checkouts
SET provider_invoice_id=provider_payment_id,
    provider_payment_id=NULL
WHERE provider='nowpayments'
  AND status='pending'
  AND provider_payment_id IS NOT NULL;
