import { expect, test } from '@playwright/test';

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 800 };

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /open hebrew\.tools menu/i });

const panel = (page: import('@playwright/test').Page) => page.locator('#site-nav-panel');

test.describe('Mobile navigation menu', () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('the menu is closed on load', async ({ page }) => {
    await expect(trigger(page)).toBeVisible();
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page)).toBeHidden();
  });

  test('opens on trigger click', async ({ page }) => {
    await trigger(page).click();

    await expect(panel(page)).toBeVisible();
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('every destination is reachable at 375px', async ({ page }) => {
    await trigger(page).click();

    for (const name of ['Type', 'Flashcards']) {
      await expect(panel(page).getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(panel(page).locator('[data-account-link]')).toBeVisible();
  });

  test('navigates and closes on link click', async ({ page }) => {
    await trigger(page).click();
    await panel(page).getByRole('link', { name: 'Type', exact: true }).click();

    await expect(page).toHaveURL(/\/keyboard/);
    await expect(panel(page)).toBeHidden();
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('closes on backdrop click', async ({ page }) => {
    await trigger(page).click();
    // Click well clear of the drawer, which is pinned to the right edge.
    await page.locator('[data-nav-backdrop]').click({ position: { x: 10, y: 400 } });

    await expect(panel(page)).toBeHidden();
  });

  test('closes on Escape and restores focus to the trigger', async ({ page }) => {
    await trigger(page).click();
    await page.keyboard.press('Escape');

    await expect(panel(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test('traps focus inside the open panel', async ({ page }) => {
    await trigger(page).click();
    await expect(page.getByRole('button', { name: /close menu/i })).toBeFocused();

    const focusables = await panel(page).locator('a[href], button').count();
    for (let i = 0; i < focusables; i++) {
      await page.keyboard.press('Tab');
    }
    await expect(page.getByRole('button', { name: /close menu/i })).toBeFocused();
  });

  test('locks body scroll while open', async ({ page }) => {
    await trigger(page).click();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('highlights the active route', async ({ page }) => {
    await page.goto('/keyboard');
    await trigger(page).click();

    await expect(panel(page).getByRole('link', { name: 'Type', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the footer is reachable on mobile', async ({ page }) => {
    await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'hello@hebrew.tools' })).toBeVisible();
  });

  test('renders no bottom-anchored navigation chrome', async ({ page }) => {
    const bottomFixed = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      return [...document.body.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' || style.visibility === 'hidden') return false;
        const box = el.getBoundingClientRect();
        return box.height > 0 && box.bottom >= viewportHeight - 1 && box.top > 0;
      }).length;
    });

    expect(bottomFixed).toBe(0);
  });
});

test.describe('Desktop navigation', () => {
  test.use({ viewport: DESKTOP });

  test('shows the header links and no hamburger', async ({ page }) => {
    await page.goto('/');

    for (const name of ['Type', 'Flashcards']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(trigger(page)).toBeHidden();
    await expect(panel(page)).toBeHidden();
  });

  test('lights the active link', async ({ page }) => {
    await page.goto('/keyboard');

    await expect(page.getByRole('link', { name: 'Type', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
