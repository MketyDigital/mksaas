# Mkety Platform Core Workspaces Readiness Checklist

Before this branch can leave draft:

- `pnpm test` passes.
- `pnpm type-check` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- Focused workspace smoke workflow passes.
- Project hub renders the Mkety workspace list.
- AI workspace preserves existing agent creation/listing.
- Automation, Deploy, SolutionHub, and Trading routes resolve with safe planned/enterprise copy.
- Trading route remains custom/enterprise only with no trading execution data model.

Before production launch:

- Deployed staging environment manually verifies `/t/[tenant]/projects/[project]` and all workspace routes.
- Auth/membership checks are verified with admin, manager, member, and non-member accounts.
- Main app navigation is reviewed after workspace routes are stable.
