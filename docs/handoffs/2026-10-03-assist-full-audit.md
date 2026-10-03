# Mkety Assist full audit — 2026-10-03

## Scope and baseline

Audit scope is the standalone Mkety Assist product under `customer-apps/assist/`, its dedicated CI/deploy workflows, current Assist handoffs/specs/plans, and the secret-backed production path used by GitHub Actions. The production baseline audited is `main` SHA `65493225017a358ad5fcd9c8ffd58c57c73b9ca7`.

This audit intentionally avoids speculative runtime changes because a live enterprise customer is already using the assistant. It verifies the deployed path first and records residual controls separately.

## Verified current state

- PR #321 merged reasoning/fallback, context/replay, settlement journal, reconciliation, route-readiness, and recovery hardening.
- PR #331 merged the final settlement-journal Durable Object transport correction and clean delivered-state behavior.
- Exact-head PR #331 Assist CI run `37057426643` succeeded.
- The focused Node suite reported 87 tests, 87 passes, 0 failures.
- Operator browser validation succeeded.
- Local D1 migrations through the current migration set succeeded.
- Wrangler deploy dry-run succeeded.
- Current-main repository Typecheck, Lint, Build, Tests, CI, Todo Checker, and CodeQL runs succeeded.
- Production Assist deploy run `37057870084` succeeded end-to-end.

## Production deploy evidence

The production job passed all of the following without exposing secret values:

1. required deployment-secret presence checks;
2. isolated dependency/tool installation and TypeScript check;
3. ZITADEL Operator OIDC application reconciliation;
4. Cloudflare account, zone and D1 discovery;
5. Assist SaaS DNS topology;
6. R2 media bucket and reply/inbound queues;
7. generated production Wrangler configuration;
8. remote D1 migrations;
9. Telegram recovery-bot identity and webhook-secret normalization;
10. isolated Assist Worker deployment and hosted custom domains;
11. deploy-probe credential generation and Worker secret upload;
12. managed-provider credential bootstrap;
13. real production inference acceptance;
14. synthetic conversation-quality acceptance through the isolated probe path;
15. read-only media/MKredit/provider-cost reconciliation;
16. Telegram recovery webhook registration;
17. final Worker health smoke;
18. successful GitHub deployment status publication.

Production accounting output proved `$1 = 1000 MKredit`, `$0.03 = 30 MKredit`, and the internal precision/rate invariant.

## Security and resilience evidence

Focused coverage includes:

- tenant/assistant scoped context-cache keys and knowledge retrieval;
- business instruction authority over customer/media/retrieved context;
- end-user inability to override owner reasoning choice;
- disabled/incompatible fallback targets not becoming eligible;
- route pause preserving ordered fallback;
- webhook acknowledgment only after durable queue receipt;
- atomic/idempotent ledger settlement and no duplicate charge;
- tenant-scoped stale-attempt listing;
- provider-cost-without-usage remaining unresolved;
- evidenced provider-charged settlement and explicit Mkety cost absorption;
- recovered-result settlement/delivery;
- immutable resolution audit without prompt/secret content;
- concurrent retry single provider-attempt claim;
- cross-customer/assistant attempt rejection;
- provider success journaled before return;
- D1 outage after provider result replaying without a new generation;
- delivery retry without repeat settlement;
- API idempotency and transient-capacity reservation preservation;
- fallback-attempt provider-cost accounting;
- vision/speech journaling before settlement;
- human takeover blocking pending delivery;
- reservation DB failure preventing provider dispatch;
- unknown outcome never automatically replayed.

## Audit cleanup performed

PR #285 was still open but 68 commits behind main. Its substantive changes are already present on current main: Worker-safe HMAC password hashing with legacy PBKDF2 verification, removal of unsupported Cloudflare custom-hostname `custom_metadata`, bot-sender suppression, and linked owner/admin Telegram suppression. The stale PR was documented and closed rather than merged.

## Non-Assist MegaLinter result

The current-main MegaLinter push run fails because of historical repository-wide actionlint/ShellCheck/link/link-check findings outside the isolated Assist source tree. MegaLinter explicitly excludes `customer-apps/assist/`. Assist workflow text itself only surfaced non-blocking spell-check vocabulary such as `MKredit`/`mkredits` and shell keyword `elif`. Dedicated Assist CI and all normal repository build/test/type/lint/CodeQL checks are green on the same main SHA.

## Remaining controls

1. **Protect `main`.** GitHub reports the branch as `protected: false`. Require pull requests and the appropriate CI checks before merges/direct updates. The audit connection cannot administer branch protection, so this must be changed through repository administration.
2. **Make isolated installs reproducible.** `customer-apps/assist` has no npm lockfile and both CI/deploy use `npm install`. Add a reviewed lockfile and switch to `npm ci` in a separate non-runtime hardening change.
3. **Do not run destructive fault injection on the live customer Worker.** Recovery is strongly covered by deterministic tests. If live storage/provider fault injection is desired, provision an isolated disposable Worker/D1/Queue environment and run the acceptance there.
4. **Keep live customer conversations clean.** Do not send synthetic audit messages into real customer threads; use internal deploy-probe acceptance and read-only diagnostics.

## Release assessment

The audited Assist runtime and production deployment are healthy on `65493225017a358ad5fcd9c8ffd58c57c73b9ca7`: dedicated checks pass, real provider acceptance passes, billing/reconciliation invariants pass, Cloudflare/ZITADEL/Telegram integration setup passes, and the final health smoke passes. The two meaningful remaining gaps are release-governance/reproducibility controls (unprotected `main`, no isolated npm lockfile), not a verified live Assist runtime defect.
