# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Pre-flight

| Check | Finding | Ruling |
| --- | --- | --- |
| Scope | Plan covers public site, global docs, platform content CMS, admin editing, seeding, and verification. | Ruling: Execute in thin vertical slices rather than attempting one giant frontend rewrite — this preserves usage limit and reduces merge risk — cost if wrong: later tasks may need small interface adjustments. |
| Admin edit boundary | Admin editing applies to public website/docs content, navigation, pricing, CTAs, FAQ, metadata, docs, and site settings, not source code or backend business logic. | Ruling: Keep CMS content-only and schema-validated — this protects platform safety — cost if wrong: a future request for logic editing would require a separate safe extension. |
| Execution mode | No native subagent/worktree tool is available in this ChatGPT/GitHub connector context. | Ruling: Use the existing isolated branch `spec/mkety-public-site-cms` and commit progressively to it — cost if wrong: less local verification than a full cloned worktree, so PR verification must be treated as required before merge. |
| Usage limit | User asked not to burn too much limit. | Ruling: Start with foundational slices only, avoid broad review-agent fanout, and report actual progress — cost if wrong: slower overall delivery but safer token usage. |
| Migration naming | Existing migrations naming/history were not fully inspected in this low-token batch. | Ruling: Add manual SQL migration drafts, but mark migration verification required before merge — cost if wrong: filenames/order may need adjustment to match Drizzle journal conventions. |
| Completion standard | Could not run local verification in the GitHub connector session. | Ruling: Do not mark implementation tasks complete; report them as implemented but unverified until CI/local commands run — cost if wrong: none beyond conservative status wording. |
| App experience scope | User confirmed app.mkety.com customer/workspace/dashboard presentation should also be admin-managed where sensible. | Ruling: Add a separate app-experience layer for dashboard presentation, workspace cards, and Platform Control Center modules; keep backend logic, raw security rules, ledger calculations, and deployment engines code-controlled — cost if wrong: later refactor to split/merge content models. |

## Progress

Task 1: partial — added `src/shared/db/schema/platform-content.ts` and `src/shared/db/schema/platform-content.test.ts` for public site/docs/pricing/navigation/revisions schema foundation.
Task 1: partial — exported platform content schema from `src/shared/db/schema/index.ts`.
Task 1: partial — added creator/updater/actor relations for auditable platform content entities.
Task 1: partial — added `migrations/0000_platform_content.sql` for the platform content tables and indexes, then corrected the manual migration to use PostgreSQL-safe idempotent enum/constraint blocks.
Task 1: partial — considered nested navigation relation but simplified it back to direct parent id only until runtime code needs a relation; this avoids risky self-referential Drizzle typing without local type-check.
Task 1: partial — added unique environment constraint and status index for singleton-like platform site settings.
Task 1: partial — added lightweight schema tests for enum lifecycle and table presence.
Task 1: partial — started actor foreign keys in manual migration with site settings created_by/updated_by references.
Task 1 addendum: partial — added `src/shared/db/schema/platform-app-experience.test.ts` before production schema code.
Task 1 addendum: partial — added `src/shared/db/schema/platform-app-experience.ts` for app dashboard settings, workspace cards, central Platform Control Center modules, and app experience revisions.
Task 1 addendum: partial — exported `platform-app-experience` from `src/shared/db/schema/index.ts`.
Task 1 addendum: partial — added `migrations/0001_platform_app_experience.sql` for app experience tables and indexes.
Task 2: partial — added `src/features/platform-content/schemas.test.ts` before production content schemas.
Task 2: partial — added `src/features/platform-content/schemas.ts` with safe href validation, site settings, navigation, hero, workspace, pricing, FAQ, footer, docs category, and docs article schemas.
Task 2: partial — added `src/features/platform-content/defaults.ts` with blueprint-aligned Mkety public defaults.
Task 2 addendum: partial — added `src/features/platform-app-experience/schemas.test.ts` before production app-experience content schemas.
Task 2 addendum: partial — added `src/features/platform-app-experience/schemas.ts` for dashboard settings, workspace cards, and control center modules.
Task 2 addendum: partial — added `src/features/platform-app-experience/defaults.ts` with dashboard, workspace cards, and Platform Control Center modules.
Task 2: verification pending — GitHub connector cannot execute `pnpm test`, `pnpm type-check`, or `pnpm build` locally in this session.

## Next resume point

Continue with loader/service functions that read published platform content and app experience records, validate with Zod, and fall back to the Mkety defaults. Before merge, run `pnpm test`, `pnpm type-check`, `pnpm lint`, and `pnpm build` in a real checkout or CI.
