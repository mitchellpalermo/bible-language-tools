import { describe, expect, it } from 'vitest';
import { creditSources, creditsCopy } from './credits';

describe('greek-tools credits', () => {
  it('lists every required source exactly once', () => {
    expect(creditSources.map((s) => s.id)).toEqual(['morphgnt', 'sblgnt', 'dodson', 'daily-dose']);
  });

  it('links each source over https', () => {
    for (const s of creditSources) {
      expect(s.url).toMatch(/^https:\/\//);
      if (s.licenseUrl) expect(s.licenseUrl).toMatch(/^https:\/\//);
    }
  });

  it('has a licence name whenever it has a licence link', () => {
    for (const s of creditSources) expect(Boolean(s.license)).toBe(Boolean(s.licenseUrl));
  });

  it('has wording for the page and every source', () => {
    expect(creditsCopy.title).not.toBe('');
    for (const s of creditSources) expect(s.copy).not.toBe('');
  });
});
