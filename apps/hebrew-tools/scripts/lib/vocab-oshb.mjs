/**
 * Pure logic for re-sourcing the textbook vocabulary from the Open Scriptures
 * Hebrew Bible (issue #109).
 *
 * The authority is split. The course handout keeps the two things only it knows
 * — which words belong to which chapter and section, and the gloss wording the
 * chapter quiz is marked against. OSHB supplies the Hebrew side: the pointed
 * form, the root, the part of speech, the Strong's number and the frequency.
 *
 * No I/O lives here — `build-vocabulary.mjs` reads and writes, this module
 * decides. Everything below is a pure function over already-parsed data, which
 * is what makes the matching rules testable without a 24 MB corpus on disk.
 */

import { stripCantillation } from './oshb.mjs';

/**
 * Maqqef is a hyphen, not orthography: the lexicon writes בַּת־שֶׁבַע and the
 * handout's `.docx` extraction dropped the mark entirely. Normalizing it away on
 * both sides is what lets the two meet; the *lexicon's* spelling is then the one
 * that ships, so the mark comes back.
 */
const MAQQEF = /־/g;

/**
 * The comparison key for a Hebrew headword.
 *
 * NFC matters more than it looks: the handout writes bet + tsere + dagesh and the
 * lexicon writes bet + dagesh + tsere. They are the same word and the same
 * codepoints in a different order, and only canonical composition says so.
 */
export function normalizeHeadword(text) {
  return stripCantillation(text.normalize('NFC')).replace(MAQQEF, '');
}

/**
 * Strong's numbers, minus the augmentation letter.
 *
 * OSHB splits a lexeme's BDB senses across `5892a` / `5892b`, both of which are
 * עִיר "city". Those are one word for a student and their counts add; `5893` is a
 * different word that happens to be spelled the same and its count does not.
 */
export function baseStrong(id) {
  return id.replace(/[a-z]$/, '');
}

/**
 * A handout entry's identity, matching the app's `cardKey`: the headword, plus
 * the sense for the handful of homographs that would otherwise be one card. It
 * is what a pin and an accepted exception are keyed by, so an adjudication about
 * אַף "nose" cannot quietly cover אַף "also".
 */
export function entryKey(entry) {
  return entry.sense ? `${entry.hebrew}#${entry.sense}` : entry.hebrew;
}

/**
 * The spelling to put on a card.
 *
 * A maqqef *between* two words is part of the name — בַּת־שֶׁבַע is not בַּתשֶׁבַע.
 * A maqqef at either end is not: the lexicon writes מִן־ and פֶּן־ to show that
 * they lean on the next word, and a card front ending in a hyphen is just a
 * dangling mark.
 */
export function displayForm(text) {
  return stripCantillation(text.normalize('NFC')).replace(/^־+|־+$/g, '');
}

/** Lexicon part-of-speech code → the app's `partOfSpeech` string. */
const POS_LABEL = {
  N: 'noun',
  Ng: 'noun',
  Np: 'proper noun',
  V: 'verb',
  A: 'adjective',
  Ag: 'adjective',
  Ao: 'adjective',
  C: 'conjunction',
  D: 'adverb',
  R: 'preposition',
  P: 'particle',
  Pd: 'particle',
  Pf: 'particle',
  Pi: 'particle',
  Pp: 'particle',
  Pr: 'particle',
  T: 'particle',
  Td: 'particle',
  Ti: 'particle',
  Tj: 'particle',
  Tm: 'particle',
  To: 'particle',
};

export function posLabel(code) {
  return code ? POS_LABEL[code] : undefined;
}

/**
 * Which lexicon codes a handout part of speech is willing to accept.
 *
 * This is a *preference*, not a gate. The handout's own part of speech was
 * inferred from the shape of the gloss and is wrong often enough to be useless as
 * a filter — it calls עַם a preposition and אֵם a conjunction — but it is still
 * the only signal that separates אַף "also" (a particle) from אַף "nose" (a noun)
 * when both spellings are identical. So it breaks ties and never rejects.
 */
const POS_HINT_COMPAT = {
  noun: ['N', 'Ng'],
  'proper noun': ['Np', 'Ng', 'Ag'],
  verb: ['V'],
  adjective: ['A', 'Ao', 'Ag'],
  adverb: ['D', 'T', 'Tj'],
  conjunction: ['C', 'T', 'Tj', 'Pr'],
  preposition: ['R'],
  particle: ['T', 'Td', 'Ti', 'Tj', 'Tm', 'To', 'P', 'Pd', 'Pf', 'Pi', 'Pp', 'Pr', 'C', 'D', 'R'],
};

function hintAccepts(hint, code) {
  return Boolean(code) && (POS_HINT_COMPAT[hint] ?? []).includes(code);
}

/**
 * Two candidate lexemes are "too close to call" when the winner is less than
 * this many times the size of the runner-up. Such a headword must be pinned to a
 * Strong's number by hand rather than decided by a count — עָנָה "answer" (328)
 * against עָנָה "be afflicted" (83) is a coin toss dressed up as a measurement.
 */
export const AMBIGUITY_RATIO = 4;

// ─── Indexes ─────────────────────────────────────────────────────────────────

/**
 * Lexicon citation form → the lemma entries written that way.
 *
 * A hit here means the handout headword *is* a dictionary headword, which is the
 * only case where a frequency makes sense: the count belongs to the lexeme, and
 * an inflected form that happens to be listed would borrow a number that is not
 * about it.
 */
export function buildLexiconIndex(lemmas) {
  const index = new Map();
  for (const [id, entry] of Object.entries(lemmas)) {
    if (!entry.hebrew) continue;
    const key = normalizeHeadword(entry.hebrew);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ id, ...entry });
  }
  return index;
}

/**
 * The head morpheme's position in a stack of morph codes: the last segment that
 * is neither a suffix nor the definite article. Same rule as `oshb.mjs`'s
 * `headMorph`, applied to positions rather than codes, because here we want the
 * matching slice of `text`.
 */
function headSegmentIndex(codes) {
  for (let i = codes.length - 1; i >= 0; i--) {
    if (!codes[i].startsWith('S') && codes[i] !== 'Td') return i;
  }
  return codes.length - 1;
}

/**
 * Attested surface form → the lemmas that form occurs as, with occurrence counts.
 *
 * This is the index that makes the exercise worth doing. `בְּרִיח → בְּרִית` stops
 * being inferred from the entry's own construct form and becomes *the spelling
 * occurs in the Westminster Leningrad Codex and the other one does not*. It also
 * catches every headword the handout lists as an inflected or derived-stem form —
 * וַיֹּאמֶר, נִשְׁמַר, הוֹצִיא — which are real Hebrew and simply not dictionary
 * headwords.
 *
 * Both the whole word and its head morpheme are indexed, so a headword matches
 * whether or not the corpus happens to write it with a prefix attached.
 *
 * `pairs` holds maqqef-joined neighbours (בֵּית־אֵל), which the corpus stores as
 * two `<w>` elements and no single-word index can reach.
 */
export function buildFormIndex(books) {
  const forms = new Map();
  const pairs = new Map();

  const add = (index, text, lemma) => {
    const key = normalizeHeadword(text);
    if (!key || !lemma) return;
    let entry = index.get(key);
    if (!entry) {
      // Keep a representative spelling: the key has had maqqef stripped out of
      // it, so it cannot be shown to a student as-is.
      entry = { form: displayForm(text), lemmas: new Map() };
      index.set(key, entry);
    }
    entry.lemmas.set(lemma, (entry.lemmas.get(lemma) ?? 0) + 1);
  };

  for (const book of books) {
    for (const chapter of Object.values(book)) {
      for (const verse of Object.values(chapter)) {
        for (const [i, word] of verse.entries()) {
          // A ketiv is written without pointing. Indexing it would let a bare
          // consonantal string match a pointed headword and claim it is attested.
          const text = word.qere ?? (word.ketiv ? '' : word.text);
          if (!text) continue;

          const segments = text.split('/');
          const codes = word.parsing.replace(/^[HA]/, '').split('/').filter(Boolean);
          add(forms, segments.join(''), word.lemma);
          if (segments.length > 1 && segments.length === codes.length) {
            add(forms, segments[headSegmentIndex(codes)], word.lemma);
          }

          const next = verse[i + 1];
          if (word.after?.includes('־') && next && !next.ketiv) {
            add(pairs, `${segments.join('')}־${next.text.split('/').join('')}`, next.lemma);
          }
        }
      }
    }
  }

  return { forms, pairs };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/** Group candidates by base Strong's number and rank them by total count. */
function rankGroups(candidates, hint) {
  const groups = new Map();
  for (const candidate of candidates) {
    const base = baseStrong(candidate.id);
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(candidate);
  }

  return [...groups.entries()]
    .map(([base, members]) => {
      const preferred = members.filter((m) => hintAccepts(hint, m.pos));
      const counted = preferred.length > 0 ? preferred : members;
      return {
        base,
        members,
        preferred: preferred.length > 0,
        count: counted.reduce((total, m) => total + m.count, 0),
        head: [...counted].sort((a, b) => b.count - a.count)[0],
      };
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.count - a.count);
}

/**
 * The group a Strong's pin names.
 *
 * Usually it is one of the ranked candidates and the pin is only overruling the
 * counts. Sometimes it is not: תּוֹר "turtle-dove" is a plene spelling of תֹּר
 * (8449), and the three lexemes the lexicon *does* write תּוֹר are all something
 * else. A pin has to be able to say so, so a Strong's number that names no
 * candidate is built from the lexicon directly rather than silently ignored.
 */
function pinnedGroup(pin, ranked, lemmas, hint) {
  const base = baseStrong(pin);
  const found = ranked.find((g) => g.base === base);
  if (found) return found;

  const members = Object.entries(lemmas)
    .filter(([id]) => baseStrong(id) === base)
    .map(([id, entry]) => ({ id, ...entry }));
  if (members.length === 0) throw new Error(`Strong's pin ${pin} is not in the lemma index`);
  return rankGroups(members, hint)[0];
}

/**
 * Resolve one handout headword against OSHB.
 *
 * Statuses:
 *   `lexicon`   the headword is a dictionary headword — takes the lexicon's
 *               spelling, the lexeme's frequency, root, part of speech and gender
 *   `corpus`    the headword is attested in the WLC but is not a citation form,
 *               so it is an inflected or derived-stem card. Takes the root and
 *               part of speech of the lemma it inflects; **no frequency**, since
 *               the card is about the form and the count is about the lexeme
 *   `collision` the handout calls it a verb and every lemma spelled that way is
 *               something else — הִלֵּל the Piel against הִלֵּל the man. Not a match
 *   `absent`    the spelling occurs nowhere in the WLC. Either a handout typo or
 *               a paradigm form the corpus never happens to use
 */
export function resolveHeadword(entry, { lexicon, forms, pairs, lemmas, pins = {} }) {
  const key = normalizeHeadword(entry.hebrew);
  const pinKey = entryKey(entry);
  const hint = entry.posHint;

  const lexHits = lexicon.get(key) ?? [];
  const attested = forms.get(key) ?? pairs.get(key);

  let candidates;
  let status;
  if (lexHits.length > 0) {
    candidates = lexHits;
    status = 'lexicon';
  } else if (attested) {
    candidates = [...attested.lemmas].map(([id, occurrences]) => ({
      id,
      ...(lemmas[id] ?? {}),
      // Rank corpus candidates by how often *this form* resolves to them, not by
      // how common the lexeme is overall.
      count: occurrences,
    }));
    status = 'corpus';
  } else {
    return { status: 'absent', key };
  }

  if (hint === 'verb' && !candidates.some((c) => c.pos === 'V')) {
    return { status: 'collision', key, candidates: candidates.map((c) => c.id) };
  }

  const ranked = rankGroups(candidates, hint);
  const pinned = pins[pinKey] ? pinnedGroup(pins[pinKey], ranked, lemmas, hint) : undefined;
  const chosen = pinned ?? ranked[0];
  const runnerUp = ranked.find((g) => g !== chosen);
  const ambiguous =
    !pinned && Boolean(runnerUp) && chosen.count < AMBIGUITY_RATIO * runnerUp.count;

  const head = chosen.head;
  const lemma = lemmas[head.id] ?? {};
  return {
    status,
    key,
    ambiguous,
    strong: head.id,
    // A corpus match keeps the form the student is being shown; only a citation
    // form carries the lexeme's count.
    frequency: status === 'lexicon' ? chosen.count : undefined,
    hebrew: status === 'lexicon' ? displayForm(head.hebrew) : attested.form,
    root: lemma.root,
    pos: posLabel(lemma.pos),
    gender: lemma.gender,
    ranked: ranked.map((g) => ({ strong: g.base, count: g.count })),
  };
}

/**
 * Whether the card is about a *form* rather than a lexeme.
 *
 * The Inflected and Reading sections quiz recognition of the word as a passage
 * writes it — וַיֹּאמֶר, חֶפְצוֹ, תּוֹר in Song 2:12 — so the front stays the
 * handout's spelling even when the lexeme resolves. תֹּר is the right citation
 * form for the turtle-dove and the wrong thing to show a student reading a plene
 * text, and שֹׁפְטִים "judges" inflects a lemma OSHB codes as a verb. Spelling and
 * part of speech therefore stay with the handout here, and no frequency is set:
 * the count is a fact about the lexeme and the card is about the form. The root
 * and the Strong's number still come from OSHB — knowing that וַיֹּאמֶר is אמר is
 * exactly what the card is teaching.
 */
function isFormCard(entry) {
  const categories = entry.chapters.map((tag) => tag.split(':')[1]);
  return categories.length > 0 && categories.every((c) => c === 'inflected' || c === 'reading');
}

/**
 * Fold one resolution into its handout entry, producing a `HebrewVocabWord`.
 *
 * The handout wins on everything English and everything editorial: the gloss, the
 * construct form, the irregular plural, the note, the chapter tags. It also wins
 * on `gender` where it prints one, even against the corpus — the corpus says יָד
 * is attested masculine and feminine, and it is, but the gender card is marked
 * against Garrett. Those disagreements are returned rather than dropped.
 */
export function mergeEntry(entry, resolution) {
  const resolved = resolution.status === 'lexicon' || resolution.status === 'corpus';
  const word = {
    hebrew: resolved && !isFormCard(entry) ? resolution.hebrew : entry.hebrew.normalize('NFC'),
  };
  if (entry.sense) word.sense = entry.sense;
  if (resolved && resolution.root) word.root = resolution.root;
  if (resolved) word.strong = resolution.strong;
  word.gloss = entry.gloss;
  if (resolved && !isFormCard(entry) && resolution.frequency !== undefined) {
    word.frequency = resolution.frequency;
  }
  // A form card's part of speech is the handout's too: שֹׁפְטִים "judges" inflects
  // a lemma OSHB codes as a verb, and it is a noun on the card that shows it.
  word.partOfSpeech = (resolved && !isFormCard(entry) && resolution.pos) || entry.posHint;
  // The lexicon carries a gender for anything ever coded as a common noun, which
  // includes particles that occasionally are — אֵין is one. A gender on a
  // non-noun card is noise at best and a wrong quiz answer at worst.
  const corpusGender =
    resolved && word.partOfSpeech === 'noun' ? resolution.gender : undefined;
  const gender = entry.gender ?? corpusGender;
  if (gender) word.gender = gender;
  if (entry.binyan) word.binyan = entry.binyan;
  if (entry.construct) word.construct = entry.construct;
  if (entry.plural) word.plural = entry.plural;
  if (entry.alternates) word.alternates = entry.alternates;
  if (entry.stems) word.stems = entry.stems;
  if (entry.note) word.note = entry.note;
  word.chapters = entry.chapters;

  const divergence =
    entry.gender && corpusGender && entry.gender !== corpusGender
      ? { hebrew: word.hebrew, textbook: entry.gender, corpus: corpusGender }
      : undefined;

  return { word, divergence };
}

// ─── Emitting ────────────────────────────────────────────────────────────────

const CHAPTER_REF = /^(\d+):(.+)$/;

function chapterTags(chapters) {
  return chapters
    .map((tag) => {
      const match = CHAPTER_REF.exec(tag);
      if (!match) throw new Error(`Malformed chapter tag: ${tag}`);
      return `gd(${match[1]}, '${match[2]}')`;
    })
    .join(', ');
}

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function literal(word) {
  const fields = [];
  const push = (name, value) => {
    if (value !== undefined) fields.push(`${name}: ${value}`);
  };
  push('hebrew', quote(word.hebrew));
  push('sense', word.sense && quote(word.sense));
  push('root', word.root && quote(word.root));
  push('strong', word.strong && quote(word.strong));
  push('gloss', quote(word.gloss));
  push('frequency', word.frequency);
  push('partOfSpeech', quote(word.partOfSpeech));
  push('gender', word.gender && quote(word.gender));
  push('binyan', word.binyan && quote(word.binyan));
  push('construct', word.construct && quote(word.construct));
  push('plural', word.plural && quote(word.plural));
  push('alternates', word.alternates && `[${word.alternates.map(quote).join(', ')}]`);
  push(
    'stems',
    word.stems &&
      `[${word.stems
        .map(
          (s) =>
            `{ stem: ${quote(s.stem)}${s.form ? `, form: ${quote(s.form)}` : ''}, gloss: ${quote(s.gloss)} }`,
        )
        .join(', ')}]`,
  );
  push('note', word.note && quote(word.note));
  push('chapters', `[${chapterTags(word.chapters)}]`);
  return `  { ${fields.join(', ')} },`;
}

const record = (entries, fields) =>
  entries
    .map((e) => `  { ${fields.map((f) => `${f}: ${quote(e[f])}`).join(', ')} },`)
    .join('\n');

/** Render the whole generated module. */
export function emitModule({
  words,
  corrections,
  editorialNotes,
  unmatched,
  respellings,
  divergences,
}) {
  return `${HEADER}
/** Divergences from the printed handout, and why each one is a correction. */
export const CORRECTIONS: { printed: string; corrected: string; reason: string }[] = [
${record(corrections, ['printed', 'corrected', 'reason'])}
];

/**
 * Changes that are not a respelling: a stem printed in the wrong entry's cell,
 * and a gloss the handout left blank. Listed apart from \`CORRECTIONS\` because
 * they cannot be expressed as one Hebrew string standing in for another.
 */
export const EDITORIAL_NOTES: { entry: string; change: string; reason: string }[] = [
${record(editorialNotes, ['entry', 'change', 'reason'])}
];

/**
 * Entries that resolve to no OSHB lemma, keyed by \`cardKey\`, and why each one is
 * accepted.
 *
 * The build fails on an unmatched entry that is not on this list, so a future
 * regeneration cannot quietly lose a word's Hebrew data. Every reason here is a
 * fact about the lexicon or the corpus, never about the handout.
 */
export const OSHB_UNMATCHED: { entry: string; reason: string }[] = [
${record(unmatched, ['entry', 'reason'])}
];

/**
 * Headwords whose spelling is OSHB's rather than the handout's, where the two
 * differ by more than the order of their combining marks.
 *
 * Not corrections — the handout is not wrong, it is less precise. These are the
 * cases where taking the lexeme's own form changes what a student sees, so the
 * difference from the printed page stays on the record.
 */
export const OSHB_RESPELLINGS: { printed: string; oshb: string; strong: string }[] = [
${record(respellings, ['printed', 'oshb', 'strong'])}
];

/**
 * Nouns where the textbook prints one gender and the corpus attests another.
 *
 * The textbook's value is the one on the card, because the gender card is marked
 * against the textbook. Every entry below is the same shape — Garrett prints a
 * single gender for a noun the Westminster Leningrad Codex uses both ways.
 */
export const GENDER_DIVERGENCES: { hebrew: string; textbook: string; corpus: string }[] = [
${record(divergences, ['hebrew', 'textbook', 'corpus'])}
];

export const GARRETT_VOCABULARY: HebrewVocabWord[] = [
${words.map(literal).join('\n')}
];
`;
}

const HEADER = `// Garrett & DeRouchie chapter vocabulary — GENERATED, do not hand-edit.
//
// Two sources, and the split between them is the point.
//
//   * The course's consolidated vocabulary handout for Beginning Hebrew
//     (20400WW), covering chapters 2-31 of \`A Modern Grammar for Biblical
//     Hebrew\`, extracted once into \`scripts/data/garrett-handout.json\`. It owns
//     the chapter and section mapping, the gloss wording, the construct form, the
//     irregular plural, the per-stem glosses and the entry notes.
//   * The Open Scriptures Hebrew Bible, via \`public/data/morphhb/\`. It owns the
//     Hebrew: the pointed form, the root, the part of speech, the Strong's number
//     and the frequency.
//
// The handout is a Word document that has been through a scan-and-retype cycle,
// which makes it the worst available authority on pointed text and the best
// available authority on what the quiz expects. Glosses therefore stay with it —
// Strong's gives חָצֵר as "a yard, a hamlet, enclosure, court, tower, village"
// where Garrett gives "village, courtyard", and the chapter quiz is marked
// against Garrett.
//
// A headword resolves one of three ways. Most are dictionary headwords and take
// the lexicon's spelling and the lexeme's frequency. Around a fifth are inflected
// or derived-stem forms — וַיֹּאמֶר, נִשְׁמַר, הוֹצִיא — which are attested in the
// Westminster Leningrad Codex but are not citation forms: they keep their
// spelling and their root and get no frequency, because the card is about the
// form and the count would be about the lexeme. The rest are listed in
// \`OSHB_UNMATCHED\` with a reason.
//
// \`transliteration\` is still absent: OSHB carries no romanization, and inventing
// ~500 SBL forms by hand would bake in errors the data tests cannot catch.
//
// Regenerating: \`pnpm build:vocab\`, which needs \`public/data/morphhb/\` (run
// \`pnpm build:data\` first). Fix the handout JSON or the build script; hand-edits
// to this file are lost.

// \`gd\` comes from vocabulary-types, not textbooks: textbooks.ts reads the
// merged vocabulary at module scope, so importing it from there would make this
// file part of a cycle and \`gd\` would be undefined when these literals evaluate.
import { gd, type HebrewVocabWord } from './vocabulary-types';
`;
