import { describe, expect, it } from 'vitest';
import { apps, hostOf } from './apps';

describe('apps', () => {
  it('lists Greek then Hebrew', () => {
    expect(apps.map((a) => a.id)).toEqual(['greek', 'hebrew']);
  });

  it('has unique ids and https URLs', () => {
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length);
    for (const app of apps) expect(app.url).toMatch(/^https:\/\//);
  });

  it('writes Hebrew right to left and Greek left to right', () => {
    const byId = Object.fromEntries(apps.map((a) => [a.id, a]));
    expect(byId.hebrew.dir).toBe('rtl');
    expect(byId.hebrew.glyphLang).toBe('he');
    expect(byId.greek.dir).toBe('ltr');
    expect(byId.greek.glyphLang).toBe('grc');
  });

  it('gives every app a glyph, a description and at least one feature', () => {
    for (const app of apps) {
      expect(app.glyph).not.toBe('');
      expect(app.navLabel).not.toBe('');
      expect(app.description).not.toBe('');
      expect(app.features.length).toBeGreaterThan(0);
    }
  });
});

describe('hostOf', () => {
  it('drops the scheme', () => {
    expect(hostOf('https://greek.tools')).toBe('greek.tools');
  });

  it('keeps a subdomain', () => {
    expect(hostOf('https://www.hebrew.tools/x')).toBe('www.hebrew.tools');
  });
});
