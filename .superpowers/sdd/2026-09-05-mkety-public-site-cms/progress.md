# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Pre-flight

| Check | Finding | Ruling |
| --- | --- | --- |
| Scope | Plan covers public site, global docs, platform content CMS, admin editing, seeding, and verification. | Ruling: Execute in thin vertical slices rather than attempting one giant frontend rewrite — this preserves usage limit and reduces merge risk — cost if wrong: later tasks may need small interface adjustments. |
| Admin edit boundary | Admin editing applies to public website/docs content, navigation, pricing, CTAs, FAQ, metadata, docs, and site settings, not source code or backend business logic. | Ruling: Keep CMS content-only and schema-validated — this protects platform safety — cost if wrong: a future request for logic editing would require a separate safe extension. |
| Execution mode | No native subagent/worktree tool is available in this ChatGPT/GitHub connector context. | Ruling: Use the existing isolated branch `spec/mkety-public-site-cms` and commit progressively to it — cost if wrong: less local verification than a full cloned worktree, so PR verification must be treated as required before merge. |
| Usage limit | User asked not to burn too much limit. | Ruling: Start with Task 1 foundation only, avoid broad review-agent fanout, and report actual progress — cost if wrong: slower overall delivery but safer token usage. |

## Progress

