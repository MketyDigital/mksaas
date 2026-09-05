# Mkety CMS Audit Events

## Status
Implemented foundation in `spec/mkety-public-site-cms`.

This document records how Mkety public CMS and app-experience admin actions are audited.

## Why this exists
Mkety admin-editable content affects customer-facing surfaces such as:

- `mkety.com` public website content
- `/docs` public documentation
- public pricing presentation
- public navigation
- `app.mkety.com` dashboard/workspace presentation
- Platform Control Center module presentation

Those changes are safer than backend logic changes, but they still affect customers and must be traceable.

## Audit flow

```text
Admin action
  ↓
Server-side permission check
  ↓
Payload validation
  ↓
Database mutation
  ↓
Revision snapshot
  ↓
Audit event attempt
  ↓
Route revalidation
```

## Revision tables
Content-level snapshots are recorded in:

```text
platform_content_revisions
platform_app_experience_revisions
```

These revision tables store before/after snapshots for draft saves and publish actions.

## System audit table
High-level admin actions are also written to:

```text
audit_events
```

Current action keys:

```text
platform_content.draft_saved
platform_content.published
```

## Actor handling
The existing `audit_events.actor_id` column references `persons.id`, while the current admin action boundary receives the authenticated user id from the auth/session layer.

To avoid unsafe assumptions, CMS audit events currently store:

```text
actor_id: null
metadata.actorUserId: <auth user id>
metadata.actorEmail: <auth email>
```

This is intentional until the user/person identity relationship is verified and normalized.

## Failure behavior
The CMS mutation itself records revision rows transactionally. The high-level audit event is attempted after the mutation.

If the high-level audit insert fails, the server action returns:

```text
auditRecorded: false
```

The admin UI displays this status so operators know that the content changed but the high-level audit event was not recorded.

## Protected boundaries
CMS audit does not authorize admins to directly change:

- billing ledger calculations
- payment provider state
- entitlement enforcement logic
- deployment engines
- Auth Gateway signing keys
- JWKS private keys
- tenant isolation rules
- security policy code

Those remain code-controlled and require separate implementation review.

## Future hardening
Before production rollout, verify:

- the exact auth user to person mapping
- whether audit event failure should block CMS publish in production
- whether request id, IP address, and user agent should be captured in server actions
- whether CMS audit events need a dedicated event viewer inside Platform Control Center
- retention and export requirements for compliance
