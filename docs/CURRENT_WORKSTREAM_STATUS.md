# Current Repository Workstream Status

**Updated:** 2026-11-23 (Mail production and diagnostics refreshed; other live production details remain as last verified on 2026-11-03)
**Verified main:** `1333ab4c10ee8e047bce4e01c5583671b182c8c5`

## Current production truth

- The `mkety.com` public production cutover was completed previously. Routine code or content edits do not require another cutover. Do not rerun `CUTOVER MKETY PUBLIC` unless an actual public-domain migration is proposed and explicitly authorized.
- `app.mkety.com` is the authenticated Mkety Platform. `mkety.app` is intended for the Mkety Apps entry page and customer preview/production hostnames. The customer routing implementation is in the repository, but the production Cloudflare router and customer host routing are **not active**.
- Public AI is live and was verified to return a relevant answer on the public website after production workflow #35. Public and Workspace AI share the central approved provider/model catalog while remaining independent from Enterprise customer inference. Enterprise customer inference remains **OFF**.
- Central AI admin/provider updates and runtime work are deployed. Do not enable Enterprise customer inference until its separate customer, budget, cost, isolation, and end-to-end acceptance gate is complete.
- Mail Production workflow #117 deployed successfully on 2026-11-20; its readiness report still says `workspace=active`, `root_sending_domain=pending`, SPF/DKIM/DMARC pending, `info` and `support` active, root sending enabled, and Cloudflare ingress disabled. Mail Gateway Production #63 deployed successfully the same day. The scheduled Gateway run #64 on 2026-11-23 renewed the certificate successfully and skipped deployment by design. Mail is **not yet ready for live first-party delivery acceptance**.
- `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false`; customer SMTP/IMAP remains gated. Functional Acceptance #60 passed its setup and cleanup steps on 2026-11-20, but the real SMTP/IMAP app-password steps were skipped by this flag. Run #61 on 2026-11-23 was skipped because it followed a scheduled Gateway run, which is not an accepted acceptance trigger. Neither run proves real customer or first-party delivery.
- The read-only Cloudflare diagnostics refreshed on 2026-11-23: repository token verification and zone/DNS/Email Sending/event-subscription reads all returned HTTP 200, and both app-host Mail Cloudflare bindings are present. Its 150-second Worker-tail step was force-stopped after the observation window (exit 137), causing that diagnostic run to fail; no setup-failure records were emitted before shutdown. A follow-up code fix is being prepared so only this bounded timeout is treated as an expected tail stop; other unexpected kills still fail.
- `MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD` is not an arbitrary password setting and is not consumed by the production workflow. Platform Control generates an SMTP-only password, stores it hashed, and displays it once after readiness checks. Do not rotate it until sending-domain authentication is ready and the operator is present to capture it. No password was generated in this workstream.
- Assist remains an isolated production product with its own runtime, data, AI controls, and credentials. This workstream made no Assist source, deployment, DNS, or runtime changes.

## `mkety.app` domain audit and routing gates

Read-only Cloudflare audit #2 ([run 41553033429](https://github.com/MketyDigital/mksaas/actions/runs/41553033429)) used GET requests only and redacted TXT values. It found the active zone and these existing records, which must be preserved:

| Host | Existing use |
| --- | --- |
| `*.assist.mkety.app`, `assist-origin.mkety.app`, `mkety-assist.mkety.app`, `mkay.assist.mkety.app`, `starpips.assist.mkety.app` | Assist routing |
| `assets.mkety.app` | `mkety-media-assets` Worker |
| `media-fallback.mkety.app`, `customers.mkety.app` | Media/customer fallback |
| `etyarts-pages.mkety.app` | EtyArts Pages |

The audit found no apex DNS record or apex Worker domain for `mkety.app`; it also found no general `*.mkety.app` Worker route. Do not add a broad wildcard: it would overlap existing Assist, media, customer, and Pages hostnames.

The customer router is not deployed. The audit saw Cloudflare return HTTP 403 for the configured token's dispatch-namespace read, the router Worker/settings were absent, and `mkety-platform` did not have the `MKETY_DEPLOYMENT_LOOKUP_SECRET` binding required by the hostname resolver. These are deployment blockers, not evidence that customer previews are live. Resolve the least-privilege Cloudflare access and secret-binding requirements, then deploy and smoke-test the isolated router before attaching the exact apex. Add only verified customer hostnames after checking each against the existing zone; do not publish a catch-all route.

PR #478 merged as `faa1b7c61a1979e03d9ba07a9597586620bbfc88`; the apex response now links to both public Mkety and the Platform. This is code-only: the apex still has no DNS/Worker-domain attachment.

## Mail acceptance and remaining gates

- Mail acceptance run #54 stopped in preflight at the source-diff guard before creating a synthetic fixture or ephemeral app; no production Mail state changed.
- PR #477 (`4ef57bc8dc3145a895ee70834ecb714260667348`) and follow-up PR #480 (`36caef6dd27de1a0618bb629de96ac727e7a2d36`) merged the scoped source-diff allowlists and strict no-op cleanup condition. Acceptance run #55 stopped before mutation because two unrelated router paths were not yet allowlisted. Run [#56](https://github.com/MketyDigital/mksaas/actions/runs/41555176090) passed preflight, used an ephemeral synthetic fixture/app, received HTTP 401 for synthetic customer SMTP auth while `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false` (expected fail-closed behavior), and confirmed fixture cleanup and ephemeral app deletion. This verifies the disabled-client gate and cleanup; it does not test live customer IMAP/SMTP delivery or first-party SMTP.
- The exact synthetic fixture from run `36672362451` was targeted by recovery dispatch [#3](https://github.com/MketyDigital/mksaas/actions/runs/41697827800) on 2026-11-03. The workflow completed both exact-target verification and the stale-fixture cleanup step successfully. The earlier failed cleanup run [#1](https://github.com/MketyDigital/mksaas/actions/runs/41557060095) remains part of the history; the later successful recovery means this fixture is no longer an open cleanup gate. This does not verify first-party or real-customer Mail acceptance.
- Complete root sending-domain SPF/DKIM/DMARC setup through the authenticated Mail Operations domain action, without enabling root Email Routing or changing the existing apex MX. Then run a non-activating first-party SMTP authentication/delivery/receipt check and verify the imported `hello@` mailbox plus rollback readiness. Keep external customer clients disabled until their separate live TLS/authentication/delivery gate passes.

## Other completed work

- NOWPayments currency/network verification and settlement work, with the integration playbook, is merged. No live charge was created as part of this work.
- Production Cloudflare Tunnel connectors were upgraded to cloudflared **2026.10.3** and **2026.10.6**, and were verified healthy with origin certificate verification retained. See [upgrade run](https://github.com/MketyDigital/mksaas/actions/runs/40916779384) and [read-only audit](https://github.com/MketyDigital/mksaas/actions/runs/40917149896).

## Release boundaries

- Use scoped, exact-SHA production workflows and verify the live result. A green candidate check is not production acceptance.
- Keep Enterprise customer inference OFF until its explicit acceptance gate passes.
- Do not change existing `mkety.app` customer, Media, Pages, or Assist hostnames while provisioning the apex or a specific customer hostname.
- Do not change Mail sender DNS, external-client access, passwords, or credentials until the corresponding readiness and operator handoff gates pass.
