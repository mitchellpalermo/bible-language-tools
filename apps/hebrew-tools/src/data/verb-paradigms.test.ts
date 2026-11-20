import { describe, expect, it } from 'vitest';
import { DAGESH } from '../lib/hebrew-input';
import { attestation, hasCorpus } from '../test/corpus';
import {
  answerForm,
  CONJUGATION_KEYS,
  CONJUGATION_LABELS,
  type FormKey,
  formKeyLabel,
  GENERAL_GRAMMAR,
  getParadigm,
  groupOf,
  isPgn,
  PREFIXED_PGNS,
  paradigmId,
  paradigmsFor,
  pgnLabel,
  QAL_GROUPS,
  QATAL_PGNS,
  QATAL_SUFFORMATIVES,
  qalGrid,
  STEM_LABELS,
  VERB_CLASS_LABELS,
  verbParadigms,
  YIQTOL_AFFIXES,
} from './verb-paradigms';

/** The stress mark the textbook prints over a penultimate tonic syllable. */
const STRESS = '\u05AB';

/** Consonants, nikud and the stress mark — nothing else belongs in a form. */
const FORM_CHARS = /^[\u05D0-\u05EA\u05B0-\u05BC\u05C1\u05C2\u05AB]+$/;

function forms(id: string): Partial<Record<FormKey, string>> {
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
        [...CONJUGATION_KEYS[p.conjugation]].sort(),
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
// Every cell is looked up in the Hebrew Bible *with its parse* (6d, #153): a
// spelling that occurs only as another form is what a form in the wrong cell
// looks like, which a spelling check alone would pass. See `src/test/corpus.ts`
// for why, and for when this runs. Each list names its cells, so a *new* entry
// in either — which is what a slip looks like — fails the test.

/** Every key of a paradigm: קטל, a grammarian's model verb, is barely in the text. */
const EVERY = 'every cell';
type Listed = Record<string, FormKey[] | typeof EVERY>;

/**
 * Cells whose spelling the text has only as another form of the same verb.
 * Each is a spelling two cells share by rule, so none is a slip: the 3fs and
 * 2ms of the prefixed conjugations, and the infinitive construct and 2ms
 * imperative. The text happens to use only the other one.
 */
const AS_ANOTHER_FORM: Listed = {
  'qal-yiqtol-strong': ['3fs'],
  'qal-yiqtol-begadkephat': ['3fs'],
  'qal-yiqtol-iii-he': ['3fs'],
  'qal-wayyiqtol-iii-he': ['2ms'],
  'qal-infinitive-construct-begadkephat': ['inf'],
};

/**
 * Regular forms the Hebrew Bible never uses, or uses only in pause or with
 * another spelling (a holem written with vav, a pausal vowel).
 */
const UNATTESTED: Listed = {
  'qal-qatal-strong': EVERY,
  'qal-qatal-begadkephat': ['3fs', '2fs', '2mp', '2fp', '1cp'],
  'qal-qatal-iii-he': ['2fp', '1cp'],
  'qal-qatal-hayah': ['2fp'],
  'qal-yiqtol-strong': ['3ms', '2fs', '1cs', '3mp', '3fp', '2mp', '2fp', '1cp'],
  'qal-yiqtol-begadkephat': ['2fs', '3fp', '2fp', '1cp'],
  'qal-yiqtol-iii-he': ['2fs', '3fp', '2fp'],
  'qal-wayyiqtol-strong': EVERY,
  'qal-wayyiqtol-iii-he': ['3fp', '2mp', '2fp'],
  'qal-weqatal-strong': EVERY,
  'qal-weqatal-begadkephat': ['3fs', '2fs', '3cp', '2mp', '2fp', '1cp'],
  'qal-imperative-strong': EVERY,
  'qal-imperative-begadkephat': ['2fs', '2fp'],
  'qal-infinitive-construct-strong': ['inf'],
  'qal-infinitive-absolute-strong': ['inf'],
  'qal-participle-active-strong': EVERY,
  'qal-participle-active-begadkephat': ['fs', 'fp'],
  'qal-participle-passive-strong': EVERY,
};

describe.skipIf(!hasCorpus)('against the Westminster Leningrad Codex, parse and all', () => {
  /** Each paradigm's cells that the text attests in a given way. */
  function cellsWhere(kind: ReturnType<typeof attestation>): Listed {
    const out: Listed = {};
    for (const p of verbParadigms) {
      const keys = CONJUGATION_KEYS[p.conjugation].filter(
        (key) =>
          attestation(p.forms[key] ?? '', { stem: p.stem, conjugation: p.conjugation, key }) ===
          kind,
      );
      if (keys.length === 0) continue;
      // EVERY only abbreviates a list: an infinitive's one cell is named.
      const all = keys.length > 1 && keys.length === CONJUGATION_KEYS[p.conjugation].length;
      out[p.id] = all ? EVERY : keys;
    }
    return out;
  }

  it('finds no form in another form’s cell, bar the shared spellings listed', () => {
    expect(cellsWhere('as-another-form')).toEqual(AS_ANOTHER_FORM);
  });

  it('attests every other cell, bar the listed gaps', () => {
    expect(cellsWhere('unattested')).toEqual(UNATTESTED);
  });

  it('lists a shared spelling only where the paradigm itself shares it', () => {
    // A cell may be on the first list only because its twin in the same table
    // is spelled the same: that is what makes it a syncretism, not a slip.
    const twins: Record<string, FormKey> = { '3fs': '2ms', '2ms': '3fs' };
    for (const [id, keys] of Object.entries(AS_ANOTHER_FORM)) {
      const p = getParadigm(id);
      for (const key of keys as FormKey[]) {
        const twin =
          key === 'inf'
            ? getParadigm(id.replace('infinitive-construct', 'imperative'))?.forms['2ms']
            : p?.forms[twins[key]];
        expect(answerForm(p?.forms[key] ?? ''), `${id} ${key}`).toBe(answerForm(twin ?? '?'));
      }
    }
  });
});

describe('pgnLabel', () => {
  it('spells out person, gender and number', () => {
    expect(pgnLabel('3ms')).toBe('3rd masculine singular');
    expect(pgnLabel('2fp')).toBe('2nd feminine plural');
    expect(pgnLabel('1cs')).toBe('1st common singular');
  });
});

describe('the forms written from general grammar (6d)', () => {
  const generalConjugations = new Set([
    'weqatal',
    'imperative',
    'infinitive-construct',
    'infinitive-absolute',
    'participle-active',
    'participle-passive',
  ]);

  it('names its source, and leaves the transcribed tables naming theirs', () => {
    for (const p of verbParadigms) {
      if (generalConjugations.has(p.conjugation)) expect(p.source, p.id).toBe(GENERAL_GRAMMAR);
      else expect(p.source, p.id).toMatch(/^Tables? \d/);
    }
  });

  it('makes the weqatal the qatal with וְ, or וּ before a vocal sheva', () => {
    for (const verbClass of ['strong', 'begadkephat'] as const) {
      const qatal = forms(`qal-qatal-${verbClass}`);
      const weqatal = forms(`qal-weqatal-${verbClass}`);
      for (const pgn of QATAL_PGNS) {
        const base = answerForm(qatal[pgn] ?? '').replace(/^([א-ת][ְ-ֻ]*)ּ/, '$1');
        const waw = base[1] === '\u05B0' ? 'וּ' : 'וְ';
        expect(answerForm(weqatal[pgn] ?? ''), `${verbClass} ${pgn}`).toBe(`${waw}${base}`);
      }
    }
  });

  it('moves the weqatal stress to the last syllable in the 2ms and 1cs', () => {
    for (const verbClass of ['strong', 'begadkephat'] as const) {
      const weqatal = forms(`qal-weqatal-${verbClass}`);
      for (const pgn of ['2ms', '1cs'] as const) {
        const form = weqatal[pgn] ?? '';
        // The mark sits on the final syllable: no vowel follows it, only a mater.
        expect(form, pgn).toMatch(new RegExp(`${STRESS}[^\u05B0-\u05BB]*$`));
      }
    }
  });

  it('spells the infinitive construct as the 2ms imperative', () => {
    for (const verbClass of ['strong', 'begadkephat'] as const) {
      expect(forms(`qal-infinitive-construct-${verbClass}`).inf).toBe(
        forms(`qal-imperative-${verbClass}`)['2ms'],
      );
    }
  });

  it('gives the passive participle shureq, and the active holem', () => {
    for (const p of [...paradigmsFor('participle-passive'), ...paradigmsFor('participle-active')]) {
      const mark = p.conjugation === 'participle-passive' ? 'וּ' : 'ֹ';
      for (const form of Object.values(p.forms)) expect(form, p.id).toContain(mark);
    }
  });
});

describe('form keys', () => {
  it('spells out a PGN, a participle’s gender and number, and an infinitive', () => {
    expect(formKeyLabel('2fp')).toBe('2nd feminine plural');
    expect(formKeyLabel('fs')).toBe('feminine singular');
    expect(formKeyLabel('inf')).toBe('infinitive');
    expect(isPgn('3cp')).toBe(true);
    expect(isPgn('mp')).toBe(false);
    expect(isPgn('inf')).toBe(false);
  });
});

describe('Qal groups and grids', () => {
  it('puts each conjugation in one group, and every group has a grid', () => {
    expect(groupOf('qatal')).toBe('qatal');
    expect(groupOf('infinitive-absolute')).toBe('infinitives');
    expect(groupOf('participle-passive')).toBe('participles');
    for (const group of QAL_GROUPS) expect(qalGrid(group).rows.length, group).toBeGreaterThan(0);
  });

  it('shows every paradigm in exactly one grid, every form once', () => {
    const seen: string[] = [];
    for (const group of QAL_GROUPS) {
      for (const row of qalGrid(group).rows) {
        for (const cell of row.cells) if (cell) seen.push(`${cell.paradigm.id}:${cell.key}`);
      }
    }
    const expected = verbParadigms.flatMap((p) =>
      Object.keys(p.forms).map((key) => `${p.id}:${key}`),
    );
    expect(seen.sort()).toEqual(expected.sort());
  });

  it('sets the infinitives side by side, construct over absolute', () => {
    const grid = qalGrid('infinitives');
    expect(grid.rows.map((r) => r.label)).toEqual(['Construct', 'Absolute']);
    expect(grid.columns.map((c) => c.paradigm.root)).toEqual(['קטל', 'כתב']);
    expect(grid.rows[1].cells[1]?.paradigm.id).toBe('qal-infinitive-absolute-begadkephat');
  });

  it('heads the participle columns active then passive', () => {
    const grid = qalGrid('participles');
    expect(grid.columns.map((c) => `${c.heading} ${c.paradigm.root}`)).toEqual([
      'Active קטל',
      'Active כתב',
      'Passive קטל',
      'Passive כתב',
    ]);
    expect(grid.rows.map((r) => r.label)).toEqual(['ms', 'fs', 'mp', 'fp']);
  });

  it('leaves an imperative row for each second-person form only', () => {
    expect(qalGrid('imperative').rows.map((r) => r.label)).toEqual(['2ms', '2fs', '2mp', '2fp']);
  });
});
