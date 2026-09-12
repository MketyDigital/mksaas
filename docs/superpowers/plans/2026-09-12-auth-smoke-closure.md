# Mkety Auth Smoke Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real hosted ZITADEL login → Mkety callback/session → tenant authorization → logout smoke pass on the exact Auth branch SHA without reopening already-green Cloudflare, database, session, or preview-provisioning foundations.

**Architecture:** Keep `.github/workflows/mkety-cloudflare-preview.yml` as the parent promotion gate and harden only the reusable authenticated browser workflow. The browser test will model ZITADEL v2 hosted-login states explicitly, fail fast with phase-specific diagnostics, preserve real browser authentication and cleanup, and upload non-secret Playwright evidence on failure.

**Tech Stack:** GitHub Actions, Playwright 1.55, Chromium, ZITADEL hosted login v2, Cloudflare Workers preview, Next.js/vinext, PostgreSQL cleanup via `postgres`.

**Spec:** `docs/superpowers/specs/2026-09-12-auth-smoke-public-site-release-design.md`

## Global Constraints

- Repository: `MketyDigital/mksaas` only.
- Branch: `feat/mkety-auth-zitadel-vinext`.
- Do not modify `MketyDigital/Trading`.
- Do not redesign Auth, Cloudflare preview deployment, ZITADEL application provisioning, database/session bindings, or PKCE flow unless new failing evidence directly implicates them.
- Preserve the real hosted browser login. Do not replace it with API/token-assisted authentication.
- Keep ephemeral ZITADEL user and Mkety record cleanup in `if: always()` paths.
- Secrets and generated passwords must remain masked.
- Auth promotion closes only when the parent `Mkety Cloudflare Preview` workflow passes with the authenticated smoke green on the exact branch SHA.

---

## File Structure

- Modify `.github/workflows/mkety-authenticated-preview-smoke.yml` — owns ephemeral smoke identity setup, hosted-login Playwright test, diagnostics, cleanup, and artifact upload.
- Do not modify `.github/workflows/mkety-cloudflare-preview.yml` unless the reusable-workflow invocation itself is proven defective. Its successful verify/deploy/redirect gates are evidence that it should remain unchanged.

### Task 1: Make hosted-login state handling deterministic

**Files:**
- Modify: `.github/workflows/mkety-authenticated-preview-smoke.yml`

**Interfaces:**
- Consumes: `PREVIEW_URL`, `ZITADEL_ISSUER`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_WORKSPACE_SLUG` from the existing workflow.
- Produces: one Playwright smoke that reaches the Mkety preview origin only after explicitly completing identifier, password, optional authorization, callback, session, tenant, and logout phases.

- [ ] **Step 1: Preserve the current failure as the acceptance test**

Use GitHub Actions run `34707654800`, job `103590999431`, as the failing baseline. The observed failure is the browser remaining at a ZITADEL v2 password URL until timeout:

```text
https://<issuer>/ui/v2/login/password?loginName=<smoke-email>&organization=<id>&requestId=<id>
```

Acceptance condition: the new smoke must not rely on the old generic loop/fixed `400ms` sleeps to traverse this state.

- [ ] **Step 2: Replace the generic hosted-login loop with explicit phase helpers**

Inside the generated `mkety-auth-smoke.spec.ts`, introduce these helpers with the exact responsibilities below:

```ts
async function visible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function submitVisible(page: Page, names: RegExp[]) {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first();
    if (await visible(button)) {
      await button.click();
      return;
    }
  }
  const submit = page.locator('button[type="submit"], input[type="submit"]').first();
  if (await visible(submit)) {
    await submit.click();
    return;
  }
  throw new Error(`No visible submit control at ${page.url()}`);
}

async function completeHostedLogin(page: Page) {
  const deadline = Date.now() + 60_000;
  let lastState = '';

  while (Date.now() < deadline) {
    const url = new URL(page.url());
    if (url.origin === new URL(previewUrl).origin) return;
    if (url.origin !== issuer) {
      throw new Error(`Unexpected hosted-login origin: ${url.origin}`);
    }

    const password = page.locator(
      'input[type="password"], input[name="password"], input[autocomplete="current-password"]',
    ).first();
    if (await visible(password)) {
      lastState = 'password';
      await password.fill(process.env.SMOKE_PASSWORD!);
      await Promise.allSettled([
        page.waitForURL((next) => next.href !== url.href, { timeout: 10_000 }),
        submitVisible(page, [/continue/i, /next/i, /sign in/i, /login/i]),
      ]);
      continue;
    }

    const login = page.locator(
      'input[name="loginName"], input[name="username"], input[type="email"], input[autocomplete="username"]',
    ).first();
    if (await visible(login)) {
      lastState = 'identifier';
      await login.fill(process.env.SMOKE_EMAIL!);
      await Promise.allSettled([
        page.waitForURL((next) => next.href !== url.href, { timeout: 10_000 }),
        submitVisible(page, [/continue/i, /next/i, /sign in/i, /login/i]),
      ]);
      continue;
    }

    const authorize = page.getByRole('button', { name: /authorize|allow|continue/i }).first();
    if (await visible(authorize)) {
      lastState = 'authorization';
      await authorize.click();
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      continue;
    }

    lastState = 'unknown';
    await page.waitForTimeout(500);
  }

  throw new Error(`Hosted login did not return to Mkety preview; last state=${lastState}; url=${page.url()}`);
}
```

The implementation may adjust selectors to match the live ZITADEL DOM discovered by diagnostics, but it must retain explicit identifier/password/authorization phase separation, issuer-origin enforcement, and a bounded hosted-login deadline.

- [ ] **Step 3: Use the explicit hosted-login helper in the smoke**

Replace the current eight-iteration generic loop with:

```ts
await page.goto(`${previewUrl}/api/auth/login?returnTo=/create-workspace`, {
  waitUntil: 'domcontentloaded',
});
await expect.poll(() => new URL(page.url()).origin, { timeout: 20_000 }).toBe(issuer);
await completeHostedLogin(page);
await page.waitForURL((url) => url.origin === new URL(previewUrl).origin, { timeout: 20_000 });
```

Leave the existing Mkety session, workspace creation, protected tenant response, logout, and null-session assertions intact unless a failing run proves a separate defect.

- [ ] **Step 4: Validate YAML and embedded TypeScript structure locally/staticly**

Run the repository's existing static gates that do not require secrets:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm type-check
pnpm lint
```

Expected: all existing static gates pass. If the workflow embeds TypeScript that is not covered by repository type-check, inspect the generated script block for valid Playwright imports/types and shell heredoc termination.

- [ ] **Step 5: Commit the deterministic hosted-login change**

```bash
git add .github/workflows/mkety-authenticated-preview-smoke.yml
git commit -m "fix: harden authenticated preview login smoke"
```

### Task 2: Add phase-specific failure diagnostics without leaking secrets

**Files:**
- Modify: `.github/workflows/mkety-authenticated-preview-smoke.yml`

**Interfaces:**
- Consumes: Playwright failure state from Task 1.
- Produces: `test-results/` and optional `playwright-report/` artifacts sufficient to identify identifier/password/authorization/callback/session/tenant/logout failures.

- [ ] **Step 1: Configure Playwright evidence for the single smoke test**

Run the test with trace and screenshot retention on failure:

```bash
pnpm exec playwright test mkety-auth-smoke.spec.ts \
  --browser=chromium \
  --reporter=line \
  --workers=1 \
  --trace=retain-on-failure \
  --screenshot=only-on-failure
```

If the installed Playwright CLI rejects either flag, move the equivalent settings into a generated `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
```

Remove any generated config after the run in the same cleanup block as the generated spec.

- [ ] **Step 2: Surface safe page diagnostics when hosted login stalls**

Before throwing for an unknown/stalled hosted-login state, collect only non-secret UI structure:

```ts
const diagnostic = await page.evaluate(() => ({
  title: document.title,
  inputs: Array.from(document.querySelectorAll('input')).map((input) => ({
    type: input.type,
    name: input.name,
    autocomplete: input.autocomplete,
    ariaLabel: input.getAttribute('aria-label'),
  })),
  buttons: Array.from(document.querySelectorAll('button')).map((button) =>
    (button.textContent || '').trim().slice(0, 120),
  ),
}));
console.error(JSON.stringify({ url: page.url(), ...diagnostic }, null, 2));
```

Do not print input values, cookies, authorization codes, session tokens, management tokens, or generated passwords.

- [ ] **Step 3: Upload Playwright evidence only when useful**

Add an artifact step after the browser test and before cleanup completion, guarded by `if: failure()` or `if: always()` with `if-no-files-found: ignore`, using `actions/upload-artifact@v4` and a name containing `${{ github.run_id }}-${{ github.run_attempt }}`.

Paths:

```text
test-results/**
playwright-report/**
```

Retention should be short (for example 3 days) because these are smoke diagnostics.

- [ ] **Step 4: Preserve cleanup guarantees**

Confirm these existing steps remain `if: always()` and run regardless of test result:

```text
Clean up Mkety smoke records
Delete ephemeral ZITADEL smoke identity
```

Expected: no change to their SQL/API behavior unless a failing cleanup step is observed.

- [ ] **Step 5: Commit diagnostics**

```bash
git add .github/workflows/mkety-authenticated-preview-smoke.yml
git commit -m "ci: retain auth smoke failure diagnostics"
```

### Task 3: Re-run the parent preview gate and close Auth only on exact green evidence

**Files:**
- No production code changes expected.
- Evidence may be recorded in the PR or release notes after the run.

**Interfaces:**
- Consumes: exact branch SHA after Tasks 1-2.
- Produces: passing `Mkety Cloudflare Preview` run ID and authenticated-smoke job result for Auth #16 promotion evidence.

- [ ] **Step 1: Trigger/re-run the parent workflow on the exact branch SHA**

Use the existing `Mkety Cloudflare Preview` workflow for `feat/mkety-auth-zitadel-vinext`. Do not create a separate substitute workflow.

- [ ] **Step 2: Verify every parent job**

Required green jobs:

```text
Verify preview candidate
Deploy isolated workers.dev preview
Authenticated login, tenant and logout gate / authenticated-smoke
```

Also verify the authenticated smoke's two cleanup steps completed successfully.

- [ ] **Step 3: If the hosted-login job fails, fix only the newly proven boundary**

Use the failing phase, current URL, safe DOM summary, screenshot/trace, and job logs. Do not modify Cloudflare/ZITADEL provisioning, DB/session bindings, or parent workflow unless the evidence explicitly points there.

- [ ] **Step 4: Record Auth promotion evidence**

Record:

```text
Branch SHA: <exact SHA>
Mkety Cloudflare Preview run: <run id>
Authenticated smoke job: success
Mkety cleanup: success
ZITADEL ephemeral-user cleanup: success
```

- [ ] **Step 5: Close Auth #16 promotion gate and stop changing Auth**

Once the exact parent run is fully green, move to the independent public-site production plan. Do not continue opportunistic Auth refactoring.

---

## Self-Review

- Spec coverage: complete for the remaining Auth smoke boundary, diagnostics, cleanup, exact-SHA rerun, and promotion evidence.
- Placeholder scan: no TBD/TODO/unspecified implementation steps remain.
- Type/interface consistency: helper names and environment inputs are defined in Task 1 and reused consistently; no new production Auth interface is introduced.
