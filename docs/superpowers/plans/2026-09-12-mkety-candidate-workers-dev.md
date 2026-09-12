# Mkety Candidate Workers.dev Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the isolated Mkety public candidate explicitly deploy to the existing account Workers.dev namespace without changing the account subdomain, production routes, DNS, or `mkety.com`.

**Architecture:** Keep the account-level Workers.dev namespace unchanged. During the candidate-only workflow rewrite, set `workers_dev: true`, retain `preview_urls: true`, strip custom-domain route bindings, and assert those invariants before deployment.

**Tech Stack:** GitHub Actions, Node.js, Wrangler/Cloudflare Workers.

**Spec:** Existing Mkety public release workflow contract in `.github/workflows/mkety-public-candidate-deploy.yml`.

## Global Constraints

- Do not rename the existing Cloudflare account Workers.dev namespace.
- Do not configure or mutate `mkety.com` routes or DNS.
- Do not change production Worker behavior.
- Candidate Worker name remains `mkety-public-candidate`.
- Candidate deployment must use Workers.dev and have no custom-domain route binding.

---

### Task 1: Enable Workers.dev only for the isolated candidate

**Files:**
- Modify: `.github/workflows/mkety-public-candidate-deploy.yml`

**Interfaces:**
- Consumes: production `wrangler.jsonc` copied into the workflow workspace.
- Produces: rewritten candidate config with `name=mkety-public-candidate`, `workers_dev=true`, `preview_urls=true`, and no `route`/`routes` keys.

- [x] **Step 1: Update the candidate config rewrite**

Add `config.workers_dev = true` immediately after setting the candidate Worker name.

- [x] **Step 2: Strengthen the candidate config assertion**

Fail the workflow unless `config.workers_dev === true`, while retaining the existing checks for candidate name, no custom routes, and `preview_urls === true`.

- [x] **Step 3: Verify the branch diff**

Confirm the workflow and this plan are the only intentional changes from the current public-site base.

- [ ] **Step 4: Run release gates**

Use GitHub Actions on the exact candidate SHA. The candidate deploy must reach the isolated `*.workers.dev` URL and complete public route, Enterprise payment-boundary, and Public Mkety AI smokes.

- [ ] **Step 5: Promote only after evidence**

Do not move the production release ref or run production cutover until the exact candidate SHA has the required green evidence.
