# Mkety Public App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Mkety public page an app-style bottom dock, centered rectangular Mkety AI surface, and deduplicated navigation without changing backend/public-runtime behavior.

**Architecture:** Keep `MketyPublicShell` as the global composition point. Add a focused client dock component plus a pure navigation normalization helper, simplify the header, and restyle the existing assistant in place so its API/memory logic remains untouched.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, lucide-react, Jest, Testing Library, vinext/Cloudflare.

**Spec:** `docs/superpowers/specs/2026-09-12-mkety-public-app-shell-design.md`

## Global Constraints
- Primary dock items are exactly Home, Platform, Academy, SolutionHub, More.
- More contains Workspaces, Pricing, Enterprise, Docs, About, Contact.
- Preserve existing Public AI API, memory, privacy, payment and provider boundaries.
- Do not change production DNS or Cloudflare routing during implementation.
- Do not modify `MketyDigital/Trading`.

---

### Task 1: Navigation normalization and header cleanup

**Files:**
- Create: `src/features/platform-content/components/public/public-navigation.ts`
- Create: `src/features/platform-content/components/public/public-navigation.test.ts`
- Modify: `src/features/platform-content/components/public/MketyPublicHeader.tsx`

**Interfaces:**
- Produces: `dedupePublicNavigation(items: PlatformNavigationItemInput[]): PlatformNavigationItemInput[]`
- Header consumes the helper before rendering any CMS navigation.

- [ ] **Step 1: Write failing tests** covering duplicate hrefs (`/docs` and `/docs/`), duplicate labels, disabled items, stable first-item order, and external URL preservation.
- [ ] **Step 2: Run focused tests** and confirm they fail because the helper does not exist.
- [ ] **Step 3: Implement the pure helper** with canonical internal href comparison and stable first-item preservation.
- [ ] **Step 4: Simplify the header** to brand + small optional deduped desktop links + Sign In/Get Started, without duplicating the full dock IA.
- [ ] **Step 5: Run focused navigation/header tests** and confirm green.

### Task 2: Persistent public app dock

**Files:**
- Create: `src/features/platform-content/components/public/MketyPublicDock.tsx`
- Create: `src/features/platform-content/components/public/MketyPublicDock.test.tsx`
- Modify: `src/features/platform-content/components/public/MketyPublicShell.tsx`
- Modify: `src/features/platform-content/components/public/MketyPublicShell.test.tsx`

**Interfaces:**
- `MketyPublicDock()` reads the current pathname client-side.
- Primary routes: `/`, `/platform`, `/academy`, `/solutions`.
- More routes: `/workspaces`, `/pricing`, `/enterprise`, `/docs`, `/about`, `/contact`.

- [ ] **Step 1: Write failing dock tests** asserting the five primary labels, exact More contents, active state for direct routes, More active state for nested More destinations, and accessible navigation/menu controls.
- [ ] **Step 2: Run focused tests** and confirm RED.
- [ ] **Step 3: Implement `MketyPublicDock`** using lucide icons, `usePathname`, responsive five-column layout, violet/cyan active treatment, and accessible More popover state.
- [ ] **Step 4: Mount dock globally in `MketyPublicShell`** and add bottom padding/safe area so content is never obscured.
- [ ] **Step 5: Update shell test** to assert global dock + assistant composition.
- [ ] **Step 6: Run focused dock/shell tests** and confirm GREEN.

### Task 3: Centered rectangular Mkety AI surface

**Files:**
- Modify: `src/features/public-assistant/components/MketyPublicAssistant.tsx`
- Modify: `src/features/public-assistant/components/MketyPublicAssistant.test.tsx`

**Interfaces:**
- Preserve all existing fetch calls, payloads, conversation state, history actions and privacy copy.
- Only presentation/open-state interaction changes.

- [ ] **Step 1: Extend existing assistant tests** to assert the closed command surface is centered/app-like and the open dialog uses the new centered panel semantics while existing send/history/new-chat behavior remains covered.
- [ ] **Step 2: Run focused assistant test** and confirm RED against the old bottom-right widget.
- [ ] **Step 3: Restyle the closed state** as a centered rectangular command bar above the dock.
- [ ] **Step 4: Restyle the open state** as a centered 620-760px desktop panel / near-full-width mobile panel expanding upward above the dock.
- [ ] **Step 5: Run assistant tests** and confirm GREEN.

### Task 4: Cross-shell regression verification

**Files:**
- Modify only if a regression requires a minimal correction in files already listed above.

- [ ] **Step 1: Run focused public tests** for navigation, dock, shell, header, and assistant.
- [ ] **Step 2: Run full `pnpm test`.**
- [ ] **Step 3: Run `pnpm type-check`.**
- [ ] **Step 4: Run `pnpm lint`.**
- [ ] **Step 5: Run `pnpm build`.**
- [ ] **Step 6: Run `pnpx vinext check` and Cloudflare package dry-run.**
- [ ] **Step 7: Inspect exact diff against release base** and verify only public-shell UX/docs/tests changed.

### Task 5: Release promotion

**Files:**
- No product-code changes unless verification exposes a defect.

- [ ] **Step 1: Open/refresh PR against `main`** with exact verification evidence.
- [ ] **Step 2: Require green PR CI on the exact head SHA.**
- [ ] **Step 3: Merge with expected-head-SHA guard.**
- [ ] **Step 4: Fast-forward `feat/mkety-public-site-production` to the resulting main SHA.**
- [ ] **Step 5: Re-run Content DB Smoke, Public AI Runtime Diagnostic, Production Routing Preflight, and Public Candidate Deploy on that exact release SHA before production cutover.**
