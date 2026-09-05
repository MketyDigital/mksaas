# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Pre-flight

| Check | Finding | Ruling |
| --- | --- | --- |
| Scope | Plan covers public site, global docs, platform content CMS, admin editing, seeding, and verification. | Ruling: Execute in thin vertical slices rather than attempting one giant frontend rewrite — this preserves usage limit and reduces merge risk — cost if wrong: later tasks may need small interface adjustments. |
| Admin edit boundary | Admin editing applies to public website/docs content, navigation, pricing, CTAs, FAQ, metadata, docs, and site settings, not source code or backend business logic. | Ruling: Keep CMS content-only and schema-validated — this protects platform safety — cost if wrong: a future request for logic editing would require a separate safe extension. |
| Execution mode | No native subagent/worktree tool is available in this ChatGPT/GitHub connector context. | Ruling: Use the existing isolated branch `spec/mkety-public-site-cms` and commit progressively to it — cost if wrong: less local verification than a full cloned worktree, so PR verification must be treated as required before merge. |
| Usage limit | User asked not to burn too much limit. | Ruling: Start with Task 1 foundation only, avoid broad review-agent fanout, and report actual progress — cost if wrong: slower overall delivery but safer token usage. |
| Migration naming | Existing migrations naming/history were not fully inspected in this low-token batch. | Ruling: Add the platform-content SQL migration as an initial draft migration file, but mark migration verification required before merge — cost if wrong: filename/order may need adjustment to match Drizzle journal conventions. |

## Progress

Task 1: partial — added `src/shared/db/schema/platform-content.ts` and `src/shared/db/schema/platform-content.test.ts` for public site/docs/pricing/navigation/revisions schema foundation.
Task 1: partial — exported platform content schema from `src/shared/db/schema/index.ts`.
Task 1: partial — added creator/updater/actor relations for auditable platform content entities.
Task 1: partial — added `migrations/0000_platform_content.sql` for the platform content tables and indexes, then corrected the manual migration to use PostgreSQL-safe idempotent enum/constraint blocks.
Task 1: partial — considered nested navigation relation but simplified it back to direct parent id only until runtime code needs a relation; this avoids risky self-referential Drizzle typing without local type-check.
Task 1: partial — added unique environment constraint and status index for singleton-like platform site settings.
Task 1: low-token pause — schema foundation is staged on branch; verification pending because GitHub connector cannot run `pnpm test`, `pnpm type-check`, or `pnpm build` locally in this session.
