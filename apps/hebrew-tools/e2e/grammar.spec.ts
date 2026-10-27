import { expect, test } from '@playwright/test';

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

test.describe('Grammar reference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/grammar');
  });

  test('is reachable from the site nav', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await page.getByRole('link', { name: 'Grammar', exact: true }).first().click();

    await expect(page).toHaveURL(/\/grammar/);
    await expect(page.getByRole('heading', { level: 1, name: 'Grammar Reference' })).toBeVisible();
  });

  test('the sidebar jumps to a section on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const sidebar = page.getByRole('navigation', { name: 'Grammar sections' }).first();
    await expect(sidebar).toBeVisible();

    await sidebar.getByRole('link', { name: 'Qal Verb' }).click();

    await expect(page.getByRole('region', { name: 'Qal Verb' })).toBeInViewport();
  });

  test('switching conjugation swaps the table', async ({ page }) => {
    await page.getByRole('tab', { name: 'Wayyiqtol' }).click();

    const panel = page.getByRole('tabpanel');
    await expect(panel.getByRole('rowheader', { name: '3fp' })).toBeVisible();
    await expect(panel.getByRole('rowheader', { name: '3cp' })).toHaveCount(0);
  });

  // Only a real browser lays text out, so only here can a table be caught
  // pushing the page sideways on a phone.
  test('the page never scrolls sideways at 375px', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await expect(page.getByRole('navigation', { name: 'Grammar sections' }).last()).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows).toBe(false);
  });
});
