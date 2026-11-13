import { describe, expect, it } from 'vitest';
import { type HebrewVocabWord, vocabulary } from '../data/vocabulary';
import {
  asksForHebrew,
  canAsk,
  DIRECTIONS,
  frontText,
  glossVariants,
  markGloss,
  markHebrew,
  markTypedAnswer,
} from './flashcard-answer';
import { translateHebrewInput } from './hebrew-input';

function word(hebrew: string): HebrewVocabWord {
  const found = vocabulary.find((w) => w.hebrew === hebrew);
  if (!found) throw new Error(`${hebrew} is not in the vocabulary`);
  return found;
}

const DAVAR = word('דָּבָר');
const MELEK = word('מֶלֶךְ');
const KATAV = word('כָּתַב');

/** What a hardware keyboard leaves in a `useHebrewInput` field: raw, no final forms. */
const typed = (keys: string) => translateHebrewInput(keys);

describe('directions', () => {
  it('offers Hebrew → English first, then the one that asks for the Hebrew', () => {
    expect(DIRECTIONS.map((d) => d.id)).toEqual(['he-en', 'en-he']);
    expect(DIRECTIONS.map((d) => asksForHebrew(d.id))).toEqual([false, true]);
  });

  it('puts the headword or the gloss on the front', () => {
    expect(frontText(DAVAR, 'he-en')).toBe('דָּבָר');
    expect(frontText(DAVAR, 'en-he')).toBe(DAVAR.gloss);
  });

  it('cannot ask a word whose gloss still quotes the Hebrew once trimmed', () => {
    const quoted = vocabulary.filter((w) => !canAsk(w, 'en-he'));
    expect(quoted.length).toBeGreaterThan(0);
    expect(quoted.length).toBeLessThan(vocabulary.length / 10);
    for (const w of quoted) expect(frontText(w, 'en-he')).toBeNull();
    expect(canAsk(KATAV, 'en-he')).toBe(true);
  });

  it('trims an aside that quotes the Hebrew off an English prompt', () => {
    const hafets = word('חָפֵץ');
    expect(frontText(hafets, 'en-he')).toBe('he desired, enjoyed, wanted');
  });

  it('never prints Hebrew on an English front', () => {
    const hebrew = /[֐-׿]/;
    for (const w of vocabulary) {
      const front = frontText(w, 'en-he');
      if (front !== null) expect(front, w.hebrew).not.toMatch(hebrew);
    }
  });

  it('can ask every word from its Hebrew', () => {
    expect(vocabulary.every((w) => canAsk(w, 'he-en'))).toBe(true);
  });
});

describe('markHebrew', () => {
  it('marks the exact pointed form correct', () => {
    expect(markHebrew(typed('d.AbAr'), DAVAR)).toBe('correct');
  });

  it('applies the final form before comparing', () => {
    // The field stores כ until the word ends; the answer ends in ךְ.
    expect(typed('melek:')).not.toBe(MELEK.hebrew);
    expect(markHebrew(typed('melek:'), MELEK)).toBe('correct');
  });

  it('tells a missing dagesh from wrong vowels from wrong letters', () => {
    expect(markHebrew(typed('dAbAr'), DAVAR)).toBe('dagesh-only');
    expect(markHebrew(typed('d.abar'), DAVAR)).toBe('nikud-only');
    expect(markHebrew(typed('dbr'), DAVAR)).toBe('nikud-only');
    expect(markHebrew(typed('d.AbAl'), DAVAR)).toBe('wrong');
  });

  it('marks an empty answer wrong', () => {
    expect(markHebrew('', DAVAR)).toBe('wrong');
    expect(markHebrew('   ', DAVAR)).toBe('wrong');
  });

  it('accepts an alternate spelling the textbook lists', () => {
    const anokhi = word('אָנֹכִי');
    expect(anokhi.alternates).toContain('אֲנִי');
    expect(markHebrew('אֲנִי', anokhi)).toBe('correct');
    expect(markHebrew('אָנֹכִי', anokhi)).toBe('correct');
  });

  it('takes a space for a maqqef, which has no key', () => {
    const batsheva = word('בַּת־שֶׁבַע');
    expect(markHebrew('בַּת שֶׁבַע', batsheva)).toBe('correct');
    expect(markHebrew('בַּת־שֶׁבַע', batsheva)).toBe('correct');
  });

  it('accepts a prefix that ends in a letter the field shows as a final', () => {
    // כְּ is a whole entry. Typed, the field shows its kaf as ך.
    const ke = word('כְּ');
    const mark = markTypedAnswer(typed('k.:'), ke, 'en-he');
    expect(mark.result).toBe('correct');
    expect(mark.typed.normalize('NFC')).toBe(ke.hebrew.normalize('NFC'));
  });

  it('can mark every headword correct from its own spelling', () => {
    for (const w of vocabulary) expect(markHebrew(w.hebrew, w), w.hebrew).toBe('correct');
  });
});

describe('markGloss', () => {
  it('accepts one sense of the gloss', () => {
    expect(markGloss('thing', DAVAR)).toBe('correct');
    expect(markGloss('queen', DAVAR)).toBe('wrong');
  });

  it('does not ask for the subject of a citation form', () => {
    expect(KATAV.gloss).toBe('he wrote');
    expect(markGloss('wrote', KATAV)).toBe('correct');
    expect(markGloss('he wrote', KATAV)).toBe('correct');
  });

  it('accepts a sense from any stem of a verb listed across stems', () => {
    const multi = vocabulary.find((w) => /^Qal: .*; Hiphil: /.test(w.gloss));
    if (!multi) throw new Error('no verb is glossed across stems');
    const hiphil = multi.gloss.split('; ')[1].replace('Hiphil: ', '').split(',')[0];
    expect(markGloss(hiphil, multi)).toBe('correct');
    expect(markGloss(hiphil.replace(/^he /, ''), multi)).toBe('correct');
  });
});

describe('glossVariants', () => {
  it('drops a stem label, an aside and quotation marks', () => {
    expect(glossVariants('Qal: he went up')[0]).toBe('he went up');
    expect(glossVariants('(qatal 1cs) I fed')).toEqual(['I fed', 'fed']);
    expect(glossVariants('“he will succeed” (Hiphil yiqtol 3ms)')[1]).toBe('will succeed');
  });

  it('leaves a plain sense as it is', () => {
    expect(glossVariants('king')).toEqual(['king', 'king']);
  });
});

describe('markTypedAnswer', () => {
  it('marks English in Hebrew → English and keeps what was typed', () => {
    expect(markTypedAnswer(' word ', DAVAR, 'he-en')).toEqual({
      result: 'correct',
      answer: DAVAR.gloss,
      typed: 'word',
      hebrew: false,
    });
  });

  it('marks Hebrew in English → Hebrew, showing final forms as the field did', () => {
    expect(markTypedAnswer(typed('melek'), MELEK, 'en-he')).toEqual({
      result: 'nikud-only',
      answer: MELEK.hebrew,
      typed: 'מֶלֶך',
      hebrew: true,
    });
  });
});
