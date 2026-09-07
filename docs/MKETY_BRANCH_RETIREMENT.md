# Mkety Branch Retirement Ledger

> **Purpose:** prevent stale branches from becoming accidental architecture or implementation sources.
>
> **Authority:** `AGENTS.md`, the active Auth PR #16, and the downstream Automation Webhooks PR #15 are the current development line until promotion completes.

## Operating rule

A historical branch is **not** a source of truth merely because it still exists on GitHub.

Use only:

1. `main` for the last promoted baseline;
2. `feat/mkety-auth-zitadel-vinext` for the current unpromoted Auth baseline;
3. `feat/mkety-automation-webhook-trigger` for the current downstream verified Platform baseline while Webhooks remains draft.

Never revive code from a retired or quarantined branch without comparing it against the active baseline and explicitly reconciling the architecture first.

## Keep active

| Branch | Status | Reason |
| --- | --- | --- |
| `main` | Keep | Last promoted baseline. |
| `feat/mkety-auth-zitadel-vinext` | Keep until Auth promotion | Provider-neutral Mkety Auth, migration `0009`, isolated Cloudflare preview contract. Still blocked only by external workers.dev/ZITADEL browser promotion gates. |
| `feat/mkety-automation-webhook-trigger` | Keep until Webhooks promotion | Downstream verified baseline containing Auth plus secure Automation Webhooks, migration `0010`, migration metadata repair, and deep legacy cleanup. |

## Safe to retire when remote-ref deletion is available

The following branches are already preserved by a merged PR, explicitly superseded by the active baseline, or proven to be strict ancestors of the active Webhooks branch.

### Proven strict ancestors of the active baseline

These branch tips are ancestors of `feat/mkety-automation-webhook-trigger` (`behind_by=0` and merge-base equals the branch tip):

- `chore/add-engines-field`
- `chore/consolidate-postgres-driver`
- `chore/update-nextjs-to-v16`

Their work is already contained in the active line and the refs add no unique implementation authority.

### Merged historical product/runtime branches

The work from these branches was promoted through historical merged PRs and is already represented in the active line:

- `mkety-phase-1-ai-core-foundation` — PR #2 merged; AI provider/model abstraction foundation.
- `spec/mkety-public-site-cms` — PR #5 merged; public site/CMS/control-center foundation.
- `feat/mkety-platform-core-workspaces` — PR #6 merged; Platform workspace shell.
- `feat/mkety-ai-workspace-foundation` — PR #7 merged.
- `feat/mkety-ai-agent-builder-polish` — PR #8 merged.
- `feat/mkety-automation-data-model-foundation` — PR #9 merged.
- `feat/mkety-automation-builder-shell` — PR #10 merged.
- `feat/mkety-automation-workflow-drafts` — PR #11 merged.
- `feat/mkety-automation-workflow-edit-drafts` — PR #12 merged.
- `feat/mkety-automation-node-prep` — PR #13 merged.
- `feat/mkety-automation-node-drafts` — PR #14 merged; Automation builder/execution foundation.
- `fix/cloudflare-deployment-baseline` — PR #18 merged; vinext/Cloudflare runtime baseline.

### Explicitly superseded / closed without merge

- `workspace-team-routing` — PR #1 closed without merge. Its useful `/team` concept is absorbed in Auth #16, but its stale-session routing implementation is intentionally superseded by DB-backed membership truth.
- `docs/reuse-managed-hosting-billing` — PR #3 closed without merge. Its valid billing decision is preserved in `docs/MKETY_BILLING_ARCHITECTURE.md`; do not merge the stale branch.
- `phase-0-auth-boundaries` — legacy pre-Mkety-Auth boundary work. Current Auth #16 owns the provider-neutral session/authorization architecture; this branch must not be used to restore older Auth assumptions.

## Quarantined for manual review before deletion

These refs are **not allowed as implementation sources**. They are retained only because their tips contain divergent commits or their original purpose has not yet been fully reconciled against the active baseline.

- `chore/platform-baseline-sequencing` — control-plane/history branch; diverged after sequencing work. The approved sequencing documents already exist in the active line, but its extra divergent commits should be inspected before ref deletion.
- `docs/mkety-continuation-audit` — divergent documentation-history branch; not an active source of truth.
- `feat/cloudflare-vinext-migration` — earlier runtime-transition branch. The authoritative runtime is the merged PR #18 vinext baseline; inspect any unique commits before deleting the ref.
- `feature/workspace-custom-domain` — historical domain work; current domain behavior must follow `docs/MKETY_DOMAIN_ARCHITECTURE.md` and active server authorization. Inspect unique commits before deletion.
- `tmp-ignore` — temporary branch with no product authority; inspect the tip before deletion only to ensure no accidental unique artifact needs preserving.

## Already removed from active code/config

The active downstream baseline has been cleansed of the major legacy sources of confusion:

- Auth.js/NextAuth application dependency and session ownership;
- obsolete `AUTH_SECRET` DevContainer generation;
- active `NEXTAUTH_*`/Auth0 application configuration;
- OpenNext runtime/config paths;
- duplicate `CLOUDFLARE_WORKER_NAME` configuration;
- starter-template README/brand/public metadata/footer copy;
- temporary diagnostic/integration workflows after verification.

The immutable cleanup verifier run `34083890226` passed on code SHA `c713d8b05af57b042c0ee52db9597d6a04f16f1c` with:

- cleanup invariants;
- migration baseline and `drizzle-kit check`;
- full tests;
- type-check;
- lint;
- `vinext check`;
- production build;
- isolated Cloudflare preview packaging dry-run.

Final cleanup head `90112c3d4f92eda4b7a90d8502dcf2b52b3f2fe4` differed from that verified code only by removal of the temporary cleanup audit workflow.

## Remote-ref deletion limitation

The GitHub integration available to the development agent can create/update refs but does not expose a safe remote branch-delete action. **Do not simulate deletion by force-moving stale branch refs.**

When a branch-delete capability is available, delete only branches listed under **Safe to retire**. Quarantined branches must first be reconciled or explicitly declared discardable.

## Next development sequence

After this cleanup ledger:

1. keep Auth #16 and Webhooks #15 draft until the external Auth preview promotion gate is satisfied;
2. continue new Platform work only from the clean downstream baseline, not from historical branches;
3. next major Platform domain: **Billing → Entitlements → Usage/Credits**;
4. preserve the verified external managed-hosting billing/provider contract from `MketyDigital/mklms`; do not duplicate legacy payment-provider routes inside Platform.
