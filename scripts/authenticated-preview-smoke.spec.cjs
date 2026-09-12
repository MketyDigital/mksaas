const { test, expect } = require('@playwright/test');

const preview = process.env.PREVIEW_URL;
const issuer = new URL(process.env.MKETY_AUTH_ISSUER).origin;
const username = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;
const email = process.env.SMOKE_EMAIL;
const slug = process.env.SMOKE_WORKSPACE_SLUG;

async function describePage(page, label) {
  const snapshot = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 12),
    inputs: [...document.querySelectorAll('input')].map((el) => ({
      name: el.getAttribute('name'),
      type: el.getAttribute('type'),
      autocomplete: el.getAttribute('autocomplete'),
      placeholder: el.getAttribute('placeholder'),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    })).slice(0, 20),
    buttons: [...document.querySelectorAll('button,a[role="button"]')].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 20),
  }));
  console.log(`${label}: ${JSON.stringify(snapshot)}`);
}

async function fillFirstVisible(page, selectors, value, label) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }
  await describePage(page, label);
  throw new Error(`No visible input matched: ${selectors.join(', ')}`);
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return;
    }
  }
  await describePage(page, label);
  throw new Error(`No visible action matched: ${selectors.join(', ')}`);
}

test('real ZITADEL login creates a Mkety session and current-tenant authorization, then logout revokes it', async ({ page }) => {
  await page.goto(`${preview}/login`);
  await page.getByRole('button', { name: /continue with zitadel/i }).click();
  await page.waitForURL((url) => url.origin === issuer, { timeout: 30_000 });

  const loginNameInput = page.locator('input[name="loginName"]');
  await fillFirstVisible(page, [
    'input[name="loginName"]',
    'input[name="username"]',
    'input[autocomplete="username"]',
    'input[type="email"]',
    'input[type="text"]',
  ], username, 'ZITADEL login-name step');

  await page.getByRole('button', { name: /^Continue$/i }).click();
  await expect(loginNameInput).toBeHidden({ timeout: 15_000 }).catch(async () => {
    await describePage(page, 'ZITADEL login-name did not advance');
    throw new Error('ZITADEL login-name Continue did not advance to the next authentication step');
  });

  await fillFirstVisible(page, [
    'input[name="password"]',
    'input[autocomplete="current-password"]',
    'input[type="password"]',
  ], password, 'ZITADEL post-login-name step');
  await clickFirstVisible(page, [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button[type="submit"]',
  ], 'ZITADEL password submit step');

  await page.waitForURL((url) => url.origin === new URL(preview).origin, { timeout: 45_000 });

  const session = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });
  expect(session.status).toBe(200);
  expect(session.body?.user?.email).toBe(email);

  const create = await page.evaluate(async ({ slug }) => {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Mkety Auth Smoke', slug, description: 'CI authenticated smoke workspace' }),
    });
    return { status: response.status, body: await response.json() };
  }, { slug });
  expect(create.status).toBe(200);
  expect(create.body?.redirectTo).toBe(`/t/${slug}`);

  const protectedResponse = await page.goto(`${preview}/t/${slug}`);
  expect(protectedResponse?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(new RegExp(`/t/${slug}(?:/)?$`));

  await page.goto(`${preview}/api/auth/logout?returnTo=/login`);
  await page.waitForURL(`${preview}/login`, { timeout: 30_000 });

  const afterLogout = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });
  expect(afterLogout.status).toBe(200);
  expect(afterLogout.body?.user ?? null).toBeNull();
});
