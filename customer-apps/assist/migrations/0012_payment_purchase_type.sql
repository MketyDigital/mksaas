ALTER TABLE payment_checkouts ADD COLUMN purchase_type TEXT NOT NULL DEFAULT 'topup'
  CHECK (purchase_type IN ('plan','topup'));

DROP TRIGGER IF EXISTS trg_payment_checkout_grant_credits;
CREATE TRIGGER trg_payment_checkout_grant_credits
AFTER UPDATE OF status ON payment_checkouts
WHEN OLD.status='pending' AND NEW.status='paid'
BEGIN
  UPDATE credit_accounts
  SET balance=balance+NEW.credits,
      lifetime_granted=lifetime_granted+NEW.credits,
      updated_at=unixepoch()
  WHERE customer_id=NEW.customer_id;

  UPDATE customers
  SET billing_status=CASE WHEN NEW.purchase_type='plan' THEN 'current' ELSE billing_status END,
      grace_until=CASE WHEN NEW.purchase_type='plan' THEN NULL ELSE grace_until END,
      updated_at=unixepoch()
  WHERE id=NEW.customer_id;

  INSERT INTO credit_ledger
  (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at)
  SELECT
    'led_' || lower(hex(randomblob(16))),
    NEW.customer_id,
    NULL,
    NEW.credits,
    CASE WHEN NEW.purchase_type='plan' THEN 'plan_funding' ELSE 'topup' END,
    NEW.id,
    balance,
    unixepoch()
  FROM credit_accounts
  WHERE customer_id=NEW.customer_id;
END;
