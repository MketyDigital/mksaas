# Current Repository Workstream Status

**Updated:** 2026-10-30  
**Source of truth:** `main` at `cba6ead566c8f90b145993e26470531f50dd61ac`

## Current truth

- The `mkety.com` public production cutover was completed previously. Routine edits do not require another cutover. Do not rerun `CUTOVER MKETY PUBLIC` unless an actual domain or route migration is proposed and explicitly required.
- `app.mkety.com` is the authenticated Mkety Platform. `mkety.app` is the customer app and preview namespace. PR [#469](https://github.com/MketyDigital/mksaas/pull/469) merged the customer deployment router, artifact handling, hostname ownership, preview, and approved promotion code. Candidate checks passed. No `mkety.app` DNS, Worker route, or customer hostname was changed; production attachment still requires a read-only audit of existing media/customer records and staged hostname acceptance.
- Public AI, central provider/model catalog work, NowPayments parity, and the related migration/docs updates merged in [#469](https://github.com/MketyDigital/mksaas/pull/469), commit [`8472efb`](https://github.com/MketyDigital/mksaas/commit/8472efb0df030ac300d82552431f3570f1201a8e). Candidate checks passed, including provider responses and isolated Worker checks.
- The post-merge Public AI runtime diagnostic [run #41036718139](https://github.com/MketyDigital/mksaas/actions/runs/41036718139) confirmed database connectivity and the assistant history endpoint, but its protected config diagnostic returned HTTP 500. Do not treat that as a successful live AI response. Commit [`cba6ead`](https://github.com/MketyDigital/mksaas/commit/cba6ead566c8f90b145993e26470531f50dd61ac) adds a main-only manual trigger to the frozen-release Public AI hotfix workflow; verify its guarded deployment and live-answer smoke before marking Public AI operational. The workflow must not bind routes or change DNS.
- Public and Workspace AI are independent of the Enterprise customer inference gate. Enterprise customer inference remains **OFF** until controlled tenant, domain, cost/budget, and end-to-end acceptance is complete.
- Mail Production [run #113](https://github.com/MketyDigital/mksaas/actions/runs/40940246964) deployed the Mail workers and first-party SMTP server-action database-context fix. It reported an active workspace/mailboxes, but root SPF, DKIM, and DMARC were pending; Mail ingress and external IMAP/SMTP clients remained disabled. The successful R2 content smoke is not an SMTP delivery test. Do not accept mail as production-ready until domain authentication is verified and a real non-activating SMTP test succeeds.
- `MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD` is for the Mail acceptance test; it is not an arbitrary credential to invent. The Platform Control action generates the SMTP-only password once after the workspace, mailbox, and domain pass readiness checks. The current secret's presence is not verified here.
- NOWPayments integration code and the [integration playbook](https://github.com/MketyDigital/mksaas/blob/main/docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md) are merged. Candidate API-key and webhook safety checks passed; no live charge was created.
- The production Cloudflare Tunnel connectors were upgraded to cloudflared **2026.10.3** and **2026.10.6**, verified healthy with origin TLS verification retained. See [upgrade run](https://github.com/MketyDigital/mksaas/actions/runs/40916779384) and [read-only audit](https://github.com/MketyDigital/mksaas/actions/runs/40917149896).
- Assist remains a separate production app, data, controls, and ledger boundary. This workstream made no Assist source, deployment, or runtime changes.

## Release boundaries

- Use exact-SHA, scoped production workflows. Candidate success is not production acceptance.
- Do not change customer routes, `mkety.app` DNS, Mail sender DNS, or the completed `mkety.com` cutover without a scoped before/after audit and rollback plan.
- Keep Enterprise inference disabled until its explicit acceptance gate passes.
- Keep customer IMAP/SMTP disabled until live TLS, authentication, delivery, and receipt checks pass.
