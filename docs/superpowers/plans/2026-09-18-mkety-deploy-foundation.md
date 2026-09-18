# Mkety Deploy Foundation Implementation Plan

**Date:** 2026-09-18  
**Spec:** `docs/superpowers/specs/2026-09-18-mkety-deploy-foundation-design.md`

- [x] Confirm Deploy is the next architecture slice after Wallet.
- [x] Preserve existing project/tenant access boundary.
- [x] Add tenant/project-scoped Deploy application schema.
- [x] Add tenant/project/application-scoped environment schema.
- [x] Add read-only deployment-history schema.
- [x] Add migration `0014_deploy_foundation.sql`, journal entry, and derived Drizzle snapshot.
- [x] Add manager-only application/environment metadata actions.
- [x] Add tenant/project-scoped Deploy reads.
- [x] Add Deploy Workspace record surface.
- [x] Keep production environments protected.
- [x] Add regression tests for schema, scoping, manager boundary, and no provider execution.
- [ ] Run migration baseline / Drizzle consistency.
- [ ] Run full tests, type-check, lint, build, Vinext smoke, PR validation, MegaLinter.
- [ ] Record exact immutable verification evidence.
- [ ] Merge only after exact-head gates are green.

Explicitly excluded: provider APIs, credentials, deployment triggers, DNS/custom domains, public URLs, production infrastructure mutation, rollback execution, and SolutionHub provisioning.
