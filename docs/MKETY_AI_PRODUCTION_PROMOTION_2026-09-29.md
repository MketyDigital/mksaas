# Enterprise AI production promotion — 2026-09-29

Release base: `e20d2c4949565787bfd0e1db8b93045d49df0bae`.

Purpose: authorize guarded production infrastructure acceptance for the completed Enterprise AI stabilization work.

The production workflow must:
- verify the exact main SHA and required CI/build/migration/Cloudflare evidence;
- apply production database migrations through the guarded executor;
- provision/verify the Enterprise AI delivery Queue and dead-letter queue;
- deploy the `mkety-ai-delivery` worker;
- deploy the exact application SHA and attach `ai.mkety.com` and `api.mkety.com`;
- rotate/synchronize the internal delivery callback secret;
- run fail-closed product/API/internal endpoint smokes.

## Safety boundary

This promotion **does not enable customer inference**. Production `customerInferenceEnabled` must remain OFF through infrastructure acceptance. Starpips/customer acceptance begins only after the product hosts and durable delivery infrastructure are verified in production, and inference is promoted only by a separate intentional acceptance decision.
