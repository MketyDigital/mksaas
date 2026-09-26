# Mkety Platform Control Admin Bootstrap

## Purpose

Mkety Platform Control/CMS is the protected internal operator surface for global Mkety public content, app-experience configuration, payment business settings, Enterprise payment administration, deployments, and other platform-control modules.

It is not customer workspace administration.

## Production boundary

Set these server-side production values:

```text
MKETY_PLATFORM_CONTROL_TENANT_SLUG=mkety-ops
MKETY_PLATFORM_ADMIN_EMAILS=<comma-separated exact approved operator emails>
```

Platform Control fails closed when the configured tenant slug is absent or does not match the current workspace. It also requires the signed-in email to appear exactly in `MKETY_PLATFORM_ADMIN_EMAILS`.

A normal customer workspace administrator must never gain global Mkety control access merely because they administer their own workspace.

## Operator entry point

The preferred operator URL is:

```text
https://mkety.com/ops
```

The route resolves the configured `MKETY_PLATFORM_CONTROL_TENANT_SLUG` and redirects to:

```text
/t/<configured-slug>/admin/platform-control
```

The destination remains protected by normal Mkety authentication, tenant membership/permission checks, the dedicated Platform Control tenant boundary, and the approved operator email allow-list.

## First operator account

There is no hidden Mkety super-admin username/password and no authentication bypass.

Bootstrap the first operator through the normal production identity flow:

1. Set `MKETY_PLATFORM_CONTROL_TENANT_SLUG=mkety-ops`.
2. Add the exact approved operator email(s) to `MKETY_PLATFORM_ADMIN_EMAILS`.
3. Open Mkety signup and create/sign in with one of those operator identities through Mkety Auth.
4. Create the dedicated internal workspace with the exact slug `mkety-ops` if it does not already exist.
5. First-workspace creation makes the creator the tenant `admin`.
6. Open `https://mkety.com/ops`.
7. Use this workspace for Mkety staff/operator administration only.

The built-in tenant admin role is sufficient for the initial bootstrap because current tenant authorization treats that role as full tenant authority. The separate platform-control tenant and operator-email checks prevent that authority from becoming global control access in ordinary customer workspaces.

## Payment runtime configuration

Provider secrets are never stored in Platform Control. They remain server-side runtime/GitHub/Cloudflare secrets.

For the active NOWPayments + Flutterwave setup, MkSaaS production should have:

```text
NOWPAYMENTS_API_KEY=<secret>
NOWPAYMENTS_IPN_SECRET=<secret>

FLUTTERWAVE_PUBLIC_KEY=<public key>
FLUTTERWAVE_STANDARD_SECRET_KEY=<secret key>
FLUTTERWAVE_STANDARD_WEBHOOK_HASH=<Flutterwave dashboard webhook hash>
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<shared internal 32+ character secret>

MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL=https://media.mkety.com/api/billing/flutterwave/webhook
```

The Flutterwave dashboard webhook for the shared Standard/v3 integration is:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Mkety Media production should have:

```text
FLUTTERWAVE_CHECKOUT_BROKER_URL=https://mkety.com/api/payments/flutterwave/start
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<exact same shared internal secret as MkSaaS>
```

Media does not receive `FLUTTERWAVE_STANDARD_SECRET_KEY`.

Kora remains optional and hidden until both `KORA_PUBLIC_KEY` and `KORA_SECRET_KEY` are configured.

## Payment business settings

After runtime secrets are configured, open:

```text
https://mkety.com/ops
```

Then choose **Payments**.

Platform Control can safely manage database-backed business configuration such as Flutterwave collection FX rates and optional FX markup. It does not expose provider secrets or weaken server-side webhook/settlement verification.

## Additional operators

Add later operator identities to the dedicated internal workspace and assign only the role/permission level they require.

Platform Control modules retain their module-specific permission checks, including:

- `admin:dashboard`
- `platform:content`
- `platform:app-experience`
- `platform:plans`
- `platform:billing`
- `platform:deployments`
- `platform:security`

Do not grant these global operator capabilities through normal customer onboarding.

## Customer self-service flow

For Starter, AI Workspace, Automation Workspace, Deploy Workspace, and Mkety One, the intended flow is:

`Pricing -> choose plan -> signup/sign-in -> choose/create workspace -> checkout -> provider invoice -> verified settlement -> Billing -> Entitlements`

Registration occurs before payment because Billing records, subscriptions, and entitlement decisions are scoped to an authenticated Mkety tenant/workspace.

A browser success/return URL is never proof of payment and never grants access.

## Enterprise flow

Enterprise and Trading Custom/Enterprise sales stay outside fixed-price self-service checkout.

The operator scopes the engagement and issues the negotiated payment flow from the protected Platform Control/Enterprise payment administration surface.

## Current Starter implementation note

Starter is commercially positioned as the Pages-first website/publishing plan, but the current Billing catalog has no Starter-specific entitlement key. Before the Pages product is treated as fully enforceable in the authenticated app, app development must add the corresponding Starter product-access/limit implementation instead of relying on payment state alone.
