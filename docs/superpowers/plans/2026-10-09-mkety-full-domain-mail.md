# Mkety Full-Domain Mail Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the existing single Zoho `hello@mkety.com` mailbox into Mkety Mail, make all selected `@mkety.com` addresses independent Mkety inboxes, and provide an auditable Cloudflare apex cutover that cannot proceed before real acceptance and rollback checks.

**Architecture:** Use durable PostgreSQL migration runs and source-message identities, encrypted source credentials, and an isolated Cloudflare Queue consumer that reads generic IMAP over verified TLS and writes messages through authenticated internal Mail APIs. Extend archive import from EML to MBOX/ZIP, preserve the current manual EML path, and route root inbound mail through one Cloudflare apex catch-all Worker rule after explicit first-party Ops authorization. The initial Zoho source is one mailbox (`hello@`); current aliases are not separate import sources.

**Tech Stack:** TypeScript, Vinext/React server actions, Drizzle/PostgreSQL via Hyperdrive, Cloudflare Workers TCP sockets/Queues/R2/Email Routing, PostalMime, Vitest/Jest project conventions, Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-09-mkety-full-domain-mail-cutover-design.md`

## Global Constraints

- Import Zoho `hello@mkety.com` exactly once; current alias addresses are not separate source mailboxes.
- Keep imported history in `hello@` and preserve original recipient headers; do not guess which historical alias message belongs in a future inbox.
- Create distinct `hello@`, `cloudflare@`, `billing@`, `info@`, and `support@` mailbox records; inventory and map every additional live root address before cutover.
- Use one Cloudflare apex catch-all Worker rule and resolve mailbox recipients in Mkety Mail; reject unknown recipients rather than storing them in a default mailbox.
- Do not change root MX or enable apex Email Routing until explicit operator authorization and every readiness gate pass.
- Keep source messages unchanged; run initial and final delta imports and make import retries idempotent.
- Store source credentials encrypted only for the job lifetime; redact logs and delete credentials at job completion or cancellation.
- Permit generic IMAP only over verified implicit TLS on port 993; block loopback, private, link-local, Cloudflare-owned, and otherwise disallowed destinations.
- Preserve tenant isolation, mailbox membership/entitlements, storage caps, sending limits, suppression behavior, and the customer external-client feature flag.
- No changes to `customer-apps/assist`, Assist history, standalone branches, or unrelated customer projects.
- No production DNS/provider changes are part of code implementation or CI.

## Implementation status — 2026-10-10

- The schema, import parsing/storage, generic IMAP queue worker and internal APIs, provider-neutral migration UI, temporary subdomain test routes, first-party cutover checks, root catch-all activation, DNS snapshot restoration, recipient rejection, and documentation are implemented in PR #368 on `feat/mkety-full-domain-mail-migration`, based on `main` at `82008e3a28fea6593fc0548336bc769aa8719155`.
- Zoho's single `hello@mkety.com` mailbox is the sole initial source. Its aliases remain headers/history in the same import; the source identity remains stable across the initial pass and final delta.
- Code commit `e6205b7b85577293f2f0aad13f6ad9b11bcb6524` passed 153 Mail and internal API tests across 30 suites, TypeScript, ESLint, build, MegaLinter, migration baseline, Cloudflare/vinext and Platform Core smoke, Mail live-readiness diagnostics, PR validation, staging content DB migration/seed/smoke, and isolated Workers.dev candidate deployment. These checks do not establish real provider send/receive acceptance.
- Before production activation: record the read-only Cloudflare/Zoho inventory, provision every active mailbox, import and reconcile the one Zoho `hello@` source, pass live send/receive tests for every active root mailbox, run the source final delta, and rehearse rollback with evidence. The guarded Ops activation and rollback actions have not been run. No production provider or DNS changes were made.
- Work is limited to Mkety Mail and its documentation. The PR changes no `customer-apps/assist` paths; Assist and standalone Assist history are not part of this branch's changes.

## Review Focus

- A Zoho message addressed to `cloudflare@` is still imported once into `hello@`; its raw recipient headers remain searchable, and the alias is not imported as a second mailbox.
- IMAP unavailable, credential rejected, unsupported archive member, or source connection interruption leaves the source untouched and the run resumable with a clear failure.
- An attacker-controlled host or DNS result cannot make the importer connect to internal/private infrastructure or downgrade TLS.
- A worker retry after timeout cannot duplicate a message or mark the source message read/deleted.
- Unknown root recipient, missing mailbox, failed mailbox test, or incomplete rollback readiness cannot activate root MX routing.

---

### Task 1: Add durable migration and cutover records

**Files:**
- Create: `src/shared/db/schema/mail-migrations.ts`
- Modify: `src/shared/db/schema/index.ts`
- Modify: `src/shared/db/schema/mail.test.ts`
- Create: generated migration in `src/shared/db/migrations/`
- Test: `src/shared/db/schema/mail-migrations.test.ts`

**Interfaces:**
- Produce `mailMigrationRuns` with tenant/workspace/source mailbox/destination mailbox, provider type, source host/port, encrypted credential, run mode (`initial`/`delta`/`archive`), status, cursor/UIDVALIDITY, counts, sanitized error, started/completed timestamps, and actor IDs.
- Produce `mailMigrationMessages` keyed by migration run, source folder, and source UID when present; retain internet Message-ID/content fingerprint and the imported `mailMessages.id` for idempotency.
- Produce one first-party `mailDomainCutovers` record keyed to the configured `mkety-ops` tenant and `mkety.com`, with state and prepared/authorized/completed/rolled-back timestamps.
- Produce `mailDomainCutoverChecks` keyed by cutover and check name, with pass/fail, actor, message/evidence reference, safe details, and checked time; do not put recipient secrets or raw imported content in audit metadata.

- [x] **Step 1: Write failing schema and invariant tests** for tenant ownership, unique source identity, and the single-domain first-party cutover key. Validate application state transitions in the cutover service task.
- [x] **Step 2: Run the focused schema tests** and confirm they fail for the missing tables/invariants.
- [x] **Step 3: Add Drizzle schema and an additive SQL migration plus matching journal/snapshot entries.** Use cascade behavior only for tenant-owned migration data; retain imported mail under the existing mailbox lifecycle. If `drizzle-kit generate` proposes unrelated baseline/schema drift, exclude those unrelated changes from this Mail migration.
- [x] **Step 4: Run schema tests and migration baseline checks.** Verify migration SQL does not alter existing mailbox/message rows or provider configuration.
- [x] **Step 5: Commit** mailbox migration state records as part of PR #368.

### Task 2: Build safe, idempotent message import primitives

**Files:**
- Create: `src/features/mail/server/migration-import-core.ts`
- Create: `src/features/mail/server/migration-import-core.test.ts`
- Modify: `src/features/mail/server/migration-actions.ts`
- Modify: `src/shared/security/connection-secrets.ts` only if a narrowly scoped import helper is needed
- Test: `src/features/mail/server/migration-actions.test.ts`

**Interfaces:**
- Produce `parseImportedMessage(raw: Uint8Array, source: ImportSourceMetadata): ParsedImportMessage` using PostalMime with bounded nesting/header/body/attachment sizes.
- Produce `importMessageOnce(input: ImportMessageInput): Promise<{ imported: boolean; messageId: string }>`; it stores raw/body/attachments, preserves original dates and headers, records source folder/read state, and atomically links the source identity to one Mail message.
- Preserve `importMailEmlFiles` behavior for its current EML-only callers while routing storage through the shared import primitive.

- [ ] **Step 1: Add failing tests** for duplicate Message-ID/content, duplicate IMAP UID, message with alias in `To`, sent-folder mapping, read state, invalid date, malformed MIME, and attachment limits.
- [ ] **Step 2: Run those tests and verify the missing idempotency/metadata behavior.**
- [x] **Step 3: Implement the shared parser/import primitive** and source identity transaction; never change the source mailbox or mark messages read.
- [x] **Step 4: Add EML and MBOX parsing tests**, including malformed archive entries and decompressed-size/file-count limits. Add ZIP support only for EML/MBOX entries; leave PST on the documented conversion fallback until a safe parser is separately accepted. Tests cover EML/MBOX, stored/deflated ZIP, path traversal, expanded-size, and entry-count limits.
- [x] **Step 5: Run focused migration tests** and verify legacy EML import retains its current success path and size limits. The server-action integration test confirms the existing EML upload path still parses, stores, and completes, and unsupported uploads are rejected before a run is created.
- [x] **Step 6: Commit** safe idempotent migration imports as part of PR #368.

### Task 3: Add provider-neutral IMAP migration jobs

**Files:**
- Create: `workers/mail-migration/src/index.ts`
- Create: `workers/mail-migration/src/imap-session.ts`
- Create: `workers/mail-migration/src/imap-session.test.ts`
- Create: `workers/mail-migration/wrangler.jsonc`
- Create: `src/features/mail/server/migration-credentials.ts`
- Create: `src/features/mail/server/migration-credentials.test.ts`
- Create: `src/app/api/internal/mail/migrations/claim/route.ts`
- Create: `src/app/api/internal/mail/migrations/message/route.ts`
- Create: `src/app/api/internal/mail/migrations/progress/route.ts`
- Modify: `wrangler.jsonc`
- Modify: `.github/workflows/mkety-mail-production.yml`
- Modify: `package.json` scripts only if worker checks need a named command

**Interfaces:**
- `POST /api/internal/mail/migrations/claim` accepts `{ runId }` with the existing Mail internal secret and returns only the claimed run's validated source endpoint, decrypted credential, and destination IDs over TLS.
- `POST /api/internal/mail/migrations/message` accepts `{ runId, folderPath, uid, uidValidity, flags, rawMessage }`, stores a message through Task 2, and returns the stable imported message ID.
- `POST /api/internal/mail/migrations/progress` accepts a bounded status/count/cursor update and deletes encrypted credentials when a run completes or is cancelled.
- `mkety-mail-migration` Queue messages contain only `{ runId }`; a dedicated Worker consumes jobs, connects with Cloudflare `connect()` using TLS on port 993, uses read-only IMAP commands, and calls the internal APIs.

- [ ] **Step 1: Write failing tests** for credential encryption/decryption and deletion, host/port validation (993 only), TLS-only connection, private/loopback/link-local address rejection, IMAP UID resume, UIDVALIDITY reset, and retry-safe progress.
- [ ] **Step 2: Run tests and confirm failures** for missing validation and worker protocol handling.
- [x] **Step 3: Implement encrypted credential lifecycle** using the existing AES-GCM connection-secret pattern and the existing connection encryption secret; do not store source passwords in Queue messages or logs.
- [x] **Step 4: Implement bounded IMAP client flow**: greeting, TLS, capability, login, LIST, SELECT read-only, UID search/fetch, folder mapping, UIDVALIDITY resume, logout. Permit only port 993, verify the connected TLS peer IP is publicly routable before sending credentials, and rely on Cloudflare's socket guard to reject Cloudflare-owned and private-network destinations.
- [x] **Step 5: Implement internal claim/message/progress routes** with the Mail internal secret, tenant/run checks, request size limits, and sanitized errors.
- [x] **Step 6: Add Queue producer/consumer bindings and worker deployment** to the Mail production workflow; worker deployment must not enable apex routing or mutate root DNS.
- [x] **Step 7: Run worker tests and existing Mail gateway/ingress tests**; verify no read/delete/store flags are sent to the source. The full suite passed all Mail tests; focused IMAP tests confirm EXAMINE and BODY.PEEK[] only.
- [x] **Step 8: Commit** the provider-neutral IMAP migration worker as part of PR #368.

### Task 4: Add migration controls and progress UI

**Files:**
- Create: `src/features/mail/server/mail-migration-actions.ts`
- Create: `src/features/mail/server/mail-migration-actions.test.ts`
- Modify: `src/app/app/[tenant]/mail/migration/page.tsx`
- Create: `src/features/mail/components/MailboxMigrationForm.tsx`
- Create: `src/features/mail/components/MailMigrationRunList.tsx`
- Modify: `src/features/mail/server/migration-actions.ts`

**Interfaces:**
- `startImapMailMigration(tenantSlug, formData)` verifies workspace manager access, an active destination mailbox, supported port/TLS, and a bounded source; encrypts credentials, inserts an auditable run, and enqueues only its run ID.
- `startArchiveMailMigration(tenantSlug, formData)` creates a resumable archive run and accepts EML/MBOX/ZIP within configured compressed/decompressed limits.
- `cancelMailMigration(tenantSlug, runId)` cancels only an authorized in-progress run and clears its encrypted credential.
- The migration page displays provider-neutral source setup, current jobs, per-folder counts, imported/skipped/failed totals, resumability, and safe errors. Zoho's first-party source job is explicitly `hello@` → `hello@`; aliases are shown as current aliases, not import jobs.

- [ ] **Step 1: Add failing action tests** for manager-only access, cross-tenant mailbox IDs, unsupported ports, oversized uploads, encrypted password persistence, Queue payload content, cancel authorization, and repeated submission.
- [ ] **Step 2: Run focused tests and confirm failures.**
- [x] **Step 3: Implement start/cancel actions** and read-only run queries; apply per-tenant storage and job concurrency limits.
- [x] **Step 4: Implement migration UI** while retaining the existing export links and EML batch flow.
- [x] **Step 5: Run migration UI/action tests**, `pnpm type-check`, and focused lint for changed files. TypeScript and focused lint pass; action tests cover tenant-scoped destination selection and credential encryption/queue payload.
- [x] **Step 6: Commit** provider-neutral mailbox migration as part of PR #368.

### Task 5: Route first-party root mail through one Worker catch-all

**Files:**
- Modify: `src/features/mail/server/domain-provisioning-policy.ts`
- Modify: `src/features/mail/server/domain-provisioning-policy.test.ts`
- Modify: `src/features/mail/server/domain-actions.ts`
- Modify: `src/features/mail/server/mailbox-actions.ts`
- Modify: `src/features/mail/server/admin-actions.ts`
- Modify: `src/features/mail/components/FirstPartyMailIngressAliasesForm.tsx`
- Modify: `src/app/ops/[tenant]/platform-control/[module]/page.tsx`
- Modify: `src/app/api/internal/mail/resolve-recipient/route.ts` only if tests show a necessary recipient normalization change
- Tests: related domain provisioning, mailbox actions, ingress aliases, recipient resolver tests

**Interfaces:**
- Keep `mkety.com` first-party domain addition from changing root MX. Sending authentication may be prepared separately after read-only DNS inventory.
- Add a first-party Mail Ops acceptance record and action. Before root MX changes, require: the reserved tenant is correct; `hello`, `cloudflare`, `billing`, `info`, `support` and inventoried live addresses have distinct active mailbox rows; the one `hello` initial import is reconciled; each mailbox has successful outbound test delivery; each mailbox has successful inbound delivery through a temporary exact route on `mail.mkety.com`; root SPF/DKIM/DMARC checks pass; and rollback MX/TXT values plus operator evidence are recorded. After authorized root cutover, require a live inbound test to each root mailbox and final `hello` delta reconciliation before marking complete.
- On explicit authorized execution only, first set the catch-all action to `mkety-mail-ingress` and read it back; do not alter MX if this cannot be proven ready. Then persist the root domain as routing-ready for the recipient resolver, call Cloudflare Email Routing DNS onboarding as the final activation step, verify public MX and Cloudflare state, and audit the result. If DNS onboarding fails, retain the prepared route, restore the prior app routing state when safe, record the failure, and require operator reconciliation. Do not run this from `addMailDomain` or ordinary mailbox creation.
- When root routing is enabled, mailbox creation must not add one literal Cloudflare rule per address. Exact Mailbox rows continue to resolve in the Worker; unknown recipients fail closed.
- Replace the current Zoho-forwarding alias UI with full-domain cutover status and clear messaging that `hello@` and its current aliases move into Mkety Mail.

- [ ] **Step 1: Add failing tests** proving ordinary customers cannot enable reserved-root routing, first-party `addMailDomain` leaves root MX untouched, incomplete import/acceptance/rollback blocks activation, catch-all is verified before DNS onboarding, one catch-all action is configured, and mailbox creation creates no exact Cloudflare route for root.
- [ ] **Step 2: Run those tests and confirm the existing split behavior fails the new target assertions.**
- [x] **Step 3: Implement isolated first-party routing policy and guarded Ops action**; leave subdomain and customer-domain routing behavior unchanged.
- [ ] **Step 4: Add resolver and mailbox tests** for `hello`, `cloudflare`, `billing`, `info`, `support`, future provisioned addresses, and rejection of unknown recipients.
- [x] **Step 5: Run focused routing tests plus migration baseline.** Focused routing tests and the migration baseline pass. No live Cloudflare call or DNS mutation was made.
- [x] **Step 6: Commit** first-party apex mail routing gates as part of PR #368.

### Task 6: Reconcile architecture docs, plan, and current workstream state

**Files:**
- Modify: `docs/MKETY_MAIL_PRODUCTION_ARCHITECTURE.md`
- Modify: `docs/superpowers/plans/2026-10-02-mkety-first-party-mail.md`
- Modify: `docs/superpowers/specs/2026-10-02-mkety-first-party-mail-and-starpips-pilot-design.md`
- Modify: `docs/superpowers/specs/2026-10-04-mkety-internal-mail-bootstrap-design.md`
- Modify: `docs/CURRENT_WORKSTREAM_STATUS.md`
- Modify: `docs/README.md` only if active spec/plan indexing requires it
- Test: repository migration/docs checks and changed Mail test suites

- [x] **Step 1: Update the architecture and older plan/spec amendments** so full-domain hosting supersedes the prior Zoho split; retain old evidence only as historical context.
- [x] **Step 2: Update current status** with exact branch/head, changed paths, test evidence, no production mutations, blockers, and the next guarded acceptance step.
- [x] **Step 3: Run exact changed Mail suites, `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm db:check:migrations`, Cloudflare worker tests, and `git diff --check`.** Direct local binaries were used where the pnpm wrapper attempted an unavailable install. TypeScript, lint (0 errors), build, migration baseline, Wrangler dry-run, and diff check pass. Full Jest has 2 environment-blocked unrelated subprocess suites; all Mail tests pass.
- [x] **Step 4: Review full diff** for `customer-apps/assist`, standalone Assist history, secrets, DNS side effects, disabled feature-flag changes, and unrelated behavior; expected: no Assist files and no live settings changed. No Assist paths are changed, no secrets are added, and no live DNS/provider mutation was performed.
- [x] **Step 5: Commit** the full-domain migration plan and cutover gates as part of PR #368.

## Execution Notes

- This plan implements code and a guarded operator cutover path. It does not authorize running the production root MX action. Production cutover requires real-world mail tests and a separate explicit operator action after all checks pass.
- The first import is one Zoho mailbox: `hello@mkety.com` into the Mkety `hello@` inbox. Existing aliases are not source mailboxes; messages they forwarded are already in the same Zoho history.
- Spaceship Spacemail and other IMAP providers use the same generic IMAP connector; no provider-specific source adapter is required. PST remains a conversion-to-EML/MBOX fallback until a safe native parser is separately verified.
- The current customer external-client flag remains off.
- Implementation changes are grouped in PR #368 commits rather than split into the originally suggested per-task commits. Test and live-acceptance checkboxes above remain open where their specific evidence is still missing; the final acceptance gates are not satisfied until the Zoho import and real mailbox round trips are recorded.
