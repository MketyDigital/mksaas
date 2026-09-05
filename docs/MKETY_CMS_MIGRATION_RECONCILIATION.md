# Mkety CMS Migration Reconciliation

> Status: REQUIRED BEFORE MERGE
> Scope: public platform content and app-experience CMS tables

This branch includes manual migration drafts for the Mkety public CMS and app-experience foundation. Before the PR is moved out of draft, these migrations must be reconciled against the current Drizzle schema and the repository's migration conventions.

## Why this exists

The branch adds schema for:

- `platform_site_settings`
- `platform_pages`
- `platform_page_sections`
- `platform_navigation_items`
- `platform_pricing_plans`
- `platform_pricing_features`
- `platform_docs_categories`
- `platform_docs_articles`
- `platform_content_revisions`
- `platform_app_dashboard_settings`
- `platform_workspace_cards`
- `platform_app_control_center_modules`
- `platform_app_experience_revisions`

The current connector session cannot run `pnpm`, Drizzle generation, migrations, type-checking, or a database-backed smoke test. The branch must therefore keep this reconciliation note until local verification is performed.

## Current observation

No `migrations/meta/_journal.json` file was found in this branch through the GitHub connector search. That means migration reconciliation should not assume a Drizzle journal is already present or current.

## Required local verification

Run from a clean checkout of `spec/mkety-public-site-cms`:

```bash
pnpm install
pnpm type-check
pnpm test
pnpm lint
pnpm build
```

Then verify migrations according to the repository's actual Drizzle workflow. Common checks:

```bash
pnpm db:generate
pnpm db:migrate
```

Use the repository scripts in `package.json` as source of truth if script names differ.

## Schema checks

Confirm all manual SQL matches the TypeScript schema:

- schema namespace remains `saas_template` unless intentionally migrated
- auth/user foreign keys match the actual auth schema
- person/user actor mapping is handled safely
- nullable global app-experience tenant scope behaves correctly
- unique indexes do not break repeated draft/publish workflows
- `jsonb` defaults are accepted by the target PostgreSQL version
- enum names and values match Drizzle output
- timestamp columns match expected timezone mode

## Data checks

After applying migrations locally:

1. Run public content seeding.
2. Run app experience seeding.
3. Confirm seeding is idempotent.
4. Confirm public homepage renders from published DB content.
5. Confirm `/docs` renders from published DB content.
6. Confirm fallback rendering still works when no published records exist.
7. Confirm draft save creates/updates draft rows.
8. Confirm publish promotes draft rows to published.
9. Confirm revision records are created.
10. Confirm high-level audit events are recorded or fail safely according to the final policy.

## Safety boundary

Migration verification must not loosen the platform safety model.

Do not add admin-editable columns for:

- billing ledger calculation rules
- tenant isolation behavior
- deployment engine execution logic
- Auth Gateway private/signing keys
- raw security policy bypasses
- product authorization enforcement

CMS tables manage presentation content and approved operational metadata only.

## Exit criteria

This note can be downgraded from REQUIRED to VERIFIED only after local verification confirms:

- generated migrations match the intended schema
- tests pass
- type-check passes
- build passes
- seed/draft/publish smoke tests pass against a real database
