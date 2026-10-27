import { describe, expect, it } from 'vitest';
import { newCard, type SRSCard } from './srs';
import { vocabulary } from './vocabulary';
import type { HebrewVocabWord } from './vocabulary-types';
import {
  buildWordQueue,
  countNewWords,
  countPromptable,
  glossPrompt,
  hasPrompt,
  isWordWritingKey,
  promptText,
  toWritingWord,
  wordCardKey,
  wordScore,
  wordsForSelection,
} from './writing-words';

const DAVAR: HebrewVocabWord = {
  hebrew: 'דָּבָר',
  gloss: 'word, thing',
  transliteration: 'dābār',
  partOfSpeech: 'noun',
};
const MELEKH: HebrewVocabWord = { hebrew: 'מֶלֶךְ', gloss: 'king', partOfSpeech: 'noun' };

/** A card already reviewed and not due again for a while. */
function settled(key: string): SRSCard {
  return { ...newCard(key), repetition: 3, interval: 30, dueDate: '2099-01-01' };
}

describe('wordCardKey', () => {
  it('namespaces word cards away from the letter drills', () => {
    // The conjunction וְ is one letter. Without a distinct prefix its word card
    // and the vav *letter* card would be the same card, and writing a word is
    // not the same skill as writing its first letter.
    const vav: HebrewVocabWord = { hebrew: 'וְ', gloss: 'and', partOfSpeech: 'conjunction' };

    expect(wordCardKey(vav)).toBe('write:word:וְ');
    expect(wordCardKey(vav)).not.toBe('write:letter:ו');
    expect(isWordWritingKey(wordCardKey(vav))).toBe(true);
    expect(isWordWritingKey('write:letter:ו')).toBe(false);
  });

  it('keeps homographs on separate cards', () => {
    // `cardKey` appends the sense where a clash exists. Keying off the bare
    // lemma would merge אַף "also" with אַף "nose".
    const also: HebrewVocabWord = {
      hebrew: 'אַף',
      sense: 'also',
      gloss: 'also',
      partOfSpeech: 'conjunction',
    };
    const nose: HebrewVocabWord = {
      hebrew: 'אַף',
      sense: 'nose',
      gloss: 'nose',
      partOfSpeech: 'noun',
    };

    expect(wordCardKey(also)).not.toBe(wordCardKey(nose));
  });
});

describe('toWritingWord', () => {
  it('gives each consonant cluster its own cell', () => {
    expect(toWritingWord(DAVAR).cells.map((c) => c.text)).toEqual(['דָּ', 'בָ', 'ר']);
  });

  it('keeps a final form with its silent sheva in one cell', () => {
    // מֶלֶךְ ends in ךְ. The sheva belongs to that cell, not to a cell of its own.
    const cells = toWritingWord(MELEKH).cells;

    expect(cells.map((c) => c.base)).toEqual(['מ', 'ל', 'ך']);
    expect(cells[2].text).toBe('ךְ');
  });

  it('orders cells first-written-first, leaving direction to the grid', () => {
    // The grid fills right-to-left from the script pack. Reversing here too
    // would render the word backwards.
    expect(toWritingWord(DAVAR).cells[0].base).toBe('ד');
  });
});

describe('hasPrompt', () => {
  it('rejects a transliteration prompt for a word that carries none', () => {
    // The generated Garrett entries have no transliteration by design — OSHB
    // carries no romanization. This is a real constraint on the deck.
    expect(hasPrompt(MELEKH, 'transliteration')).toBe(false);
    expect(hasPrompt(MELEKH, 'gloss')).toBe(true);
    expect(hasPrompt(DAVAR, 'transliteration')).toBe(true);
  });

  it('returns the prompt text, or null rather than a substitute', () => {
    // Silently falling back to the gloss would ask a different question than
    // the one the student chose.
    expect(promptText(DAVAR, 'transliteration')).toBe('dābār');
    expect(promptText(MELEKH, 'transliteration')).toBeNull();
    expect(promptText(MELEKH, 'gloss')).toBe('king');
  });
});

describe('buildWordQueue', () => {
  it('drops words that cannot carry the chosen prompt', () => {
    const queue = buildWordQueue([DAVAR, MELEKH], {}, 'transliteration');

    expect(queue.map((w) => w.word.hebrew)).toEqual(['דָּבָר']);
  });

  it('puts due cards ahead of unseen ones', () => {
    const store = { [wordCardKey(DAVAR)]: newCard(wordCardKey(DAVAR)) };
    const queue = buildWordQueue([MELEKH, DAVAR], store, 'gloss');

    // DAVAR has a card that is due today; MELEKH has never been seen.
    expect(queue[0].word.hebrew).toBe('דָּבָר');
  });

  it('omits cards that are not due yet', () => {
    const store = { [wordCardKey(DAVAR)]: settled(wordCardKey(DAVAR)) };
    const queue = buildWordQueue([DAVAR, MELEKH], store, 'gloss');

    expect(queue.map((w) => w.word.hebrew)).toEqual(['מֶלֶךְ']);
  });

  it('shuffles within a band but never across one', () => {
    // Vocabulary file order is an artifact of how the textbook was typed, so
    // unlike the alphabet drill this does shuffle — but a due card must never
    // fall behind an unseen one.
    const due = { ...DAVAR, hebrew: 'דָּבָר' };
    const store = { [wordCardKey(due)]: newCard(wordCardKey(due)) };
    const reverse = <T>(items: T[]): T[] => [...items].reverse();
    const queue = buildWordQueue([due, MELEKH], store, 'gloss', reverse);

    expect(queue[0].word.hebrew).toBe('דָּבָר');
  });
});

describe('countNewWords / countPromptable', () => {
  it('counts only what the prompt can actually ask for', () => {
    expect(countPromptable([DAVAR, MELEKH], 'gloss')).toBe(2);
    expect(countPromptable([DAVAR, MELEKH], 'transliteration')).toBe(1);
  });

  it('does not count a word already seen as new', () => {
    const store = { [wordCardKey(DAVAR)]: newCard(wordCardKey(DAVAR)) };

    expect(countNewWords([DAVAR, MELEKH], store, 'gloss')).toBe(1);
  });
});

describe('wordScore', () => {
  it('takes the worst cell, not the average', () => {
    // Averaging lets four good letters carry a fifth that is illegible, which
    // is the habit the drill exists to break.
    expect(wordScore([98, 95, 40])).toBe(40);
  });

  it('ignores cells that were never graded', () => {
    expect(wordScore([90, null, 95])).toBe(90);
  });

  it('is null when nothing was graded, not zero', () => {
    // Zero would read as "you wrote it wrong" rather than "no mask available".
    expect(wordScore([null, null])).toBeNull();
    expect(wordScore([])).toBeNull();
  });
});

describe('wordsForSelection', () => {
  it('returns the whole vocabulary for the all-words deck', () => {
    expect(wordsForSelection('all', [], ['core']).length).toBeGreaterThan(100);
  });

  it('narrows to the same set the flashcards would show', () => {
    const chapter2 = wordsForSelection('garrett-derouchie', [2], ['core']);

    expect(chapter2.length).toBeGreaterThan(0);
    expect(
      chapter2.every((w) =>
        (w.chapters ?? []).some((c) => c.chapter === 2 && c.category === 'core'),
      ),
    ).toBe(true);
  });
});

describe('glossPrompt', () => {
  it('drops a parenthetical that quotes the answer', () => {
    // Garrett annotates a number of entries inline. On a flashcard back, where
    // the Hebrew is shown anyway, that note costs nothing. As a writing prompt
    // it prints the answer.
    expect(
      glossPrompt('desire, enjoy, want (the qatal 3ms is חָפֵץ but other forms are normal)'),
    ).toBe('desire, enjoy, want');
  });

  it('leaves an ordinary gloss alone, parentheses and all', () => {
    // Only asides carrying Hebrew are a problem; an English parenthetical is
    // part of the meaning.
    expect(glossPrompt('the (definite article)')).toBe('the (definite article)');
    expect(glossPrompt('word, thing')).toBe('word, thing');
  });

  it('refuses a gloss whose Hebrew is not in a trailing aside', () => {
    // Blanking the answer out mid-sentence would leave a prompt with a hole in
    // it, which is a worse prompt than one fewer word.
    expect(glossPrompt('חָפֵץ means to desire')).toBeNull();
  });

  it('refuses an empty or missing gloss', () => {
    expect(glossPrompt(undefined)).toBeNull();
    expect(glossPrompt('   ')).toBeNull();
    expect(glossPrompt('(חָפֵץ)')).toBeNull();
  });

  it('keeps such a word out of the queue entirely', () => {
    const giveaway: HebrewVocabWord = {
      hebrew: 'חָפֵץ',
      gloss: 'חָפֵץ means to desire',
      partOfSpeech: 'verb',
    };

    expect(hasPrompt(giveaway, 'gloss')).toBe(false);
    expect(buildWordQueue([giveaway, DAVAR], {}, 'gloss').map((w) => w.word.hebrew)).toEqual([
      'דָּבָר',
    ]);
  });

  it('leaves no gloss prompt in the real vocabulary showing Hebrew', () => {
    // The check that matters: whatever the textbook prints, nothing reaches a
    // student as a prompt that contains the word they are being asked to write.
    const hebrew = /[֐-׿]/;
    const leaks = vocabulary
      .map((w) => promptText(w, 'gloss'))
      .filter((p): p is string => p !== null && hebrew.test(p));

    expect(leaks).toEqual([]);
  });
});
