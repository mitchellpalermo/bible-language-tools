import { expect, test } from '@playwright/test';

// These tests require a running server with D1 bindings.
// Run locally with: pnpm build && pnpm preview (uses Miniflare + .dev.vars)
// The default `pnpm test:e2e` uses `astro dev` which has no D1 binding.

const email = `e2e-${Date.now()}@example.com`;
const password = 'TestPassword123!';

test.describe('Auth flow', () => {
  test('unauthenticated user sees Sign in in the nav', async ({ page }) => {
    await page.goto('/');
    const signInLink = page.getByRole('link', { name: /sign in/i }).first();
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/account/signin');
  });

  test('sign-in page is accessible', async ({ page }) => {
    await page.goto('/account/signin');
    await expect(page).toHaveTitle(/sign in/i);
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  });

  test('sign-up page is accessible', async ({ page }) => {
    await page.goto('/account/signup');
    await expect(page).toHaveTitle(/sign up/i);
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('account page redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account\/signin/);
    const url = new URL(page.url());
    expect(url.searchParams.get('from')).toBe('/account');
  });

  test('sign-in with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/account/signin');
    await page.getByRole('textbox', { name: /email/i }).fill('nobody@example.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();
  });

  // Full flow requires D1 — skip in CI/dev without wrangler
  test.skip('full sign-up → account → sign-out flow', async ({ page }) => {
    // Sign up. With no local progress the welcome interstitial passes straight
    // through to the account page.
    await page.goto('/account/signup');
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Should land on account page
    await expect(page).toHaveURL('/account');
    await expect(page.getByText(email)).toBeVisible();

    // Sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should land on home page, unauthenticated
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  });

  // Full flow requires D1 — skip in CI/dev without wrangler
  test.skip('progress synced on device A appears on device B', async ({ browser }) => {
    const syncEmail = `e2e-sync-${Date.now()}@example.com`;
    const cardKeys = ['λόγος', 'θεός', 'ἀρχή', 'καί', 'φῶς'];

    // Device A: existing local progress, then sign up and import it
    const deviceA = await browser.newContext();
    const pageA = await deviceA.newPage();
    await pageA.goto('/');
    await pageA.evaluate((keys) => {
      const store: Record<string, unknown> = {};
      for (const key of keys) {
        store[key] = {
          key,
          interval: 6,
          repetition: 2,
          easeFactor: 2.5,
          dueDate: '2026-06-15',
          lastReviewed: '2026-06-09',
        };
      }
      localStorage.setItem('greek-tools-srs-v2', JSON.stringify(store));
    }, cardKeys);

    await pageA.goto('/account/signup');
    await pageA.getByRole('textbox', { name: /email/i }).fill(syncEmail);
    await pageA.getByRole('textbox', { name: /password/i }).fill(password);
    await pageA.getByRole('button', { name: /create account/i }).click();

    await pageA.getByRole('button', { name: /import/i }).click();
    await expect(pageA).toHaveURL('/account');
    await deviceA.close();

    // Device B: fresh context (no localStorage), sign in, expect the cards
    const deviceB = await browser.newContext();
    const pageB = await deviceB.newPage();
    await pageB.goto('/account/signin');
    await pageB.getByRole('textbox', { name: /email/i }).fill(syncEmail);
    await pageB.getByRole('textbox', { name: /password/i }).fill(password);
    await pageB.getByRole('button', { name: /sign in/i }).click();

    await expect(pageB).toHaveURL('/account');
    const storeB = await pageB.evaluate(() =>
      JSON.parse(localStorage.getItem('greek-tools-srs-v2') ?? '{}'),
    );
    for (const key of cardKeys) {
      expect(storeB[key]).toBeDefined();
      expect(storeB[key].repetition).toBe(2);
    }
    await deviceB.close();
  });
});
