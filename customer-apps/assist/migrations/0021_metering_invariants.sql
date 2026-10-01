ALTER TABLE credit_reservations ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_idempotency ON credit_reservations(customer_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_reservation_once ON usage_events(customer_id,conversation_id,created_at,id) ;
