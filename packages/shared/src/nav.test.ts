import { describe, expect, it } from 'vitest';
import { isNavLinkActive, isNavLinkCurrent, matchesPath, type NavLink, navLinkPaths } from './nav';

// greek.tools' real list — the Study group is the case the old STUDY_PATHS
// constant existed to handle.
const STUDY: NavLink = {
  href: '/study',
  label: 'Study',
  children: [
    { href: '/flashcards', label: 'Flashcards' },
    { href: '/quiz', label: 'Quiz' },
    { href: '/paradigms', label: 'Paradigms' },
    { href: '/parse', label: 'Parse' },
    { href: '/focus', label: 'Focus Passages' },
  ],
};

describe('matchesPath', () => {
  it('matches a path against itself', () => {
    expect(matchesPath('/keyboard', '/keyboard')).toBe(true);
  });

  it('matches nested routes by prefix', () => {
    expect(matchesPath('/parse', '/parse/gnt')).toBe(true);
    expect(matchesPath('/account', '/account/signin')).toBe(true);
  });

  it('does not match an unrelated route', () => {
    expect(matchesPath('/keyboard', '/reader')).toBe(false);
  });

  it('treats the home path as exact so it does not swallow every route', () => {
    expect(matchesPath('/', '/')).toBe(true);
    expect(matchesPath('/', '/keyboard')).toBe(false);
  });
});

describe('navLinkPaths', () => {
  it('is just the href for a plain link', () => {
    expect(navLinkPaths({ href: '/daily', label: 'Daily' })).toEqual(['/daily']);
  });

  it('includes matchPaths and children', () => {
    expect(navLinkPaths(STUDY)).toEqual([
      '/study',
      '/flashcards',
      '/quiz',
      '/paradigms',
      '/parse',
      '/focus',
    ]);
  });

  it('includes explicit matchPaths', () => {
    const link: NavLink = { href: '/reader', label: 'Reader', matchPaths: ['/read'] };
    expect(navLinkPaths(link)).toEqual(['/reader', '/read']);
  });
});

describe('isNavLinkActive', () => {
  it('lights a plain link on its own route', () => {
    expect(isNavLinkActive({ href: '/daily', label: 'Daily' }, '/daily')).toBe(true);
  });

  it('leaves a plain link dark elsewhere', () => {
    expect(isNavLinkActive({ href: '/daily', label: 'Daily' }, '/reader')).toBe(false);
  });

  it('lights a group heading on the group route', () => {
    expect(isNavLinkActive(STUDY, '/study')).toBe(true);
  });

  it.each([
    '/flashcards',
    '/quiz',
    '/paradigms',
    '/parse',
    '/focus',
  ])('lights the Study group on %s', (path) => {
    expect(isNavLinkActive(STUDY, path)).toBe(true);
  });

  it('lights the Study group on a nested sub-route', () => {
    expect(isNavLinkActive(STUDY, '/parse/gnt')).toBe(true);
  });

  it('leaves the Study group dark on an unrelated route', () => {
    expect(isNavLinkActive(STUDY, '/grammar')).toBe(false);
  });

  it('honours matchPaths', () => {
    const link: NavLink = { href: '/keyboard', label: 'Type', matchPaths: ['/export'] };
    expect(isNavLinkActive(link, '/export')).toBe(true);
  });
});

describe('isNavLinkCurrent', () => {
  it('is true on the link’s own route', () => {
    expect(isNavLinkCurrent(STUDY, '/study')).toBe(true);
  });

  it('is false on a child route, so only the child gets aria-current', () => {
    expect(isNavLinkCurrent(STUDY, '/flashcards')).toBe(false);
    expect(isNavLinkActive(STUDY, '/flashcards')).toBe(true);
  });

  it('is true for the child itself', () => {
    const flashcards = STUDY.children?.[0] as NavLink;
    expect(isNavLinkCurrent(flashcards, '/flashcards')).toBe(true);
  });

  it('honours matchPaths', () => {
    const link: NavLink = { href: '/keyboard', label: 'Type', matchPaths: ['/export'] };
    expect(isNavLinkCurrent(link, '/export')).toBe(true);
  });
});
