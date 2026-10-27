import { expect, type Page, test } from '@playwright/test';

// The footer wordmark clips each word to a box while it slides between
// English and Greek. Each face must fit its box in its own font, or the
// footer shows sliced-off letters, as hebrew.tools did in Oct 2026.

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

/** Faces wider than their clipping box, measured after webfonts load. */
async function overflowingFaces(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const overflow: string[] = [];
    for (const word of document.querySelectorAll<HTMLElement>('footer .morph-word')) {
      const box = word.getBoundingClientRect().width;
      for (const face of word.children) {
        const range = document.createRange();
        range.selectNodeContents(face);
        const text = range.getBoundingClientRect().width;
        if (text > box + 0.5)
          overflow.push(`${face.textContent} (${text.toFixed(1)} > ${box.toFixed(1)})`);
      }
    }
    return overflow;
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`Footer wordmark at ${viewport.name}`, () => {
    test.use({ viewport });

    test('every face fits its box, at rest and on hover', async ({ page }) => {
      await page.goto('/');
      const wordmark = page.locator('footer .morph-wordmark');
      await expect(wordmark.locator('.morph-word')).toHaveCount(2);
      expect(await overflowingFaces(page)).toEqual([]);

      await wordmark.hover();
      expect(await overflowingFaces(page)).toEqual([]);
    });

    test('reads as one name to a screen reader', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('footer .morph-wordmark')).toContainText('greek.tools');
      for (const word of ['greek', 'ἑλληνικά', 'tools', 'ὅπλα']) {
        await expect(page.locator('footer .morph-word', { hasText: word })).toHaveAttribute(
          'aria-hidden',
          'true',
        );
      }
    });
  });
}
