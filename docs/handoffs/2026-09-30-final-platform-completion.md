# Mkety Final Platform Completion — 2026-09-30

## Goal

Finish Mkety as one coherent production platform before onboarding waiting customers. This workstream covers:

- Mail exact-SHA production + gateway + functional acceptance;
- public/auth/user/admin navigation and runtime performance;
- Platform Control authorization/runtime binding;
- Enterprise AI pricing/funding/profit controls;
- Mkety-managed and customer-BYOK model routing;
- self-hosted/direct-frontier model support;
- token/context efficiency;
- provider rate-limit resilience and durable retry;
- controlled Starpips acceptance before customer inference is enabled.

Do not mark this workstream complete from code merge alone. Completion requires exact-SHA checks, production promotion where applicable, and customer-path acceptance.

## Mail state and gates

Completed before this branch:

- Mail Production passed on the post-handoff release sequence.
- Mail Gateway Production passed with public DNS/TLS/IMAP/SMTP acceptance.
- Gateway workflow trigger symmetry is fixed so Mail workflow-only changes can no longer silently skip Gateway.
- Functional acceptance workflow discovery bug is fixed: gateway SHA/run discovery now emits a newline compatible with Bash `read` under `set -e`.
- External clients remain disabled until the synthetic functional acceptance passes.

Required final Mail evidence:

1. exact release SHA passes Build/Lint/Tests/Typecheck/CI;
2. Mail Production passes;
3. Mail Gateway Production passes public protocol acceptance;
4. self-cleaning functional acceptance creates a temporary tenant/mailbox/app password;
5. IMAP login/list/read works;
6. SMTP authentication and controlled submit path works;
7. revoked credential fails;
8. removed/suspended commercial access fails;
9. fixtures are deleted;
10. only then intentionally enable `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED`.

## App / dashboard / admin hardening

### Production app-host authorization

Platform Control requires all three controls:

- reserved `MKETY_PLATFORM_CONTROL_TENANT_SLUG`;
- exact operator email in `MKETY_PLATFORM_ADMIN_EMAILS`;
- PBAC permission.

The dedicated `mkety-app-host` repair workflow now requires and writes the first two runtime values instead of deploying an app worker without them.

### Admin authorization consistency

The admin layout and admin stats loader now use the same `admin:dashboard` authorization contract. The stats service no longer silently escalates the requirement to `admin:settings`.

Admin landing statistics and recent audit activity are loaded in parallel.

### Auth/navigation loading

Tenant server layout already resolves the authenticated session. Tenant client UI now receives that session through a nested seeded AuthProvider and does not wait for a second `/api/auth/session` round trip merely to render sidebar/header identity and permissions.

Workspace selection reuses the session membership snapshot rather than re-querying all roles.

### Platform admin vs customer admin

The global Mkety Control Center is not ordinary customer administration.

- Ordinary tenant admins retain their tenant administration pages.
- The Control Center navigation item is only rendered when the server has confirmed the reserved platform tenant, approved operator email, and admin permission.
- `/admin` preferentially sends an approved platform operator to the reserved platform-control tenant.
- Customer admins are not shown links that inevitably redirect as unauthorized.

## Enterprise AI commercial model

### Customer-facing contract

Mkety may negotiate a monthly Enterprise AI commitment, for example:

- monthly commitment: USD 70;
- minimum funding/top-up: USD 25;
- optional setup fee: separate where negotiated;
- prepaid AI credits/capacity;
- hard stop rather than uncontrolled postpaid provider spend.

For prepaid-partial contracts, a customer may fund the minimum, more than the minimum, or the remaining monthly commitment.

The customer sees:

- Mkety plan/funding terms;
- funded amount and remaining commitment;
- Mkety credits/usage;
- requests/tokens where useful;
- Mkety's own charge/rate.

The customer must never see:

- provider raw cost;
- provider markup;
- internal managed-cost share;
- internal margin/profit calculation;
- infrastructure-vs-AI internal allocation.

### Internal commercial policy

Every immutable Enterprise AI plan version may carry:

- `minimumFundingMinor`;
- `managedCostShareBps`;
- `setupFeeMinor`;
- `fundingMode = full_period | prepaid_partial`;
- `creditRollover`;
- `hardStop`.

Example: USD 70 funded with a 15% managed-cost envelope allows USD 10.50 of Mkety-managed upstream model cost before top-up/hard-stop protection. That split is internal Mkety economics, not a customer billing breakdown.

### Partial funding settlement

Partial funding is not forced through the ordinary full-period Billing settlement path.

Each funding checkout has purpose `enterprise_ai_funding` and:

1. verifies its own provider quote;
2. creates an immutable Billing settlement;
3. creates a Billing ledger payment entry;
4. updates monthly collection status to `partial` or `paid`;
5. activates prepaid Enterprise access after verified funding;
6. grants proportional purchased credits idempotently;
7. keeps a failed later top-up from cancelling an already-active subscription.

The monthly billing period is only marked fully paid when cumulative verified funding reaches the contractual commitment.

Setup fees use the existing Enterprise Payments exact-amount path and are intentionally separate from recurring/top-up funding.

### Provider-cost envelope

For Mkety-managed inference only:

`verified funding × managedCostShareBps`

sets the internal provider-cost envelope for the current Enterprise billing period.

Recorded `providerCostUsdMicros` is summed against that envelope. Before a new managed request is dispatched, estimated upstream cost must fit inside the remaining envelope. If not:

- no provider call is made;
- credit/budget holds are released;
- customer receives a top-up/capacity message;
- internal percentage/economics remain hidden.

BYOK provider cost belongs to the customer provider account and is not charged against Mkety's managed-provider envelope.

## Managed model abstraction

Customer-facing aliases remain stable Mkety names. The customer does not need to know where a managed model runs.

A managed DB model/alias can resolve to:

- Workers AI;
- direct OpenAI;
- Azure OpenAI;
- Google Gemini;
- Google Vertex AI;
- Cloudflare AI;
- AWS Bedrock;
- a public HTTPS OpenAI-compatible endpoint.

The OpenAI-compatible adapter enables approved Mkety-owned/self-hosted VM inference services. Endpoint URLs are validated as public HTTPS endpoints and credentials remain encrypted/system-owned.

Customer BYOK continues to use tenant/project-scoped connections and never silently falls back to Mkety-paid inference.

External managed models require verified provider-cost metadata before commercial execution:

- input micro-USD per million tokens;
- optional cached-input micro-USD per million;
- output micro-USD per million;
- provider-cost verification date.

Built-in verified Workers AI cost rates remain supported.

## Token and context efficiency

Enterprise channels persist conversation history for operator/handoff use but model context is bounded.

Current runtime policy:

- recent context is capped by message count;
- recent context is capped by characters;
- system prompt is capped separately;
- approved knowledge text is capped separately;
- commercial reservation estimate includes the bounded context;
- the entire historical conversation is not resent on each turn.

Further model/provider-native prompt caching may be enabled only where cache eligibility and privacy are explicit. Do not indiscriminately cache tenant/customer conversation content.

## Provider resilience

### Safe immediate retry

Only explicit provider capacity rejection is automatically retried in-process, such as:

- HTTP 429;
- recognizable rate-limit/busy/capacity rejection.

Generic timeouts or ambiguous upstream failures are not blindly replayed because the provider may already have performed chargeable work.

### Durable inbound retry

For channel traffic:

1. explicit capacity rejection releases the commercial hold;
2. the request attempt is marked provider-capacity-retryable rather than reconciliation-required;
3. an `inbound_retry` scheduled action is persisted;
4. the queue retries after a short delay;
5. scheduled-action claims/backoff recover longer outages;
6. repeated capacity failures do not settle customer credits;
7. only the successful AI attempt is settled;
8. the final customer reply uses the existing idempotent delayed-delivery path.

Ambiguous provider outcomes remain fail-closed in reconciliation and are not automatically sent upstream again.

## Production/customer acceptance order

Do not enable `customerInferenceEnabled` merely because this branch merges.

Final order:

1. PR exact-head Build/Lint/Tests/Typecheck/CI/Cloudflare checks;
2. production DB migration;
3. app-host repair on the exact certified current-main SHA;
4. public/auth/app/user/admin navigation and authenticated runtime smoke;
5. Mail Production/Gateway/functional acceptance;
6. Enterprise commercial accounting acceptance;
7. managed Workers AI request;
8. managed external/system-provider request;
9. BYOK request and fail-closed BYOK failure;
10. rate-limit retry/durable channel retry test;
11. cross-tenant isolation;
12. custom-domain route proof;
13. Starpips controlled Enterprise customer setup;
14. Starpips Telegram/web/operator-inbox/handoff/accounting tests;
15. profitability/provider-cost envelope verification;
16. only after all above succeeds, intentionally enable production `customerInferenceEnabled`;
17. onboard outside customers.

## Documentation closeout

After final production acceptance, update:

- `AGENTS.md`;
- `docs/CURRENT_WORKSTREAM_STATUS.md`;
- `docs/MKETY_DEVELOPMENT_CONTINUATION.md`;
- `docs/MKETY_MAIL_ENTERPRISE_AI_CUSTOMER_SETUP_RUNBOOK.md`;
- production/launch evidence docs.

Those status documents must describe the accepted production SHA/run IDs, not merely implementation intent.
