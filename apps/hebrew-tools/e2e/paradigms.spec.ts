import { expect, test } from '@playwright/test';

// One flow end to end: the parts only a real browser shows — the mapping typed
// through real key events, final forms on screen, and the keypad keeping focus
// in the cell it types into. The rest is covered by ParadigmQuiz.test.tsx.

test('fills a cell from the keyboard and from the keypad, then checks the table', async ({
  page,
}) => {
  await page.goto('/paradigms');
  await page.getByRole('button', { name: /strong.*“kill”/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();

  const first = page.getByRole('textbox', { name: 'Answer for 3m Singular' });
  await expect(first).toBeFocused();
  await page.keyboard.type('qAtal');
  expect((await first.inputValue()).normalize('NFC')).toBe('קָטַל');

  await page.getByRole('switch', { name: 'Keypad' }).click();
  const second = page.getByRole('textbox', { name: 'Answer for 3f Singular' });
  await second.click();
  const keypad = page.getByRole('region', { name: 'Hebrew keypad' });
  for (const name of ['qof', 'qamets', 'tet', 'sheva', 'lamed', 'qamets', 'he']) {
    await keypad.getByRole('button', { name, exact: true }).click();
  }
  await expect(second).toBeFocused();
  expect((await second.inputValue()).normalize('NFC')).toBe('קָטְלָה');

  await page.getByRole('button', { name: 'Check answers' }).click();
  await expect(page.getByText('2/9')).toBeVisible();
});

test('is reachable from the Study hub', async ({ page }) => {
  await page.goto('/study');
  await page.getByRole('link', { name: /Paradigms/ }).click();
  await expect(page).toHaveURL(/\/paradigms/);
  await expect(page.getByRole('heading', { name: 'Paradigm Quiz' })).toBeVisible();
});
