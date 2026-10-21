# Mkety Repository Current Truth Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace stale or unreadable front-door guidance with a code-checked current map while preserving historical evidence.

**Architecture:** Keep one short current status/index, mark dated handoffs and cutover artifacts as historical snapshots, and add a current authority block after the protected AGENTS.md section. Do not rewrite protected history.

**Tech Stack:** Markdown, GitHub links, repository tree/source inspection.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`

## Global Constraints

- The public `mkety.com` cutover is completed history. Routine edits must not invoke `CUTOVER MKETY PUBLIC`.
- The current `main` SHA is a repository code fact, not proof that the same SHA is deployed to production.
- Workspace capabilities are part of the Mkety Platform product; independently deployed customer apps retain their own runtime and data boundaries.
- Dated handoffs and plans remain historical snapshots unless a correction is explicitly documented.
- Preserve the protected AGENTS.md text and its existing end marker.

## Review Focus

- Invalid UTF-8 in the current status file — replace with valid UTF-8 Markdown and verify decoding.
- Protected AGENTS.md block — add the current authority section only after the protected end marker.
- Historical cutover wording — verify current docs do not instruct routine releases to rerun the initial cutover.
- Stale starter-template routes and features — derive the structure map from the current tree.
- Broken/obsolete document links — verify all links in the current index point to existing paths.

---

### Task 1: Replace the unreadable current status snapshot

**Files:**
- Modify: `docs/CURRENT_WORKSTREAM_STATUS.md`

**Interfaces:**
- Produces: concise UTF-8 repository status snapshot, dated and explicit about which claims are code facts versus runtime evidence.

- [ ] **Step 1: Write the status snapshot** with current repo SHA/date, public cutover marked completed, current product/workspace map, candidate versus production evidence, and an explicit “verify runtime before claiming deployed” rule.
- [ ] **Step 2: Validate UTF-8 and required facts** with a script that decodes the file and asserts the cutover and current release boundary text.
- [ ] **Step 3: Review every status claim** against source paths or linked workflow runs; remove unsupported live-state claims.

### Task 2: Restore the documentation entry point and current agent authority

**Files:**
- Modify: `docs/README.md`
- Modify: `AGENTS.md` (append after protected end marker only)

**Interfaces:**
- Consumes: Task 1 current status snapshot.
- Produces: one document precedence/index map for contributors and agents.

- [ ] **Step 1: Rewrite the docs index** to point to the new current status, current architecture, routine release guide, and product boundaries; identify dated handoffs/specs as historical.
- [ ] **Step 2: Append a current AGENTS.md override** after the protected marker with the repo’s current authority, completed cutover rule, Platform/workspace/standalone boundaries, and links to current documents.
- [ ] **Step 3: Check index links and the protected block** with a path-existence script and exact marker assertions.

### Task 3: Replace the starter-template structure guide and quarantine first-cutover instructions

**Files:**
- Modify: `docs/PROJECT_STRUCTURE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/MKETY_PUBLIC_CUTOVER_RUNBOOK.md`

**Interfaces:**
- Consumes: current status and authority index.
- Produces: code-checked structure overview and distinct release/cutover references.

- [ ] **Step 1: Replace the template map** with current `src/app`, `src/features`, `src/shared`, `workers`, and `customer-apps` paths and clarify workspace versus standalone boundaries.
- [ ] **Step 2: Mark the cutover runbook historical and one-time** at its top; link normal code releases to the routine release guide and reserve cutover for real routing/ownership changes.
- [ ] **Step 3: Run doc checks** for stale template terms, Sept-only/current-authority references, duplicate “latest” labels, broken links, and any instruction that sends small edits through `CUTOVER MKETY PUBLIC`.

### Task 4: Verify contributor entry points

**Files:**
- Verify: `README.md`, `docs/README.md`, `AGENTS.md`, current status and deployment guides.

- [ ] **Step 1: Trace the first-read path** from README to current authority and routine release guide.
- [ ] **Step 2: Run repository text checks** for stale cutover, template route, and “latest handoff” claims.
- [ ] **Step 3: Confirm historical evidence is linked and not deleted.**
