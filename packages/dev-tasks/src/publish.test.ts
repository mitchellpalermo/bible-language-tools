import { describe, expect, it } from 'vitest';
import { githubRepo } from './git.ts';
import { groupShots, screenshotsMarkdown } from './publish.ts';

const REPO = 'mitchellpalermo/bible-language-tools';

describe('groupShots', () => {
  it('pairs before and after, mobile first, and ignores other files', () => {
    expect(
      groupShots([
        'nav-desktop-after.png',
        'nav-mobile-after.png',
        'nav-mobile-before.png',
        'notes.txt',
      ]),
    ).toEqual([
      {
        shot: 'nav',
        viewport: 'mobile',
        before: 'nav-mobile-before.png',
        after: 'nav-mobile-after.png',
      },
      { shot: 'nav', viewport: 'desktop', after: 'nav-desktop-after.png' },
    ]);
  });
});

describe('screenshotsMarkdown', () => {
  it('has a Before column when anything has a before', () => {
    const md = screenshotsMarkdown(
      ['nav-mobile-before.png', 'nav-mobile-after.png', 'x-desktop-after.png'],
      REPO,
      7,
    );
    expect(md).toContain('| Shot | Before | After |');
    expect(md).toContain(
      `<img src="https://raw.githubusercontent.com/${REPO}/assets/pr-7/nav-mobile-before.png"`,
    );
    expect(md).toContain('| x (desktop, 1280px) | — |');
  });

  it('is a single column for a new page', () => {
    const md = screenshotsMarkdown(['write-mobile-after.png'], REPO, 7);
    expect(md).toContain('| Shot | Screenshot |');
    expect(md).toContain('| write (mobile, 390px) |');
  });

  it('is empty with nothing to show', () => {
    expect(screenshotsMarkdown(['a.txt'], REPO, 7)).toBe('');
  });
});

describe('githubRepo', () => {
  it.each([
    'https://github.com/mitchellpalermo/bible-language-tools.git',
    'https://github.com/mitchellpalermo/bible-language-tools',
    'git@github.com:mitchellpalermo/bible-language-tools.git',
  ])('reads %s', (url) => {
    expect(githubRepo(url)).toBe(REPO);
  });

  it('refuses a non-GitHub remote', () => {
    expect(() => githubRepo('https://gitlab.com/a/b.git')).toThrow(/not a GitHub remote/);
  });
});
