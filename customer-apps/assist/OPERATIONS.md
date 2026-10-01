# Mkety Assist Operations

Assist is independently deployable. Never use Main Mkety application code or its database for customer, assistant, credit, usage, or portal state.

## Release gate

Run:

```bash
npm run check:all
npm run type-check
npx wrangler deploy --dry-run
```

Production deploys must apply D1 migrations first and then deploy the standalone Assist Worker. A failed migration, missing payment secret, unverifiable rate/policy state, or unavailable credit account is a hard stop.

## Rollback

1. Stop deploy.
2. Re-deploy the previous known-good Assist Worker revision.
3. Do not reverse an applied migration destructively. Ship a forward repair migration.
4. Preserve payment/webhook idempotency records and credit ledger rows.
5. Re-run production acceptance before restoring traffic.

## Live smoke

Verify hosted login, password setup/change, session revocation, assistant pause and customer-wide handoff, Telegram text/photo/voice, reminders, API keys, custom-domain HTTPS, customer-safe usage, Operator credit adjustment, and checkout creation for each enabled payment method. Browser return pages are never settlement proof.
