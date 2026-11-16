import { expect, test } from '@playwright/test';

// /parse end to end (#82): a form dealt from the pool, fields that follow the
// conjugation picked, the root typed through real key events, and the marks.
// The pool is a fixture, so the form is known; grading rules are covered by
// verb-parse.test.ts and the flow by VerbParse.test.tsx.

const FORMS = {
  lemmas: { 559: ['אָמַר', 'אמר'] },
  forms: [['וַיֹּאמֶר', [['559', 'C/Vqw3ms', 1945]]]],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/data/morphhb/parse-forms.json', (route) => route.fulfill({ json: FORMS }));
});

test('parses a form right, then misses one and is told the answer', async ({ page }) => {
  await page.goto('/parse');
  await expect(page.getByText(/^1 form from the Hebrew Bible/)).toBeVisible();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Start Parsing' }).click();

  await expect(page.getByText('וַיֹּאמֶר')).toBeVisible();
  await expect(page.getByLabel('Person')).toHaveCount(0);
  await page.getByLabel('Stem').selectOption('qal');
  await page.getByLabel('Conjugation').selectOption('wayyiqtol');
  await page.getByLabel('Person').selectOption('3');
  await page.getByLabel('Gender').selectOption('m');
  await page.getByLabel('Number').selectOption('s');
  await page.getByRole('textbox', { name: 'Root' }).click();
  await page.keyboard.type("'mr");
  expect((await page.getByRole('textbox', { name: 'Root' }).inputValue()).normalize('NFC')).toBe(
    'אמר',
  );
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Correct!')).toBeVisible();

  await page.getByRole('button', { name: 'See Results' }).click();
  await expect(page.getByText('100% correct')).toBeVisible();

  await page.getByRole('button', { name: 'Try Again' }).click();
  await page.getByLabel('Stem').selectOption('hiphil');
  await page.getByLabel('Conjugation').selectOption('yiqtol');
  await page.getByLabel('Person').selectOption('3');
  await page.getByLabel('Gender').selectOption('m');
  await page.getByLabel('Number').selectOption('s');
  await page.getByRole('textbox', { name: 'Root' }).click();
  await page.keyboard.type("'mr");
  await page.keyboard.press('Enter');
  await expect(page.getByText('Not quite — review the corrections above.')).toBeVisible();
  await expect(page.getByText('Qal', { exact: true })).toBeVisible();
  await expect(page.getByText('Wayyiqtol', { exact: true })).toBeVisible();
});

test('is reachable from the Study hub', async ({ page }) => {
  await page.goto('/study');
  await page.getByRole('link', { name: /Parse/ }).first().click();
  await expect(page).toHaveURL(/\/parse/);
  await expect(page.getByRole('heading', { name: 'Verb Parsing' })).toBeVisible();
});
