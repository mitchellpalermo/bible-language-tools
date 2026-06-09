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
    // Sign up
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
});
