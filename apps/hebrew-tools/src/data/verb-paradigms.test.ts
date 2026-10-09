import { describe, expect, it } from 'vitest';
import { DAGESH } from '../lib/hebrew-input';
import { hasCorpus, isAttested } from '../test/corpus';
import {
  answerForm,
  CONJUGATION_LABELS,
  CONJUGATION_PGNS,
  getParadigm,
  type Pgn,
  PREFIXED_PGNS,
  paradigmId,
  paradigmsFor,
  pgnLabel,
  QATAL_PGNS,
  QATAL_SUFFORMATIVES,
  STEM_LABELS,
  VERB_CLASS_LABELS,
  verbParadigms,
  YIQTOL_AFFIXES,
} from './verb-paradigms';

/** The stress mark the textbook prints over a penultimate tonic syllable. */
const STRESS = '\u05AB';

/** Consonants, nikud and the stress mark — nothing else belongs in a form. */
const FORM_CHARS = /^[\u05D0-\u05EA\u05B0-\u05BC\u05C1\u05C2\u05AB]+$/;

function forms(id: string): Partial<Record<Pgn, string>> {
  const paradigm = getParadigm(id);
  if (!paradigm) throw new Error(`no paradigm ${id}`);
  return paradigm.forms;
}

describe('verbParadigms', () => {
  it('gives every paradigm a unique id built from its own fields', () => {
    const ids = verbParadigms.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const p of verbParadigms) {
      expect(p.id).toBe(paradigmId(p.stem, p.conjugation, p.verbClass));
    }
  });

  it('has exactly the forms its conjugation has, and no others', () => {
    // A missing 3fp or a stray 3cp in a yiqtol is the transcription slip a
    // table layout would render as a silently empty or silently extra cell.
    for (const p of verbParadigms) {
      expect(Object.keys(p.forms).sort(), p.id).toEqual(
        [...CONJUGATION_PGNS[p.conjugation]].sort(),
      );
    }
  });

  it('stores every form in NFC, in Hebrew letters and points only', () => {
    for (const p of verbParadigms) {
      for (const [pgn, form] of Object.entries(p.forms)) {
        expect(form, `${p.id} ${pgn}`).toBe(form.normalize('NFC'));
        expect(form, `${p.id} ${pgn}`).toMatch(FORM_CHARS);
      }
    }
  });

  it('writes every form on its own root', () => {
    // III-ה roots lose the ה before a sufformative, so the check is on the
    // first two radicals, in order — enough to catch a form pasted into the
    // wrong column.
    for (const p of verbParadigms) {
      const [first, second] = [...p.root];
      for (const [pgn, form] of Object.entries(p.forms)) {
        // A shortened form ends on the second radical, in its final shape.
        const consonants = form.replace(/[^\u05D0-\u05EA]/g, '').replace(/ן$/, 'נ');
        expect(consonants, `${p.id} ${pgn}`).toMatch(new RegExp(`${first}${second}`));
      }
    }
  });

  it('carries a label for every stem, conjugation and class in use', () => {
    for (const p of verbParadigms) {
      expect(STEM_LABELS[p.stem]).toBeTruthy();
      expect(CONJUGATION_LABELS[p.conjugation]).toBeTruthy();
      expect(VERB_CLASS_LABELS[p.verbClass]).toBeTruthy();
    }
  });
});

describe('the patterns the tables teach', () => {
  it('builds the strong qatal from its 3ms consonants plus the sufformative', () => {
    const strong = forms('qal-qatal-strong');

    for (const pgn of QATAL_PGNS) {
      const form = answerForm(strong[pgn] ?? '');
      expect(form.endsWith(QATAL_SUFFORMATIVES[pgn]), pgn).toBe(true);
    }
  });

  it('builds every yiqtol from its preformative and sufformative', () => {
    for (const p of paradigmsFor('yiqtol')) {
      for (const pgn of PREFIXED_PGNS) {
        const affix = YIQTOL_AFFIXES[pgn];
        const form = answerForm(p.forms[pgn] ?? '');
        expect(affix, pgn).toBeDefined();
        expect(form.startsWith(affix?.prefix ?? '?'), `${p.id} ${pgn}`).toBe(true);
        expect(form.endsWith(affix?.suffix ?? '?'), `${p.id} ${pgn}`).toBe(true);
      }
    }
  });

  it('makes the 2ms and 3fs yiqtol identical, and the 2fp and 3fp', () => {
    for (const p of [...paradigmsFor('yiqtol'), ...paradigmsFor('wayyiqtol')]) {
      expect(p.forms['2ms'], p.id).toBe(p.forms['3fs']);
      expect(p.forms['2fp'], p.id).toBe(p.forms['3fp']);
    }
  });

  it('forms the strong wayyiqtol as וַ plus the yiqtol with its preformative doubled', () => {
    const yiqtol = forms('qal-yiqtol-strong');
    const wayyiqtol = forms('qal-wayyiqtol-strong');

    for (const pgn of PREFIXED_PGNS) {
      const base = yiqtol[pgn] ?? '';
      // א cannot take the dagesh, so the 1cs lengthens the vowel instead. A ת
      // preformative already carries one — lene in the yiqtol, forte here — so
      // only י and נ visibly gain it.
      const doubled = base[2] === DAGESH ? base : `${base.slice(0, 2)}${DAGESH}${base.slice(2)}`;
      const expected = pgn === '1cs' ? `וָ${base}` : `וַ${doubled}`;
      expect(wayyiqtol[pgn], pgn).toBe(expected);
    }
  });

  it('shortens the III-ה wayyiqtol only where the yiqtol has no sufformative', () => {
    const wayyiqtol = forms('qal-wayyiqtol-iii-he');

    expect(wayyiqtol['3ms']).toBe('וַיִּ֫בֶן');
    expect(wayyiqtol['3fs']).toBe('וַתִּ֫בֶן');
    // The first person keeps the long form, as Table 11.4 prints it.
    expect(wayyiqtol['1cs']).toBe('וָאֶבְנֶה');
    expect(wayyiqtol['1cp']).toBe('וַנִּבְנֶה');
  });

  it('marks stress only where it is penultimate', () => {
    // Table 9.6: the 2ms, 1cs and 1cp. The heavy 2mp/2fp sufformatives take the
    // stress themselves, which is also why the first vowel reduces there.
    const stressed = (id: string) =>
      Object.entries(forms(id))
        .filter(([, form]) => form.includes(STRESS))
        .map(([pgn]) => pgn);

    expect(stressed('qal-qatal-strong')).toEqual(['2ms', '1cs', '1cp']);
    expect(stressed('qal-yiqtol-strong')).toEqual(['3fp', '2fp']);
  });
});

describe('lookup', () => {
  it('finds a paradigm by id and returns undefined for an unknown one', () => {
    expect(getParadigm('qal-qatal-hayah')?.root).toBe('היה');
    expect(getParadigm('qal-qatal-nonsense')).toBeUndefined();
  });

  it('lists one conjugation in the order the textbook columns run', () => {
    expect(paradigmsFor('qatal').map((p) => p.verbClass)).toEqual([
      'strong',
      'begadkephat',
      'iii-he',
      'hayah',
    ]);
  });
});

describe('answerForm', () => {
  it('drops the stress mark and keeps every vowel and dagesh', () => {
    expect(answerForm('קָטַ֫לְתָּ')).toBe('קָטַלְתָּ');
  });

  it('leaves an unstressed form untouched', () => {
    expect(answerForm('קָטַל')).toBe('קָטַל');
  });

  it('leaves no stress mark on any stored form', () => {
    for (const p of verbParadigms) {
      for (const form of Object.values(p.forms)) {
        expect(answerForm(form)).not.toContain(STRESS);
      }
    }
  });
});

// ─── The corpus as a second witness ──────────────────────────────────────────
//
// The textbook is the authority, but three of the four model verbs are common
// in the Hebrew Bible, so most of their forms can be looked up there. See
// `src/test/corpus.ts` for why, and for when this runs.

/**
 * Regular forms the Hebrew Bible happens never to use, or uses only in pause or
 * with a different spelling. Listed so that a *new* unattested form — which is
 * what a typo looks like — fails the test instead of joining a silent set.
 */
const UNATTESTED: Record<string, Pgn[]> = {
  'qal-qatal-begadkephat': ['2fs', '2mp', '2fp', '1cp'],
  'qal-qatal-iii-he': ['2fp'],
  'qal-qatal-hayah': ['2fp'],
  'qal-yiqtol-begadkephat': ['2fs', '3fp', '2fp', '1cp'],
  'qal-yiqtol-iii-he': ['3fp', '2fp'],
  'qal-wayyiqtol-iii-he': ['3fp', '2mp', '2fp'],
};

describe.skipIf(!hasCorpus)('against the Westminster Leningrad Codex', () => {
  it('attests every form of the three biblical model verbs, bar the listed gaps', () => {
    const missing: Record<string, string[]> = {};

    for (const p of verbParadigms) {
      // קטל is a grammarian's model verb; Scripture barely uses it.
      if (p.root === 'קטל') continue;
      const gaps = Object.entries(p.forms)
        .filter(([, form]) => !isAttested(form))
        .map(([pgn]) => pgn);
      if (gaps.length > 0) missing[p.id] = gaps;
    }

    expect(missing).toEqual(UNATTESTED);
  });
});

describe('pgnLabel', () => {
  it('spells out person, gender and number', () => {
    expect(pgnLabel('3ms')).toBe('3rd masculine singular');
    expect(pgnLabel('2fp')).toBe('2nd feminine plural');
    expect(pgnLabel('1cs')).toBe('1st common singular');
  });
});
