# Mkety Platform Control Admin Bootstrap

## Purpose

Mkety Platform Control/CMS is an internal operator surface for global Mkety public content, app-experience configuration, Enterprise payment administration, and other protected platform-control modules.

It is not customer workspace administration.

## Production boundary

Set the server-side environment variable:

`MKETY_PLATFORM_CONTROL_TENANT_SLUG=<dedicated-internal-workspace-slug>`

Example:

`MKETY_PLATFORM_CONTROL_TENANT_SLUG=mkety-ops`

Platform Control fails closed when this value is absent or when the current tenant slug does not match it. It also requires the signed-in email to be present in `MKETY_PLATFORM_ADMIN_EMAILS`.

A normal customer workspace administrator must never gain global Mkety CMS access merely because they own or administer their own workspace.

## First operator account

There is no hidden Mkety super-admin username/password and no authentication bypass.

Bootstrap the first operator through the normal production identity flow:

1. Configure `MKETY_PLATFORM_CONTROL_TENANT_SLUG` to the dedicated internal workspace slug you intend to use.
2. Configure `MKETY_PLATFORM_ADMIN_EMAILS` with the exact approved operator email(s).
3. Open Mkety signup and create/sign in with one of those operator identities through Mkety Auth.
4. Create the first workspace using the exact configured slug.
5. First-workspace creation makes the creator the tenant `admin`.
6. Open `/t/<configured-slug>/admin/platform-control`.
7. Use the dedicated operator workspace for Mkety staff/operator administration only.

The built-in tenant admin role is sufficient for the first bootstrap because current tenant authorization treats that role as full tenant authority. The separate platform-control tenant check prevents that wildcard tenant authority from becoming global CMS authority in ordinary customer workspaces.

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

Registration occurs before payment because Billing records, subscriptions and entitlement decisions are scoped to an authenticated Mkety tenant/workspace.

A browser success/return URL is never proof of payment and never grants access.

## Enterprise flow

Enterprise and Trading Custom/Enterprise sales stay outside fixed-price self-service checkout.

The operator scopes the engagement and issues the negotiated payment flow from the protected Platform Control/Enterprise payment administration surface.

## Current Starter implementation note

Starter is commercially positioned as the Pages-first website/publishing plan, but the current Billing catalog has no Starter-specific entitlement key. Before the Pages product is treated as fully enforceable in the authenticated app, app development must add the corresponding Starter product-access/limit implementation instead of relying on payment state alone.
