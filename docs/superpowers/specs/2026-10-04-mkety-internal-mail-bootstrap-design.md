# Mkety Internal Mail Bootstrap and Custom Capacity

> **Address topology superseded (2026-10-09):** follow `docs/superpowers/specs/2026-10-09-mkety-full-domain-mail-cutover-design.md` and its implementation plan. This bootstrap proposal remains background for the reserved workspace only. Do not execute its historical instructions to keep `hello@` in Zoho or configure Zoho forwarding.

## Historical address split amendment — superseded

The internal workspace creates the root-domain `info@mkety.com` and `support@mkety.com` mailboxes in Mkety Mail. `hello@mkety.com` stays in Zoho and is excluded from every ingress alias. Preserve root Zoho MX and DMARC. Configure Cloudflare Email Sending for the apex only after DNS authentication checks, and use exact Cloudflare Email Routing aliases on `mail.mkety.com` for Zoho-forwarded root mailboxes. Never enable Cloudflare Email Routing on the apex or create a catch-all alias.

**Status:** Draft for review  
**Date:** 2026-10-04  
**Scope:** Provision first-party Mail for the existing reserved `/mkety-ops` tenant without a customer purchase.

## Problem

The Mail Ops console can manage catalog entries and already-provisioned workspaces, but it has no supported action to create the first Mail workspace. Normal activation checks for `workspace.mail`, while the current subscription flow grants that entitlement through verified payment. This leaves Mkety’s reserved internal tenant unable to bootstrap Mail from the admin UI.

The public plans also apply finite monthly message quotas. Mkety has asked for a custom internal profile because this is its own tenant and must not require a purchase.

## Goals

- Let an authorized Platform Control operator bootstrap Mail for the one configured first-party tenant.
- Bind the action to both `MKETY_FIRST_PARTY_MAIL_TENANT_ID` and the expected tenant slug `mkety-ops`; ignore any caller-supplied target tenant.
- Create an explicit, auditable non-billed `workspace.mail` entitlement and active Mail workspace idempotently.
- Give this reserved tenant a private custom capacity profile with no commercial plan quota. Do not add that profile to public pricing, checkout, plan selection, or customer entitlement paths.
- Preserve domain verification, suppression, recipient validation, per-send recipient safety ceiling, domain warmup, configured platform daily send cap, and provider protections. The profile grants no right to bypass these controls.
- Allow the operator to continue through the normal Mail setup UI to add the `mkety.com` domain and `info@mkety.com` mailbox. Sending remains blocked until required DNS and sending checks pass.

## Non-goals

- No customer plan, checkout, subscription, invoice, payment, settlement, credit, or ledger records.
- No entitlement changes for any other tenant, no general free trial, and no default customer entitlement bypass.
- No automatic DNS, provider, or external-client enablement; `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` remains unchanged.
- No direct production-table edits or changes to the public Mail plan catalog.

## Proposed design

Add a clearly labelled **Provision internal Mail** action to Mail Ops. Its server action must first require Platform Control access and `platform:plans`. It then resolves the target exclusively from server configuration, verifies that the configured tenant exists and has the exact reserved slug `mkety-ops`, and refuses missing or mismatched configuration. The submitted form must not choose a tenant or profile.

In one database transaction, the action creates the tenant-scoped `workspace.mail` grant using the existing entitlement override mechanism, with a specific internal source/reason and actor, then creates the active workspace with an internal custom profile marker. Both writes are idempotent. The grant and workspace must not be partially applied. An existing tenant deny must remain authoritative; the action must fail closed and report it rather than silently overriding it. Emit an audit event for successful creation and a safe operator-visible error on failure.

Represent the internal custom profile separately from the three public plan keys. It is selected only by a server-side predicate that matches the configured tenant ID and reserved slug. It is not a public plan, and must never be silently normalized to Mail Starter. For this tenant only, commercial plan ceilings (including monthly outbound and Customer Update quotas) do not apply. Existing technical safety checks remain enforced: current domain verification and suppression rules, at most 3,000 recipients per Customer Update, the configured platform daily send cap, new-domain warmup, queue/provider limits, and fail-closed readiness checks. This is an internal capacity profile, not a promise of unlimited provider throughput or infrastructure.

The regular Mail setup flow remains responsible for creating the domain and mailbox. The operator can then configure `mkety.com` and create `info@mkety.com`; issuance of its first-party SMTP credential continues to require the active workspace, entitlement, active mailbox, and fully verified/enabled domain.

## Security and failure behavior

- Missing secret, wrong slug, unauthorized actor, absent permission, database failure, or existing tenant deny: no workspace is created; no payment state is written.
- Repeated provisioning: return the existing workspace without duplicate grants or audit noise for a no-op.
- Any other tenant: continue through ordinary paid/customer entitlement checks.
- The custom profile cannot be selected from a request payload, public form, or customer API.
- No secret or generated credential is logged or included in audit metadata.

## Acceptance criteria

1. An authorized operator can provision the configured `/mkety-ops` tenant without checkout; workspace and explicit grant are created together and an audit event identifies the actor and tenant.
2. Repeating the action is safe and idempotent.
3. Missing/mismatched tenant configuration, unauthorized actors, and a tenant-level deny fail closed without partial state.
4. A different tenant remains subject to its existing entitlement/payment path.
5. The reserved tenant resolves to the internal custom profile and is not exposed as a public plan or normalized to Starter.
6. The reserved tenant is not blocked by monthly outbound or Customer Update plan quotas; other tenants remain subject to their plan quotas.
7. Daily platform cap, new-domain warmup, 3,000-recipient per-send ceiling, domain verification, suppression, queue/provider controls, and SMTP credential readiness checks still block unsafe sends.
8. A newly provisioned workspace does not implicitly create a domain/mailbox, enable sending, change DNS, or enable external mail clients.

## Review decision

This draft incorporates the requested custom internal profile and interprets “unlimited” as no commercial plan quotas for the reserved tenant, while retaining operational safety controls and keeping the profile private. Review this spec before implementation; after approval, the implementation plan will enumerate the exact code paths, tests, migration needs, and deployment gates.
