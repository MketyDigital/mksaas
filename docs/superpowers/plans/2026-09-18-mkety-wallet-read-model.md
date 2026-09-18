# Mkety Wallet Read Model Implementation Plan

**Date:** 2026-09-18  
**Spec:** `docs/superpowers/specs/2026-09-18-mkety-wallet-read-model-design.md`

- [x] Confirm Billing is the sole financial ledger and Usage/Credits remains separate.
- [x] Define a tenant-scoped Wallet read contract.
- [x] Add unit tests proving commercial state and product credits remain separate.
- [x] Add Cloudflare-backed Wallet read source using existing Billing and Usage/Credits tables/services.
- [x] Add authenticated tenant Wallet page.
- [x] Add Wallet to My-view tenant navigation.
- [ ] Run full repository verification gates.
- [ ] Record exact run/SHA evidence in current handoff.
- [ ] Merge only after exact-head gates are green.

No migration, payment mutation, withdrawal, transfer, FX, purchased-credit packs, or wallet funding endpoint belongs in this plan.
