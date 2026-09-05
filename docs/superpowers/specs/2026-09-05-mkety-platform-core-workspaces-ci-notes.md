# Mkety Platform Core Workspaces CI Notes

Expected verification commands:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Focused workspace workflow:

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx
pnpm type-check
```

A failure in the focused workflow should be handled before expanding the branch into AI, Automation, Deploy, or SolutionHub internals.
