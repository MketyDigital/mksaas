-- Move Assist credit accounting to true MKredit precision.
-- Economic value is preserved: one legacy credit represented $0.001, so each
-- legacy credit becomes 10,000 MKredit. Target unit: 10,000,000 MKredit/USD,
-- equivalent to $0.0001 = 1,000 MKredit.
--
-- All credit-bearing persisted values are scaled together exactly once by this
-- migration so balances, history, purchases, limits and rate cards retain the
-- same economic value.

UPDATE credit_accounts
SET balance=balance*10000,
    lifetime_granted=lifetime_granted*10000,
    lifetime_consumed=lifetime_consumed*10000,
    updated_at=unixepoch();

UPDATE credit_ledger
SET delta=delta*10000,
    balance_after=balance_after*10000;

UPDATE commercial_policy
SET included_credits=included_credits*10000,
    updated_at=unixepoch();

UPDATE assistants
SET monthly_credit_cap=CASE
      WHEN monthly_credit_cap IS NULL THEN NULL
      ELSE monthly_credit_cap*10000
    END,
    updated_at=unixepoch();

UPDATE payment_checkouts
SET credits=credits*10000;

UPDATE credit_reservations
SET reserved_credits=reserved_credits*10000,
    settled_credits=CASE
      WHEN settled_credits IS NULL THEN NULL
      ELSE settled_credits*10000
    END;

UPDATE usage_events
SET credits_charged=credits_charged*10000;

UPDATE model_rates
SET input_credits_per_million=input_credits_per_million*10000,
    output_credits_per_million=output_credits_per_million*10000,
    image_credits=image_credits*10000,
    audio_credits_per_minute=audio_credits_per_minute*10000;

UPDATE model_route_targets
SET input_credits_per_million=input_credits_per_million*10000,
    output_credits_per_million=output_credits_per_million*10000,
    image_credits=image_credits*10000,
    audio_credits_per_minute=audio_credits_per_minute*10000,
    updated_at=unixepoch();

UPDATE system_settings
SET value_json=json_set(
      json_remove(value_json,'$.creditUsdMicros'),
      '$.mkreditsPerUsd',10000000,
      '$.creditUnit','MKredit',
      '$.creditScaleVersion',2
    ),
    updated_at=unixepoch()
WHERE key='commercial';
