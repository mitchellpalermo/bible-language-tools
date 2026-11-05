import { describe, expect, it } from 'vitest';
import { type CreditSource, type CreditsCopy, hasPlaceholders, placeholder } from './credits';

const copy: CreditsCopy = { title: 'T', intro: 'I', footerLabel: 'F' };
const source: CreditSource = {
  id: 'a',
  name: 'A',
  url: 'https://example.com',
  license: null,
  licenseUrl: null,
  copy: 'Written',
};

describe('hasPlaceholders', () => {
  it('is false when every string is real wording', () => {
    expect(hasPlaceholders(copy, [source])).toBe(false);
  });

  it('detects a placeholder in the page copy', () => {
    expect(hasPlaceholders({ ...copy, intro: placeholder('intro') }, [source])).toBe(true);
  });

  it('detects a placeholder in a source', () => {
    expect(hasPlaceholders(copy, [{ ...source, copy: placeholder('a') }])).toBe(true);
  });
});
