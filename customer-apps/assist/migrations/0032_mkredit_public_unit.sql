-- Separate public MKredit from the high-precision internal accounting atom.
-- Public/business unit: $1 = 1,000 MKredit.
-- Internal storage remains 10,000,000 credit atoms per USD so tiny provider
-- charges can be settled without rounding away value.
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
