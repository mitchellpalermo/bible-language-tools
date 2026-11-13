import { expect, type Page, test } from '@playwright/test';

// The typed-answer flow end to end (#74): the parts only a real browser shows.
// The phonetic mapping through real key events into a right-to-left field, the
// final form on screen, focus moving to the field on its own, and the keypad
// typing without taking that focus. Marking and filter rules are covered by
// the unit and component tests.

/**
 * Narrow the deck to one known card, כָּתַב "he wrote", through the filters:
 * the root כתב has two words, and only the citation form carries a frequency,
 * so a frequency band leaves it alone. A drill, so nothing is scheduled and
 * the card is the same on every run.
 */
async function dealKatav(page: Page) {
  await page.goto('/flashcards');
  await page.getByRole('button', { name: 'Study All' }).click();
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  const filters = page.getByRole('region', { name: 'Filters' });
  await filters.getByRole('textbox', { name: 'Find a root' }).click();
  await page.keyboard.type('kTb');
  await filters.getByRole('button', { name: /^כתב/ }).click();
  await page.getByRole('button', { name: /^100–499/ }).click();
  await expect(page.getByTestId('card-progress')).toHaveText('1/1');
  await page.getByRole('button', { name: 'Toggle filters' }).click();
}

test('types a Hebrew answer, checks it, then answers the card', async ({ page }) => {
  await dealKatav(page);
  await page.getByRole('button', { name: 'English → Hebrew' }).click();
  await expect(page.getByTestId('card-prompt')).toHaveText('he wrote');
  await page.getByRole('button', { name: 'Type', exact: true }).click();

  const field = page.getByRole('textbox', { name: 'Your answer in Hebrew' });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('dir', 'rtl');
  await page.keyboard.type('k.ATab');
  expect((await field.inputValue()).normalize('NFC')).toBe('כָּתַב'.normalize('NFC'));

  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Correct!');
  // The check reveals the card and never answers it: the row is still to press.
  await expect(page.getByTestId('card-progress')).toHaveText('1/1');
  await page.getByRole('button', { name: /Got it/ }).click();
  await expect(page.getByRole('heading', { name: 'Session Complete' })).toBeVisible();
});

test('a missing dagesh is marked as its own kind of slip, and the grade stays open', async ({
  page,
}) => {
  await dealKatav(page);
  await page.getByRole('button', { name: 'English → Hebrew' }).click();
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await page.keyboard.type('kATab');
  await page.getByRole('button', { name: 'Check' }).click();

  const mark = page.getByRole('status');
  await expect(mark).toContainText('Right letters and vowels, dagesh off');
  await expect(mark).toContainText('You typed');
  await expect(page.getByRole('button', { name: /Missed/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Got it/ })).toBeEnabled();
});

test('the keypad types into the field and leaves the focus there', async ({ page }) => {
  await dealKatav(page);
  await page.getByRole('button', { name: 'English → Hebrew' }).click();
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await page.getByRole('switch', { name: 'Keypad' }).click();

  const field = page.getByRole('textbox', { name: 'Your answer in Hebrew' });
  await field.click();
  await expect(field).toHaveAttribute('inputmode', 'none');
  const keypad = page.getByRole('region', { name: 'Hebrew keypad' });
  for (const name of ['kaf', 'dagesh', 'qamets', 'tav', 'patah', 'bet']) {
    await keypad.getByRole('button', { name, exact: true }).click();
  }
  await expect(field).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Correct!');
});

test('types an English gloss in Hebrew → English', async ({ page }) => {
  await dealKatav(page);
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  const field = page.getByRole('textbox', { name: 'Your answer in English' });
  await expect(field).toBeFocused();
  await page.keyboard.type('wrote');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Correct!');
  await expect(page.getByText('Qal qatal')).toBeVisible();
});
