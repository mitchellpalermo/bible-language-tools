import { describe, expect, it } from 'vitest';
import { checkPr, screenshotUrls, uiFiles, WAIVER_LABEL } from './pr-evidence.ts';

const REPO = 'mitchellpalermo/bible-language-tools';
const url = (name: string, n = 7) =>
  `https://raw.githubusercontent.com/${REPO}/assets/pr-${n}/${name}`;
const pr = (over: Partial<Parameters<typeof checkPr>[0]> = {}) => ({
  number: 7,
  repo: REPO,
  body: '',
  labels: [],
  files: ['apps/hebrew-tools/src/components/Flashcards.tsx'],
  ...over,
});

describe('uiFiles', () => {
  it('keeps components, pages, styles and astro/css, and drops tests and logic', () => {
    expect(
      uiFiles([
        'apps/greek-tools/src/pages/index.astro',
        'packages/shared/src/components/GradeButtons.tsx',
        'packages/shared/src/components/GradeButtons.test.tsx',
        'apps/hebrew-tools/src/lib/srs.ts',
        'apps/hebrew-tools/e2e/footer.spec.ts',
        'apps/hebrew-tools/src/global.css',
        'packages/shared/src/srs.ts',
      ]),
    ).toEqual([
      'apps/greek-tools/src/pages/index.astro',
      'packages/shared/src/components/GradeButtons.tsx',
      'apps/hebrew-tools/src/global.css',
    ]);
  });
});

describe('screenshotUrls', () => {
  it("accepts only this PR's assets branch, deduplicated", () => {
    const body = `![a](${url('a-mobile-after.png')}) ${url('a-mobile-after.png')} ${url('b.png', 8)} https://example.com/x.png`;
    expect(screenshotUrls(body, REPO, 7)).toEqual([url('a-mobile-after.png')]);
  });
});

describe('checkPr', () => {
  it('passes a PR with no UI files', () => {
    expect(checkPr(pr({ files: ['packages/shared/src/srs.ts'] })).ok).toBe(true);
  });

  it('fails a UI change with no screenshots, naming the files and the fix', () => {
    const v = checkPr(pr());
    expect(v.ok).toBe(false);
    expect(v.message).toContain('Flashcards.tsx');
    expect(v.message).toContain('pnpm shots publish');
  });

  it('summarizes a long file list', () => {
    const files = Array.from({ length: 8 }, (_, i) => `apps/greek-tools/src/pages/p${i}.astro`);
    expect(checkPr(pr({ files })).message).toContain('and 3 more');
  });

  it("does not count another PR's images or a non-assets image", () => {
    const body = `${url('a-mobile-after.png', 8)} ![x](https://example.com/a-mobile-after.png)`;
    expect(checkPr(pr({ body })).ok).toBe(false);
  });

  it('fails when only one viewport is shown', () => {
    const v = checkPr(pr({ body: url('nav-mobile-after.png') }));
    expect(v.ok).toBe(false);
    expect(v.message).toContain('desktop');
  });

  it('passes with both viewports', () => {
    const body = `${url('nav-mobile-after.png')}\n${url('nav-desktop-after.png')}`;
    expect(checkPr(pr({ body })).ok).toBe(true);
  });

  it('is waived by the label', () => {
    expect(checkPr(pr({ labels: [WAIVER_LABEL] })).ok).toBe(true);
  });

  it('is waived by an N/A line with a reason, but not a bare one', () => {
    expect(checkPr(pr({ body: 'Screenshots: N/A - copy change in a test fixture' })).ok).toBe(true);
    expect(checkPr(pr({ body: 'Screenshots: N/A' })).ok).toBe(false);
    expect(checkPr(pr({ body: 'Screenshots: N/A -' })).ok).toBe(false);
  });

  it('treats a null body as empty', () => {
    expect(checkPr(pr({ body: null })).ok).toBe(false);
  });
});
