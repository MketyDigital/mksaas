# Mkety Migration Baseline

## Purpose

This document defines the active migration execution truth for Mkety Platform while the repository remains on Drizzle Kit 0.31.x legacy migration metadata.

The repository has **two independent SQL migration namespaces**. Their numeric prefixes are local to each namespace and must never be compared or merged into one sequence.

## 1. Application / Drizzle SQL namespace

Directory:

```text
src/shared/db/migrations/
```

Current execution order:

```text
0000_classy_santa_claus.sql
0001_silky_wolf_cub.sql
0002_custom_domains.sql
0003_mkety_projects_and_agents.sql
0004_agent_runs.sql
0005_agent_knowledge.sql
0006_agent_knowledge_assignments.sql
0007_agent_versions.sql
0008_workflows.sql
0009_mkety_auth.sql
```

Apply with:

```bash
pnpm db:check:migrations
pnpm db:migrate
```

`pnpm db:migrate` uses the SQL migration files and the database migration log to determine which migrations are unapplied. The active SQL filenames are therefore the execution-order source of truth.

`0009_mkety_auth.sql` is the settled Auth migration. Automation Webhooks must use the next valid application migration prefix when rebased onto this baseline: `0010` unless another migration is intentionally promoted first.

## 2. Mkety content bootstrap namespace

Directory:

```text
migrations/
```

Current execution order:

```text
0000_platform_content.sql
0001_platform_app_experience.sql
```

Apply with:

```bash
pnpm db:migrate:mkety-content
```

These files are intentionally outside Drizzle's configured `out` directory and are not applied by `pnpm db:migrate`.

## 3. Required controlled rollout order

For a clean database/environment:

```bash
pnpm db:check:migrations
pnpm db:migrate
pnpm db:migrate:mkety-content
pnpm db:seed:mkety-content
pnpm db:smoke:mkety-content
```

Do not use `db:push:unsafe` for shared, staging, or production databases.

## 4. Legacy Drizzle journal/snapshot status

The current legacy metadata is **not** the runtime migration-order authority:

- `src/shared/db/migrations/meta/_journal.json` currently records entries through `0007_agent_versions`.
- `0008_workflows.sql` and `0009_mkety_auth.sql` are active SQL migrations but are not represented in that legacy journal.
- the `meta/` directory contains historical snapshots only for the earliest generated migrations and does not provide a complete snapshot chain for the current SQL history.

This does **not** make `pnpm db:migrate` skip the active SQL files. It does mean schema-diff generation cannot safely assume the legacy metadata represents the complete current schema history.

Until the metadata format is deliberately rebuilt/upgraded, do not accept `pnpm db:generate` output blindly. Any generated migration must be reviewed against the full active SQL history and current schema before it is promoted.

Do not fabricate historical snapshot files merely to silence Drizzle metadata warnings.

## 5. CI invariant

Run:

```bash
pnpm db:check:migrations
```

The check fails when an active SQL namespace has:

- a migration without a four-digit numeric prefix;
- duplicate numeric prefixes;
- a gap in the active sequence;
- a legacy journal entry that points to an SQL migration that no longer exists.

The application and Mkety content namespaces are validated independently.

Durable CI workflow:

```text
.github/workflows/mkety-migration-baseline.yml
```

## 6. Branch integration rule

Before merging or rebasing a branch that adds a migration:

1. Rebase onto the current clean baseline.
2. Run `pnpm db:check:migrations`.
3. Assign the next free prefix in the correct namespace.
4. Never resolve a migration collision by keeping two files with the same prefix.
5. Never renumber a migration that has already been promoted to the settled baseline unless a deliberate migration-history repair is approved.

For the current sequence, Auth owns `0009`; the Automation Webhook migration must move from its branch-local `0009` to `0010` during rebase.
