import { expect, test } from '@playwright/test';

test.describe('credits page', () => {
  test('is reached from the footer and lists every source', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
    await page.locator('footer a[href="/credits"]').click();
    await expect(page).toHaveURL(/\/credits$/);
    await expect(page.locator('main h1')).toBeVisible();
    for (const id of ['oshb', 'wlc', 'oshb-lexicon', 'tbesh', 'daily-dose']) {
      await expect(page.locator(`li#${id} h2 a`)).toHaveAttribute('href', /^https:\/\//);
    }
  });
});
