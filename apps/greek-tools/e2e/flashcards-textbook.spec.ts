import { expect, type Page, test } from '@playwright/test';

// Textbook chapter decks on /flashcards (#228): pick a chapter, study it, and
// find it still picked on the next visit. Run at a phone width and a desktop
// one, since the picker's grid reflows between them.

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

const textbookChip = (page: Page) => page.getByRole('button', { name: /^Merkle & Plummer\s*\(/ });
// The picker's own button: the book, then the chapters chosen and how many words.
const pickerSummary = (page: Page) =>
  page.getByRole('button', { name: /^Merkle & Plummer\s*(All chapters|Ch\.)/ });
const chapterCell = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Ch\\. ${n} —`) });

for (const viewport of VIEWPORTS) {
  test.describe(`textbook chapter decks, ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/flashcards');
      await expect(textbookChip(page)).toBeVisible();
    });

    test('picks a chapter and studies it', async ({ page }) => {
      await page.getByRole('button', { name: 'Study All' }).click();
      await textbookChip(page).click();
      await expect(textbookChip(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(pickerSummary(page)).toContainText('All chapters');

      // A frequency band does not narrow a chapter, so the presets step aside.
      await expect(page.getByText('Preset', { exact: true })).toBeHidden();

      await pickerSummary(page).click();
      await chapterCell(page, 1).click();
      await expect(chapterCell(page, 1)).toHaveAttribute('aria-pressed', 'true');
      await expect(pickerSummary(page)).toContainText('Ch. 1 · 15 words');
      await expect(page.getByTestId('card-progress')).toHaveText('1/15');

      // Every chapter cell is a full touch target and none runs off the page.
      for (const n of [1, 6, 23]) {
        const box = await chapterCell(page, n).boundingBox();
        expect(box).not.toBeNull();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      }

      // Study it: flip the card, answer, and the session moves on.
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: /got it/i }).click();
      await expect(page.getByTestId('card-progress')).toHaveText('2/15');
    });

    test('keeps the chapter across a reload', async ({ page }) => {
      await textbookChip(page).click();
      await pickerSummary(page).click();
      await chapterCell(page, 3).click();
      await expect(pickerSummary(page)).toContainText('Ch. 3 · 15 words');

      await page.reload();

      await expect(textbookChip(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(pickerSummary(page)).toContainText('Ch. 3 · 15 words');
      // SRS Review on a fresh browser: the chapter's fifteen words are all new.
      await expect(page.getByText('New: 15')).toBeVisible();
    });

    test('goes back to the whole vocabulary', async ({ page }) => {
      await textbookChip(page).click();
      await textbookChip(page).click();
      await expect(textbookChip(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByText('Preset', { exact: true })).toBeVisible();
    });
  });
}
