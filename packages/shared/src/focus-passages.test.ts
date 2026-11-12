import { beforeEach, describe, expect, it } from 'vitest';
import {
  createFocusPassageStore,
  type FocusPassage,
  formatPassageRef,
  MAX_PASSAGE_LABEL,
  MAX_PASSAGES,
  maturityBreakdown,
  maturityLevel,
  mergeFocusPassages,
  parsePassage,
  parsePassageList,
  parsePassages,
  passageTitle,
  rangeError,
  verseCounts,
  versesInRange,
} from './focus-passages';

const KEY = 'test-focus-v1';
const NOW = new Date('2026-11-05T12:00:00.000Z');

function passage(over: Partial<FocusPassage> = {}): FocusPassage {
  return {
    id: 'p1',
    book: 'GEN',
    startChapter: 1,
    startVerse: 1,
    endChapter: 1,
    endVerse: 5,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  };
}

const range = (over = {}) => ({
  book: 'GEN',
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 5,
  ...over,
});

describe('rangeError', () => {
  it('accepts a range that runs forward, within a chapter or across chapters', () => {
    expect(rangeError(range())).toBeNull();
    expect(rangeError(range({ startVerse: 3, endVerse: 3 }))).toBeNull();
    expect(rangeError(range({ endChapter: 2, endVerse: 1 }))).toBeNull();
  });

  it('refuses one that ends before it starts', () => {
    expect(rangeError(range({ startVerse: 6 }))).toMatch(/ends before/);
    expect(rangeError(range({ startChapter: 2 }))).toMatch(/ends before/);
  });

  it('refuses a missing book and numbers that are not references', () => {
    expect(rangeError(range({ book: '' }))).toMatch(/book/i);
    expect(rangeError(range({ startVerse: 0 }))).toMatch(/whole numbers/);
    expect(rangeError(range({ endVerse: 1.5 }))).toMatch(/whole numbers/);
    expect(rangeError(range({ endChapter: 1000 }))).toMatch(/whole numbers/);
  });
});

describe('parsePassage', () => {
  it('reads a passage, trimming its label', () => {
    expect(parsePassage(passage({ label: '  Creation  ' }))).toEqual(
      passage({ label: 'Creation' }),
    );
  });

  it('reads a row written before sync, which has no update time (greek.tools rows)', () => {
    const old = { ...passage(), updatedAt: undefined };
    expect(parsePassage(old)?.updatedAt).toBeUndefined();
    expect(parsePassage({ ...old, id: 'k3ab9x2q', label: undefined })).toMatchObject({
      id: 'k3ab9x2q',
    });
  });

  it('treats a blank or null label as no label', () => {
    expect(parsePassage(passage({ label: '   ' }))?.label).toBeUndefined();
    expect(parsePassage({ ...passage(), label: null })?.label).toBeUndefined();
  });

  it('keeps a tombstone valid and drops its label', () => {
    const t = parsePassage(passage({ label: 'x', deletedAt: '2026-11-03T00:00:00.000Z' }));
    expect(t).toEqual(passage({ deletedAt: '2026-11-03T00:00:00.000Z' }));
  });

  it.each([
    ['not an object', 'x'],
    ['an array', []],
    ['no id', { ...passage(), id: undefined }],
    ['an empty id', passage({ id: '' })],
    ['a very long id', passage({ id: 'x'.repeat(101) })],
    ['a non-string label', { ...passage(), label: 5 }],
    ['a label that is too long', passage({ label: 'x'.repeat(MAX_PASSAGE_LABEL + 1) })],
    ['a non-string book', { ...passage(), book: 5 }],
    ['a bad created date', passage({ createdAt: 'soon' })],
    ['a bad update date', passage({ updatedAt: 'soon' })],
    ['a bad deletion date', passage({ deletedAt: 'soon' })],
    ['a backward range', passage({ startVerse: 9 })],
  ])('rejects %s', (_name, raw) => {
    expect(parsePassage(raw)).toBeNull();
  });
});

describe('parsePassages and parsePassageList', () => {
  it('skips what is not a passage, and a repeated id, when reading storage', () => {
    expect(
      parsePassages([passage(), 'junk', passage({ label: 'again' }), passage({ id: 'p2' })]),
    ).toHaveLength(2);
    expect(parsePassages('nope')).toEqual([]);
  });

  it('is all-or-nothing for a request body', () => {
    expect(parsePassageList([passage(), passage({ id: 'p2' })])).toHaveLength(2);
    expect(parsePassageList([passage(), 'junk'])).toBeNull();
    expect(parsePassageList([passage(), passage()])).toBeNull();
    expect(parsePassageList({})).toBeNull();
    expect(parsePassageList(Array(MAX_PASSAGES + 1).fill(passage()))).toBeNull();
  });
});

describe('mergeFocusPassages', () => {
  it('unions passages and keeps the later rename', () => {
    const a = [passage({ label: 'old', updatedAt: '2026-11-02T00:00:00.000Z' })];
    const b = [
      passage({ label: 'new', updatedAt: '2026-11-04T00:00:00.000Z' }),
      passage({ id: 'p2' }),
    ];
    const merged = mergeFocusPassages(a, b, NOW);
    expect(merged.map((p) => [p.id, p.label])).toEqual([
      ['p1', 'new'],
      ['p2', undefined],
    ]);
    expect(mergeFocusPassages(b, a, NOW)).toEqual(merged);
  });

  it('keeps a deleted passage deleted against a device that still holds it', () => {
    const tomb = parsePassage(
      passage({ updatedAt: '2026-11-03T00:00:00.000Z', deletedAt: '2026-11-03T00:00:00.000Z' }),
    ) as FocusPassage;
    expect(mergeFocusPassages([passage()], [tomb], NOW)).toEqual([tomb]);
  });

  it('merges a greek.tools row, which has no update time, under the same rules', () => {
    const greek = { ...passage({ id: 'k3ab9x2q', book: 'REV' }), updatedAt: undefined };
    expect(mergeFocusPassages([greek], [], NOW)).toEqual([greek]);
  });
});

describe('formatPassageRef and passageTitle', () => {
  it('writes one verse, a verse range and a range across chapters', () => {
    expect(formatPassageRef('Genesis', range({ endVerse: 1 }))).toBe('Genesis 1:1');
    expect(formatPassageRef('Genesis', range())).toBe('Genesis 1:1–5');
    expect(formatPassageRef('Genesis', range({ endChapter: 2, endVerse: 3 }))).toBe(
      'Genesis 1:1–2:3',
    );
  });

  it('titles a passage by its label, else its reference', () => {
    expect(passageTitle(passage({ label: 'Creation' }), 'Genesis')).toBe('Creation');
    expect(passageTitle(passage(), 'Genesis')).toBe('Genesis 1:1–5');
  });
});

describe('versesInRange and verseCounts', () => {
  const book = {
    '1': { '1': ['a'], '2': ['b'], '3': ['c'] },
    '2': { '1': ['d'], '2': ['e'] },
    '3': { '1': ['f'] },
  };

  it('takes whole verses inside a chapter', () => {
    const verses = versesInRange(book, range({ startVerse: 2, endVerse: 3 }));
    expect(verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(['1:2', '1:3']);
  });

  it('runs across chapters, trimming the first from its start verse and the last at its end verse', () => {
    const verses = versesInRange(book, range({ startVerse: 3, endChapter: 3, endVerse: 1 }));
    expect(verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(['1:3', '2:1', '2:2', '3:1']);
    expect(verses[0].words).toEqual(['c']);
  });

  it('leaves out a verse the book lacks, and returns nothing for a chapter it lacks', () => {
    expect(versesInRange(book, range({ startVerse: 3, endVerse: 9 })).map((v) => v.verse)).toEqual([
      3,
    ]);
    expect(versesInRange(book, range({ startChapter: 9, endChapter: 9 }))).toEqual([]);
  });

  it('counts the verses in each chapter', () => {
    expect(verseCounts(book)).toEqual({ 1: 3, 2: 2, 3: 1 });
    expect(verseCounts({ '1': {} })).toEqual({ 1: 0 });
  });
});

describe('maturity', () => {
  it('bands a card by its interval', () => {
    expect([0, 1, 5, 6, 20, 21].map(maturityLevel)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('counts words by band, treating a word with no card as unseen', () => {
    const store = {
      a: { interval: 30 },
      b: { interval: 10 },
      c: { interval: 2 },
      d: { interval: 0 },
    };
    expect(maturityBreakdown(['a', 'b', 'c', 'd', 'nope'], store)).toEqual({
      mature: 1,
      familiar: 1,
      learning: 1,
      unseen: 2,
    });
    expect(maturityBreakdown([], store)).toEqual({
      mature: 0,
      familiar: 0,
      learning: 0,
      unseen: 0,
    });
  });
});

describe('createFocusPassageStore', () => {
  let tick = 0;
  let n = 0;
  const clock = () => new Date(Date.UTC(2026, 10, 5, 12, 0, tick++));
  const store = () => createFocusPassageStore(KEY, clock, () => `id-${n++}`);

  beforeEach(() => {
    localStorage.clear();
    tick = 0;
    n = 0;
  });

  it('creates a passage, stamped, with its label trimmed and shortened', () => {
    const made = store().create(range(), `  ${'x'.repeat(MAX_PASSAGE_LABEL + 20)}  `);
    expect(made.id).toBe('id-0');
    expect(made.label).toHaveLength(MAX_PASSAGE_LABEL);
    expect(made.updatedAt).toBe(made.createdAt);
    expect(store().load()).toEqual([made]);
  });

  it('creates one with no label', () => {
    expect(store().create(range(), '  ').label).toBeUndefined();
    expect(store().create(range()).label).toBeUndefined();
  });

  it('refuses a range that is not one, and stores nothing', () => {
    expect(() => store().create(range({ startVerse: 9 }))).toThrow(/ends before/);
    expect(store().loadAll()).toEqual([]);
  });

  it('finds a live passage by id and nothing for an unknown or deleted one', () => {
    const s = store();
    const made = s.create(range());
    expect(s.get(made.id)).toEqual(made);
    expect(s.get('nope')).toBeNull();
    s.remove(made.id);
    expect(s.get(made.id)).toBeNull();
  });

  it('renames, stamping the change, and clears a label with an empty one', () => {
    const s = store();
    const made = s.create(range(), 'old');
    const [renamed] = s.rename(made.id, ' new ');
    expect(renamed.label).toBe('new');
    expect((renamed.updatedAt as string) > made.createdAt).toBe(true);
    expect(s.rename(made.id, '')[0].label).toBeUndefined();
  });

  it('leaves a tombstone on remove: out of load(), still in loadAll(), no label', () => {
    const s = store();
    const made = s.create(range(), 'x');
    expect(s.remove(made.id)).toEqual([]);
    expect(s.load()).toEqual([]);
    const [tomb] = s.loadAll();
    expect(tomb.deletedAt).toBeDefined();
    expect(tomb.label).toBeUndefined();
    expect(tomb.updatedAt).toBe(tomb.deletedAt);
  });

  it('does not rename or remove a tombstone, or an id it does not hold', () => {
    const s = store();
    const made = s.create(range());
    s.remove(made.id);
    const before = s.loadAll();
    s.rename(made.id, 'back');
    s.remove(made.id);
    s.remove('nope');
    expect(s.loadAll()).toEqual(before);
  });

  it('reads storage a student has damaged as empty', () => {
    localStorage.setItem(KEY, '{not json');
    expect(store().loadAll()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([{ id: 1 }]));
    expect(store().loadAll()).toEqual([]);
  });

  it('keeps one key apart from another', () => {
    store().create(range());
    expect(createFocusPassageStore('other-key').load()).toEqual([]);
  });
});
