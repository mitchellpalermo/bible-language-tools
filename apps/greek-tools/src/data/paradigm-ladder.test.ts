// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildTableModels, type TableModel } from '../lib/paradigm-quiz';
import { bareLetters, corpusWords, hasCorpus, plainForm } from '../test/corpus';
import { CASE_LABELS, CASES, type CaseKey, GENDERS, NUMBERS } from './grammar';
import { LADDER_RUNG_IDS, LADDER_RUNGS } from './paradigm-ladder';

const tables = new Map(buildTableModels().map((t) => [t.id, t]));
const table = (id: string): TableModel => tables.get(id) as TableModel;

describe('the ladder as data', () => {
  it('names every rung with a table the quiz has', () => {
    for (const rung of LADDER_RUNGS) expect(tables.has(rung.id), rung.id).toBe(true);
  });

  it('has no rung twice, and a line saying what each adds', () => {
    expect(new Set(LADDER_RUNG_IDS).size).toBe(LADDER_RUNG_IDS.length);
    for (const rung of LADDER_RUNGS) expect(rung.detail.length).toBeGreaterThan(10);
  });

  it('pins the rung ids, because progress is stored under them', () => {
    expect(LADDER_RUNG_IDS).toEqual([
      'article',
      'noun-2m-os',
      'noun-2n-on',
      'noun-1f-alpha-pure',
      'noun-1f-alpha-impure',
      'noun-3-mute',
      'noun-3-i-stem',
      'noun-3-u-stem',
      'noun-3-s-stem',
      'adj-adj-2-1-2',
      'adj-adj-3-1-3',
      'participle-pres-act-ptc',
      'pronoun-ego',
      'pronoun-autos',
      'pronoun-outos',
      'verb-pres-act-ind',
      'verb-impf-act-ind',
      'verb-fut-act-ind',
      'verb-aor-act-ind',
      'verb-perf-act-ind',
      'verb-pres-mid-ind',
      'verb-aor-mid-ind',
      'verb-aor-pass-ind',
    ]);
  });

  it('climbs the issue’s sequence: article, nouns, adjectives, pronouns, then verbs', () => {
    const order = LADDER_RUNG_IDS.map((id) => table(id).category);
    expect(order[0]).toBe('article');
    const firstOf = (c: string) => order.indexOf(c as never);
    expect(firstOf('noun')).toBeLessThan(firstOf('adjective'));
    expect(firstOf('adjective')).toBeLessThan(firstOf('pronoun'));
    // The participle is a verb form read as a noun, so it sits among the adjectives.
    expect(LADDER_RUNG_IDS.indexOf('participle-pres-act-ptc')).toBeLessThan(
      LADDER_RUNG_IDS.indexOf('pronoun-ego'),
    );
    expect(LADDER_RUNG_IDS.indexOf('pronoun-outos')).toBeLessThan(
      LADDER_RUNG_IDS.indexOf('verb-pres-act-ind'),
    );
  });

  it('teaches the active before the middle and passive, and the present before the aorist', () => {
    const at = (id: string) => LADDER_RUNG_IDS.indexOf(id);
    expect(at('verb-pres-act-ind')).toBeLessThan(at('verb-impf-act-ind'));
    expect(at('verb-perf-act-ind')).toBeLessThan(at('verb-pres-mid-ind'));
    expect(at('verb-pres-mid-ind')).toBeLessThan(at('verb-aor-mid-ind'));
    expect(at('verb-aor-mid-ind')).toBeLessThan(at('verb-aor-pass-ind'));
  });

  it('gives every rung a table with something to write', () => {
    for (const id of LADDER_RUNG_IDS) {
      const cells = table(id)
        .rows.flatMap((r) => r.answers)
        .filter((a) => a !== null);
      expect(cells.length, id).toBeGreaterThanOrEqual(6);
    }
  });
});

// ─── Against the Greek New Testament ──────────────────────────────────────────
//
// The corpus is a second witness, not the authority. A regular form is regular
// whether or not the New Testament uses it, so the forms below that it does not
// attest are listed by name, and each needs a Greek instructor's eye before
// release (#199). A form that is NOT on the list and is not in the text is what
// a typo looks like.

/** Each noun-like rung's lemma, as MorphGNT spells it. */
const LEMMA: Record<string, string> = {
  article: 'ὁ',
  'noun-2m-os': 'λόγος',
  'noun-2n-on': 'ἔργον',
  'noun-1f-alpha-pure': 'ἡμέρα',
  'noun-1f-alpha-impure': 'δόξα',
  'noun-3-mute': 'σάρξ',
  'noun-3-i-stem': 'πίστις',
  'noun-3-u-stem': 'βασιλεύς',
  'noun-3-s-stem': 'γένος',
  'adj-adj-2-1-2': 'ἀγαθός',
  'adj-adj-3-1-3': 'πᾶς',
  'pronoun-ego': 'ἐγώ',
  'pronoun-autos': 'αὐτός',
  'pronoun-outos': 'οὗτος',
};

const CASE_CODE: Record<CaseKey, string> = { nom: 'N', gen: 'G', dat: 'D', acc: 'A', voc: 'V' };
const caseOfLabel = (label: string) => CASES.find((c) => CASE_LABELS[c] === label) as CaseKey;

interface Cell {
  /** `<case label>/<column>`, with the number for a table that groups its columns. */
  key: string;
  form: string;
  /** MorphGNT case, number and gender codes; gender is '' where the table has no gender columns. */
  case: string;
  number: string;
  gender: string;
}

/** Every cell of a table with the case, number and gender it claims to be. */
function cellsOf(id: string): Cell[] {
  const t = table(id);
  const out: Cell[] = [];
  for (const row of t.rows) {
    row.answers.forEach((form, ci) => {
      if (form === null) return;
      const hasGroups = t.colGroups !== undefined;
      const number = hasGroups ? NUMBERS[Math.floor(ci / GENDERS.length)] : NUMBERS[ci];
      const gender = hasGroups ? GENDERS[ci % GENDERS.length] : undefined;
      out.push({
        key: `${row.label}/${hasGroups ? `${number === 'sg' ? 'Sg' : 'Pl'} ` : ''}${t.cols[ci]}`,
        form,
        case: CASE_CODE[caseOfLabel(row.label)],
        number: number === 'sg' ? 'S' : 'P',
        gender: gender ? gender.toUpperCase() : '',
      });
    });
  }
  return out;
}

/**
 * Forms the New Testament does not use in that case, number and gender, though
 * they are the regular forms: the plurals of nouns it uses mostly in the
 * singular, the vocative of a few. None is a doubt about the Greek; each is a
 * form the text cannot vouch for, so a Greek instructor should confirm it
 * before release (#199). Everything not listed here is attested.
 */
const UNATTESTED: Record<string, string[]> = {
  'noun-2m-os': ['Voc/Singular=λόγε'],
  'noun-1f-alpha-impure': [
    'Nom/Plural=δόξαι',
    'Gen/Plural=δοξῶν',
    'Dat/Plural=δόξαις',
    'Voc/Plural=δόξαι',
  ],
  'noun-3-mute': ['Nom/Plural=σάρκες', 'Dat/Plural=σαρξίν', 'Voc/Plural=σάρκες'],
  'noun-3-i-stem': [
    'Nom/Plural=πίστεις',
    'Gen/Plural=πίστεων',
    'Dat/Plural=πίστεσιν',
    'Acc/Plural=πίστεις',
    'Voc/Singular=πίστι',
    'Voc/Plural=πίστεις',
  ],
  'noun-3-s-stem': ['Gen/Plural=γενῶν', 'Dat/Plural=γένεσιν'],
  'adj-adj-2-1-2': [
    'Nom/Pl Masc.=ἀγαθοί',
    'Nom/Pl Fem.=ἀγαθαί',
    'Gen/Pl Fem.=ἀγαθῶν',
    'Dat/Pl Fem.=ἀγαθαῖς',
    'Voc/Pl Masc.=ἀγαθοί',
    'Voc/Pl Fem.=ἀγαθαί',
  ],
  'pronoun-autos': ['Nom/Pl Fem.=αὐταί'],
};

describe.skipIf(!hasCorpus)(
  'the noun, adjective, article and pronoun rungs against the Greek New Testament',
  () => {
    const words = hasCorpus ? corpusWords() : [];

    for (const [id, lemma] of Object.entries(LEMMA)) {
      it(`${id}: every form is attested for ${lemma} in its case and number, or named as unattested`, () => {
        const missing: string[] = [];
        for (const cell of cellsOf(id)) {
          // 'ἐμοῦ / μου': the stressed and the short form are both forms of the cell.
          const alternates = cell.form.split(' / ').map((f) => plainForm(f));
          for (const form of alternates) {
            const found = words.some(
              (w) =>
                w.lemma === lemma &&
                w.form === form &&
                // MorphGNT tags a vocative only where it differs from the
                // nominative, so a vocative cell is attested by the form itself.
                (cell.case === 'V' || w.parsing[4] === cell.case) &&
                w.parsing[5] === cell.number &&
                (cell.gender === '' || w.parsing[6] === cell.gender),
            );
            if (!found) missing.push(`${cell.key}=${form}`);
          }
        }
        expect(missing).toEqual(UNATTESTED[id] ?? []);
      });
    }

    it('keeps UNATTESTED honest: a form listed there is really not in the text', () => {
      // A listed form that the text does attest means the list is stale, and a
      // stale list would let a later typo through under the same name.
      for (const [id, listed] of Object.entries(UNATTESTED)) {
        const lemma = LEMMA[id];
        for (const entry of listed) {
          const form = plainForm(entry.split('=')[1]);
          const cell = cellsOf(id).find((c) => `${c.key}=${plainForm(c.form)}` === entry);
          expect(cell, `${id} ${entry} is a cell of the table`).toBeDefined();
          const found = words.some(
            (w) =>
              w.lemma === lemma &&
              w.form === form &&
              (cell?.case === 'V' || w.parsing[4] === cell?.case) &&
              w.parsing[5] === cell?.number &&
              (cell?.gender === '' || w.parsing[6] === cell?.gender),
          );
          expect(found, `${id} ${entry} is attested after all`).toBe(false);
        }
      }
    });
  },
);

// ─── The verb rungs ───────────────────────────────────────────────────────────
//
// λύω is a model verb, and most of its forms are not in the New Testament, so
// the verb rungs are checked a different way: each form is split into the stem
// λυ and what follows (the tense formative and the ending), and that tail has
// to end an attested word of the same person, number, tense, voice and mood.
// That vouches for the endings and the formatives, which are what a student
// writes from memory. It cannot vouch for the stem, the augment, the
// reduplication or the accent of a form no verb in the text shares.

interface VerbRung {
  /** MorphGNT tense, then the voices that count, then mood. */
  tense: string;
  voices: string[];
  mood: string;
}

const VERB: Record<string, VerbRung> = {
  'verb-pres-act-ind': { tense: 'P', voices: ['A'], mood: 'I' },
  'verb-impf-act-ind': { tense: 'I', voices: ['A'], mood: 'I' },
  'verb-fut-act-ind': { tense: 'F', voices: ['A'], mood: 'I' },
  'verb-aor-act-ind': { tense: 'A', voices: ['A'], mood: 'I' },
  'verb-perf-act-ind': { tense: 'X', voices: ['A'], mood: 'I' },
  'verb-pres-mid-ind': { tense: 'P', voices: ['M', 'P'], mood: 'I' },
  'verb-aor-mid-ind': { tense: 'A', voices: ['M'], mood: 'I' },
  'verb-aor-pass-ind': { tense: 'A', voices: ['P'], mood: 'I' },
};

/** Letters after the stem, accents and breathings off: ἐλύσαμεν gives σαμεν. */
function tail(form: string): string[] {
  return form.split('(ν)').length > 1
    ? [tail(form.replace('(ν)', ''))[0], tail(form.replace('(ν)', 'ν'))[0]]
    : [bareLetters(form).replace(/^(ελυ|λελυ|λυ)/, '')];
}

const PERSON_OF_ROW: Record<string, string> = {
  '1st sg': '1S',
  '2nd sg': '2S',
  '3rd sg': '3S',
  '1st pl': '1P',
  '2nd pl': '2P',
  '3rd pl': '3P',
};

describe.skipIf(!hasCorpus)('the verb rungs against the endings of other verbs in the text', () => {
  const words = hasCorpus ? corpusWords() : [];

  for (const [id, rung] of Object.entries(VERB)) {
    it(`${id}: every ending is attested for its person and number`, () => {
      const missing: string[] = [];
      for (const row of table(id).rows) {
        const form = row.answers[0] as string;
        const person = PERSON_OF_ROW[row.label];
        expect(person, `${id} row ${row.label}`).toBeDefined();
        // Moveable nu: either spelling of the ending will do.
        const found = tail(form).some((ending) =>
          words.some(
            (w) =>
              w.parsing[0] === person[0] &&
              w.parsing[5] === person[1] &&
              w.parsing[1] === rung.tense &&
              rung.voices.includes(w.parsing[2]) &&
              w.parsing[3] === rung.mood &&
              bareLetters(w.form).endsWith(ending),
          ),
        );
        if (!found) missing.push(`${row.label}=${form}`);
      }
      expect(missing).toEqual([]);
    });
  }

  it('the present active participle: every ending is attested for its case, number and gender', () => {
    const missing: string[] = [];
    for (const cell of cellsOf('participle-pres-act-ptc')) {
      const found = tail(cell.form).some((ending) =>
        words.some(
          (w) =>
            w.parsing[1] === 'P' &&
            w.parsing[2] === 'A' &&
            w.parsing[3] === 'P' &&
            (cell.case === 'V' || w.parsing[4] === cell.case) &&
            w.parsing[5] === cell.number &&
            w.parsing[6] === cell.gender &&
            bareLetters(w.form).endsWith(ending),
        ),
      );
      if (!found) missing.push(`${cell.key}=${cell.form}`);
    }
    expect(missing).toEqual([]);
  });
});
