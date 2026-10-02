-- Public MKredit is the business/customer unit; credit atoms remain internal.
-- Public definition: $1 = 1,000 MKredit.
-- Internal precision: $1 = 10,000,000 credit atoms = 10,000 atoms/MKredit.
-- Existing persisted values already use precision atoms, so no balance/rate rescale
-- is required here; changing only the public-unit metadata preserves economic value.
UPDATE system_settings
SET value_json=json_set(
      json_remove(value_json,'$.creditScaleVersion'),
      '$.mkreditsPerUsd',1000,
      '$.creditAtomsPerUsd',10000000,
      '$.creditAtomsPerMkredit',10000,
      '$.creditUnit','MKredit',
      '$.creditScaleVersion',3
    ),
    updated_at=unixepoch()
WHERE key='commercial';
