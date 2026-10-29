import { emptyStats } from '@tools/shared/srs';
import { describe, expect, it } from 'vitest';
import { SHIFT_ITEMS, type ShiftItem } from '../data/accent-shift';
import { newCard, nextSRS } from '../data/srs';
import {
  ACCENT_KEY_PREFIX,
  accentCardKey,
  buildQueue,
  checkAccent,
  checkForm,
  checkPositions,
  checkSyllables,
  expectedPositions,
  formConcepts,
  isItemPending,
  letters,
  recordItem,
  syllableGaps,
} from './accent-shift';

const byId = (id: string) => SHIFT_ITEMS.find((i) => i.id === id) as ShiftItem;
const davar = byId('davar-pl'); // דְּ / בָ / רִים
const devarekhem = byId('devarim-2mp'); // דִּבְ / רֵי / כֶם
const sus = byId('sus-pl'); // סוּ / סִים

describe('letters', () => {
  it('gives the bare letters, vowel letters included', () => {
    expect(letters('דְּבָרִים')).toEqual(['ד', 'ב', 'ר', 'י', 'ם']);
    expect(letters('סוּסִים')).toEqual(['ס', 'ו', 'ס', 'י', 'ם']);
    expect(letters('שֹׁפְטִים')).toEqual(['ש', 'פ', 'ט', 'י', 'ם']);
  });
});

describe('step 1: syllables', () => {
  it('puts the gaps after each syllable’s letters', () => {
    expect(syllableGaps(davar)).toEqual(new Set([1, 2]));
    expect(syllableGaps(devarekhem)).toEqual(new Set([2, 4]));
    expect(syllableGaps(sus)).toEqual(new Set([2]));
  });

  it('accepts the right division', () => {
    expect(checkSyllables(davar, new Set([1, 2]))).toEqual({ correct: true, rules: [] });
  });

  it('names the vocal-sheva convention when its syllable is merged', () => {
    expect(checkSyllables(davar, new Set([2]))).toEqual({
      correct: false,
      rules: ['vocal-sheva-syllable'],
    });
  });

  it('names the general rule for any other missing or extra gap', () => {
    expect(checkSyllables(devarekhem, new Set([2])).rules).toEqual(['syllable-per-consonant']);
    expect(checkSyllables(sus, new Set([2, 3])).rules).toEqual(['syllable-per-consonant']);
  });

  it('can name both', () => {
    expect(new Set(checkSyllables(davar, new Set([3])).rules)).toEqual(
      new Set(['vocal-sheva-syllable', 'syllable-per-consonant']),
    );
  });
});

describe('step 2: accent', () => {
  it('wants the last syllable', () => {
    expect(checkAccent(davar, 2).correct).toBe(true);
    expect(checkAccent(davar, 1)).toEqual({ correct: false, rules: ['ending-takes-accent'] });
    expect(checkAccent(davar, null).correct).toBe(false);
  });
});

describe('step 3: positions', () => {
  it('expects pretonic just before the accent and distant before that', () => {
    expect(expectedPositions(davar)).toEqual(['distant', 'pretonic', null]);
    expect(expectedPositions(sus)).toEqual(['pretonic', null]);
  });

  it('accepts the right labels, ignoring the accented syllable', () => {
    expect(checkPositions(davar, ['distant', 'pretonic', null]).correct).toBe(true);
    expect(checkPositions(davar, ['distant', 'pretonic', 'distant']).correct).toBe(true);
  });

  it('names the definition that was missed', () => {
    expect(checkPositions(davar, ['pretonic', 'pretonic', null]).rules).toEqual([
      'distant-position',
    ]);
    expect(checkPositions(davar, ['distant', 'distant', null]).rules).toEqual([
      'pretonic-position',
    ]);
    expect(new Set(checkPositions(davar, []).rules)).toEqual(
      new Set(['distant-position', 'pretonic-position']),
    );
  });
});

describe('step 4: the form', () => {
  it('accepts the form, typed with ordinary letters where a final form belongs', () => {
    expect(checkForm(davar, 'דְּבָרִימ')).toEqual({
      correct: true,
      result: 'correct',
      rules: [],
      wrongSyllables: [],
    });
  });

  it('accepts a missing dagesh, and says so', () => {
    const check = checkForm(davar, 'דְבָרִים');
    expect(check.correct).toBe(true);
    expect(check.result).toBe('dagesh-only');
  });

  it('names the rule behind each syllable that came out wrong', () => {
    // The qamets of דָּבָר kept in the distant syllable.
    const check = checkForm(davar, 'דָּבָרִים');
    expect(check.correct).toBe(false);
    expect(check.wrongSyllables).toEqual([0]);
    expect(check.rules).toEqual(['open-distant-reduces']);
  });

  it('catches a closed syllable left long', () => {
    // לְבָבְכֶם: the qamets should have shortened before the heavy suffix.
    const check = checkForm(byId('levav-2mp'), 'לְבָבְכֶם');
    expect(check.rules).toEqual(['closed-unaccented-short']);
  });

  it('offers every unaccented syllable’s rule when the letters are wrong', () => {
    const check = checkForm(davar, 'דְּבָרוֹת');
    expect(check.result).toBe('wrong');
    expect(check.wrongSyllables).toEqual([0, 1]);
    expect(check.rules).toEqual(['open-distant-reduces', 'open-pretonic-long']);
  });

  it('ignores cantillation and surrounding space', () => {
    expect(checkForm(davar, ' דְּבָרִ֑ים ').correct).toBe(true);
  });
});

describe('the attempt log', () => {
  it('logs one attempt per syllable under its rule', () => {
    const check = checkForm(davar, 'דָּבָרִים');
    expect(formConcepts(davar, check)).toEqual([
      { concept: 'accent-shift/open-distant-reduces', correct: false },
      { concept: 'accent-shift/open-pretonic-long', correct: true },
      { concept: 'accent-shift/accented-full', correct: true },
    ]);
  });
});

describe('scheduling', () => {
  it('keys cards under their own prefix', () => {
    expect(accentCardKey('davar-pl')).toBe('accent:davar-pl');
    expect(ACCENT_KEY_PREFIX).toBe('accent:');
  });

  it('schedules a clean pass forward and a miss for tomorrow', () => {
    const passed = recordItem({}, emptyStats(), 'davar-pl', true);
    expect(passed.store['accent:davar-pl'].repetition).toBe(1);
    expect(passed.stats.totalReviewed).toBe(1);

    const missed = recordItem({}, emptyStats(), 'davar-pl', false);
    expect(missed.store['accent:davar-pl'].repetition).toBe(0);
    expect(missed.stats.totalCorrect).toBe(0);
  });

  it('lets a same-day repeat demote but not promote', () => {
    const once = recordItem({}, emptyStats(), 'davar-pl', true);
    const again = recordItem(once.store, once.stats, 'davar-pl', true);
    expect(again.store).toBe(once.store);
    expect(again.stats.totalReviewed).toBe(2);

    const missed = recordItem(once.store, once.stats, 'davar-pl', false);
    expect(missed.store['accent:davar-pl'].repetition).toBe(0);
  });

  it('deals due and new items first', () => {
    const reviewed = nextSRS(newCard(accentCardKey('davar-pl')), 4);
    const store = { [accentCardKey('davar-pl')]: reviewed };
    expect(isItemPending(davar, store)).toBe(false);
    expect(isItemPending(sus, store)).toBe(true);

    const queue = buildQueue(store, () => 0);
    expect(queue).toHaveLength(SHIFT_ITEMS.length);
    expect(queue.at(-1)?.id).toBe('davar-pl');
  });
});
