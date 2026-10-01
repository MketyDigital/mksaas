-- New contracts are not funded until a verified payment settles.
-- Correct only untouched legacy records that received initial credits at creation
-- but have never paid, used AI, or had an explicit ledger adjustment.
UPDATE customers
SET billing_status='pending', updated_at=unixepoch()
WHERE id IN (
  SELECT c.id
  FROM customers c
  JOIN credit_accounts ca ON ca.customer_id=c.id
  WHERE ca.lifetime_consumed=0
    AND NOT EXISTS (SELECT 1 FROM payment_checkouts pc WHERE pc.customer_id=c.id AND pc.status='paid')
    AND NOT EXISTS (SELECT 1 FROM usage_events ue WHERE ue.customer_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM credit_ledger cl WHERE cl.customer_id=c.id)
);

UPDATE credit_accounts
SET balance=0, lifetime_granted=0, updated_at=unixepoch()
WHERE customer_id IN (
  SELECT c.id
  FROM customers c
  WHERE c.billing_status='pending'
    AND NOT EXISTS (SELECT 1 FROM payment_checkouts pc WHERE pc.customer_id=c.id AND pc.status='paid')
    AND NOT EXISTS (SELECT 1 FROM usage_events ue WHERE ue.customer_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM credit_ledger cl WHERE cl.customer_id=c.id)
);

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
  SET billing_status='current', grace_until=NULL, updated_at=unixepoch()
  WHERE id=NEW.customer_id;

  INSERT INTO credit_ledger
  (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at)
  SELECT
    'led_' || lower(hex(randomblob(16))),
    NEW.customer_id,
    NULL,
    NEW.credits,
    'topup',
    NEW.id,
    balance,
    unixepoch()
  FROM credit_accounts
  WHERE customer_id=NEW.customer_id;
END;
