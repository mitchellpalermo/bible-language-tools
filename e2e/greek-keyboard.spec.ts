import { expect, test } from '@playwright/test';

test.describe('Greek Keyboard page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/keyboard');
  });

  test('loads the page', async ({ page }) => {
    await expect(page).toHaveTitle(/greek/i);
  });

  test('has a textarea for Greek input', async ({ page }) => {
    const textarea = page.getByRole('textbox');
    await expect(textarea).toBeVisible();
  });

  test('typing English produces Greek text', async ({ page }) => {
    const textarea = page.getByRole('textbox');
    await textarea.click();
    await page.keyboard.press('l');
    await page.keyboard.press('o');
    await page.keyboard.press('g');
    await page.keyboard.press('o');
    await page.keyboard.press('s');

    // 'logos' → 'λογος' but final s → ς at end → 'λογος' with final ς
    const value = await textarea.inputValue();
    expect(value).toContain('λ');
    expect(value).toContain('ο');
    expect(value).toContain('γ');
  });

  test('Clear button empties the textarea', async ({ page }) => {
    const textarea = page.getByRole('textbox');
    await textarea.click();
    await page.keyboard.press('a');

    await page.getByRole('button', { name: /clear/i }).click();
    await expect(textarea).toHaveValue('');
  });

  test('Copy to Clipboard button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /copy to clipboard/i })).toBeVisible();
  });
});
