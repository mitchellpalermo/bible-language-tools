import { describe, expect, it } from 'vitest';
import { hasCorpus, isAttested } from '../test/corpus';
import { QAL_GROUP_NOTES, wawConsecutiveNotes } from './grammar-verbal';
import { QAL_GROUPS } from './verb-paradigms';

const HEBREW_WORDS = /[֐-׿]+(?:־[֐-׿]+)*/g;
const NOTES = [...Object.values(QAL_GROUP_NOTES).flat(), ...wawConsecutiveNotes];

describe('the Qal notes', () => {
  it('belong only to groups the Qal Verb section has', () => {
    for (const group of Object.keys(QAL_GROUP_NOTES)) expect(QAL_GROUPS).toContain(group);
  });

  it('store their Hebrew in NFC', () => {
    for (const note of NOTES) expect(note).toBe(note.normalize('NFC'));
  });

  it('point the waw consecutive section at the stress shift the tables mark', () => {
    expect(wawConsecutiveNotes.some((n) => n.includes('וְכָתַבְתָּ֫'))).toBe(true);
  });
});

/**
 * Words the notes print that the Hebrew Bible does not have. Listed so that a
 * new one, which is what a pointing slip looks like, fails the test.
 */
const UNATTESTED: string[] = [];

describe.skipIf(!hasCorpus)('against the Westminster Leningrad Codex', () => {
  it('attests every Hebrew word in the notes, bar the listed gaps', () => {
    const words = NOTES.flatMap((note) => note.match(HEBREW_WORDS) ?? []);
    expect([...new Set(words)].filter((word) => !isAttested(word))).toEqual(UNATTESTED);
  });
});
