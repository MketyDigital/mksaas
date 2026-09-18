# Mkety Cloudflare Deploy Candidate Adapter Plan

**Date:** 2026-09-18  
**Spec:** `docs/superpowers/specs/2026-09-18-mkety-cloudflare-deploy-candidate-adapter-design.md`

- [x] Confirm provider-neutral execution kernel is merged.
- [x] Verify current Cloudflare Workers Script and workers.dev API contracts.
- [x] Add isolated Cloudflare candidate artifact and adapter boundary.
- [x] Enforce candidate-only Worker naming.
- [x] Enforce module-count/source-size/module-name limits.
- [x] Add real Cloudflare API transport for module upload.
- [x] Enable workers.dev explicitly with Preview URLs disabled.
- [x] Add account workers.dev URL resolution.
- [x] Add exact Worker cleanup.
- [x] Add adapter/transport regression tests.
- [x] Add same-repository external verification workflow.
- [x] Add double cleanup: script finally + workflow always().
- [ ] Pass full repository gates.
- [ ] Pass real isolated Cloudflare candidate deployment/smoke/cleanup.
- [ ] Record immutable verification evidence.
- [ ] Merge only after exact-head green verification.

Explicitly excluded: customer-facing deploy UI/action, arbitrary repository/source fetching, bindings/secrets, DNS, custom domains, `*.mkety.app`, production execution and rollback execution.
