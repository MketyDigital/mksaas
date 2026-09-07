---
title: First Login
description: How to sign in to Mkety, choose an organization, and get oriented on your first visit.
section: getting-started
order: 2
---

# First Login

Mkety owns the application authentication and session boundary. Your organization may use different identity-provider sign-in methods behind that boundary; ZITADEL is the initial provider adapter used by the Platform.

## Sign in

1. Open your Mkety Platform URL.
2. Select **Sign in**.
3. Complete the sign-in method offered by your organization's configured identity provider.
4. Complete MFA or other provider checks when required.
5. After the provider callback is verified, Mkety creates its own application session and redirects you back to the Platform.

Provider access tokens are not Mkety application sessions. Tenant access is resolved from current Mkety membership data after sign-in.

If the expected sign-in option is missing or your provider rejects the request, contact your Mkety administrator or your organization's IT team.

## Organization selection

If your current Mkety membership gives you access to more than one organization, the organization-selection screen lists those memberships after sign-in.

- Choose the organization you want to work in.
- If you have exactly one current membership, Mkety may route you directly into it.
- If you no longer belong to an organization, stale session role data does not grant access; current database membership is authoritative.

## First dashboard experience

After authentication and organization selection, the surfaces you can open depend on your current permissions and membership. You may see project workspaces, administration, profile/settings, AI/Automation capabilities, or other enabled Platform areas.

Some areas can be intentionally unavailable or enterprise-gated. Visibility in the interface does not bypass backend authorization.

## Useful first steps

1. Complete your profile and preferences.
2. Confirm you are working in the correct organization.
3. Explore the project workspace hub and the capabilities available to your role.
4. Use the documentation for the area you are configuring.
5. Sign out when using a shared device.

## Security and sessions

- **Mkety-owned session** — After successful provider authentication, Mkety issues its own opaque application session; only the hash is persisted server-side.
- **Current authorization** — Tenant roles and permissions are resolved from current Mkety membership/permission data rather than trusted from provider claims or stale session caches.
- **Password and MFA** — Credential recovery and MFA configuration are handled by the configured external identity provider or your organization's SSO administrator.
- **Sign out** — Signing out revokes the Mkety server-side session and clears the application session cookie. Provider-level logout behavior depends on the configured adapter.
- **Session expiry** — Expired or revoked Mkety sessions fail closed and require authentication again.

For the architectural source of truth, see `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md`.
