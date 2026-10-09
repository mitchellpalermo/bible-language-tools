/**
 * GrammarReference — the reference tables behind `/grammar` (ROADMAP Phase 6,
 * issue #79). Modeled on greek-tools' component of the same name.
 *
 * Sections so far: Alphabet · Vowels · Nouns · The Article · Prepositions ·
 * Qal Verb. The rest of Phase 6 lands a
 * section at a time; adding one is an entry in `NAV_SECTIONS` and a `<section>`
 * below, and both navs pick it up.
 *
 * What is Hebrew here rather than plumbing:
 *
 * - **The page is LTR chrome around RTL runs.** Every Hebrew string goes
 *   through `<Hebrew>`, which carries its own `dir="rtl"` — a bare Hebrew word
 *   in a table cell takes its direction from its neighbours. Tables themselves
 *   stay LTR: the labels are English and are read first.
 * - **The verb tables render `verb-paradigms.ts` as stored, stress mark and
 *   all.** That file is also the paradigm quiz's answer key, so the table a
 *   student studies and the key they are marked against are one set of forms.
 *   The quiz strips the stress mark to grade; a reference should show it.
 */

import posthog from 'posthog-js';
import { useState } from 'react';
import {
  ALPHABET_LETTER_COUNT,
  dageshKinds,
  type Letter,
  letterGroups,
  letters,
  shevaRules,
  VOWEL_CLASS_LABELS,
  VOWEL_CLASSES,
  VOWEL_LENGTH_LABELS,
  VOWEL_LENGTHS,
  type Vowel,
  vowelsAt,
} from '../data/grammar';
import {
  articleIrregulars,
  articleNotes,
  articleRules,
  type Example,
  type FormRule,
  independentPrepositions,
  inseparablePrepositions,
  inseparableRules,
  minRules,
  NOUN_ENDINGS,
  NOUN_FORM_LABELS,
  NOUN_GENDER_LABELS,
  NOUN_NUMBER_LABELS,
  NOUN_NUMBERS,
  NOUN_STATE_LABELS,
  NOUN_STATES,
  type NounGroup,
  nounGroups,
  nounNotes,
  prepositionNotes,
} from '../data/grammar-nominal';
import {
  CONJUGATION_LABELS,
  CONJUGATION_PGNS,
  type Conjugation,
  type Pgn,
  paradigmsFor,
  pgnLabel,
  STEM_LABELS,
  VERB_CLASS_LABELS,
  type VerbParadigm,
} from '../data/verb-paradigms';
import ErrorBoundary from './ErrorBoundary';

// ─── Sections ─────────────────────────────────────────────────────────────────

export const NAV_SECTIONS = [
  { id: 'alphabet', label: 'Alphabet' },
  { id: 'vowels', label: 'Vowels' },
  { id: 'nouns', label: 'Nouns' },
  { id: 'article', label: 'The Article' },
  { id: 'prepositions', label: 'Prepositions' },
  { id: 'qal-verb', label: 'Qal Verb' },
] as const;

type SectionId = (typeof NAV_SECTIONS)[number]['id'];

const CONJUGATIONS = Object.keys(CONJUGATION_LABELS) as Conjugation[];

// ─── Building blocks ──────────────────────────────────────────────────────────

/** A Hebrew run inside the page's English chrome. */
function Hebrew({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span
      dir="rtl"
      lang="he"
      className={`text-hebrew ${className}`}
      style={{ fontFamily: 'var(--font-hebrew)' }}
    >
      {children}
    </span>
  );
}

const HEBREW_RUN = /([\u0590-\u05FF]+(?:\s+[\u0590-\u05FF]+)*)/;

/**
 * English prose that mentions Hebrew.
 *
 * The notes in `grammar.ts` are plain strings — "ר is not a guttural" — and a
 * Hebrew run dropped raw into an English sentence is ordered by the bidi
 * algorithm against whatever punctuation happens to sit beside it, in the UI
 * font. Splitting the runs out gives each its own direction and the Hebrew face.
 */
function Prose({ children }: { children: string }) {
  return children.split(HEBREW_RUN).map((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one string are positional
    i % 2 === 1 ? <Hebrew key={i}>{part}</Hebrew> : part,
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={`${id}-heading`}
      className="text-2xl font-bold mb-2 pb-2 border-b-2 border-accent text-primary"
    >
      {children}
    </h2>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-primary/10 bg-bg-card">
      {/* A Hebrew run in the title would otherwise be green on green. */}
      <h3 className="px-4 py-2.5 text-sm font-semibold text-white bg-primary [&_[lang=he]]:text-white">
        <Prose>{title}</Prose>
      </h3>
      {children}
    </div>
  );
}

const TH =
  'px-2 sm:px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider text-text-muted';
const TD = 'px-2 sm:px-3 py-2 align-baseline';

/** Abbreviations for column headers, which four Hebrew columns leave no room for on a phone. */
const SHORT_LABELS: Record<string, string> = {
  masculine: 'Masc.',
  feminine: 'Fem.',
  singular: 'Sg.',
  plural: 'Pl.',
  dual: 'Du.',
  absolute: 'abs.',
  construct: 'cstr.',
};

/**
 * A header word that abbreviates below `sm`. The abbreviation is hidden from
 * assistive tech and the full word is only visually hidden, so the column is
 * always announced in full.
 */
function HeaderWord({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden="true" className="sm:hidden">
        {SHORT_LABELS[children.toLowerCase()] ?? children}
      </span>
      <span className="sr-only sm:not-sr-only">{children}</span>
    </>
  );
}

/** Dotted circle — the conventional stand-in for "any consonant" under a bare point. */
const PLACEHOLDER = '\u25CC';

/**
 * A bare ending or prefix. One that starts with a vowel point is shown on a
 * dotted circle, since a point with nothing under it renders as a stray tick.
 */
function affixText(affix: string): string {
  return /^[\u05B0-\u05BC]/.test(affix) ? PLACEHOLDER + affix : affix;
}

function Notes({ notes }: { notes: string[] }) {
  return (
    <ul className="px-4 py-3 space-y-2 list-disc list-inside marker:text-accent">
      {notes.map((note) => (
        <li key={note} className="text-sm text-text-muted">
          <Prose>{note}</Prose>
        </li>
      ))}
    </ul>
  );
}

/** "מֶלֶךְ → הַמֶּלֶךְ the king" — the starting word only where the rule changes it. */
function ExampleLine({ example }: { example: Example }) {
  return (
    <span className="whitespace-nowrap">
      {example.from && (
        <>
          <Hebrew className="text-lg text-text-muted">{example.from}</Hebrew>
          <span aria-hidden="true" className="mx-1 text-text-muted">
            →
          </span>
          <span className="sr-only">becomes</span>
        </>
      )}
      <Hebrew className="text-lg">{example.hebrew}</Hebrew>{' '}
      <span className="text-xs text-text-muted">{example.gloss}</span>
    </span>
  );
}

/** One rule per row: when it applies, what is written, why, and examples. */
function RuleList({ rules }: { rules: FormRule[] }) {
  return (
    <ul className="divide-y divide-primary/5">
      {rules.map((rule) => (
        <li key={rule.id} className="px-4 py-3 sm:flex sm:items-baseline sm:gap-4">
          <div className="sm:w-56 shrink-0">
            <p className="text-sm font-semibold text-text">
              <Prose>{rule.when}</Prose>
            </p>
            <p className="text-base font-semibold">
              <Prose>{rule.form}</Prose>
            </p>
          </div>
          <div className="mt-1 sm:mt-0">
            <p className="text-sm text-text-muted">
              <Prose>{rule.note}</Prose>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {rule.examples.map((example) => (
                <ExampleLine key={example.hebrew} example={example} />
              ))}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A two-column glossary: the word, and what it means. */
function GlossList({ entries }: { entries: Example[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-4 py-2">
      {entries.map((entry) => (
        <div
          key={`${entry.hebrew}-${entry.gloss}`}
          className="flex items-baseline gap-3 py-1.5 border-b border-primary/5"
        >
          <dt className="w-20 shrink-0">
            <Hebrew className="text-xl">{entry.hebrew}</Hebrew>
          </dt>
          <dd className="text-sm text-text-muted">{entry.gloss}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Alphabet ─────────────────────────────────────────────────────────────────

/** "b" for most letters; "b / v" for one whose sound depends on the dot. */
function letterTranslit(letter: Letter): string {
  return letter.begadkephat
    ? `${letter.translit} / ${letter.begadkephat.softTranslit}`
    : letter.translit;
}

function letterSound(letter: Letter): string {
  const soft = letter.begadkephat?.softSound;
  return soft ? `${letter.sound}; without the dot, ${soft}` : letter.sound;
}

function AlphabetSection() {
  return (
    <section id="alphabet" aria-labelledby="alphabet-heading" className="mb-16 scroll-mt-16">
      <SectionHeading id="alphabet">Alphabet</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        {ALPHABET_LETTER_COUNT} consonants, written right to left. Shin and sin are one letter told
        apart by a dot, and each has a row.
      </p>

      <div className="space-y-6">
        <Card title="The consonants">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/5">
                  <th scope="col" className={TH}>
                    Letter
                  </th>
                  <th scope="col" className={TH}>
                    Final
                  </th>
                  <th scope="col" className={TH}>
                    Name
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sm:hidden">Translit.</span>
                    <span className="hidden sm:inline">Transliteration</span>
                  </th>
                  <th scope="col" className={`${TH} hidden sm:table-cell`}>
                    Sound
                  </th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => (
                  <tr key={letter.char} className="border-t border-primary/5">
                    <td className={TD}>
                      <Hebrew className="text-2xl leading-tight">
                        {letter.begadkephat
                          ? `${letter.begadkephat.hard} ${letter.char}`
                          : letter.char}
                      </Hebrew>
                    </td>
                    <td className={TD}>
                      {letter.final && (
                        <Hebrew className="text-2xl leading-tight">{letter.final}</Hebrew>
                      )}
                    </td>
                    <th scope="row" className={`${TD} text-left font-medium text-text`}>
                      {letter.name}
                      {/* The sound has no column on a phone, so it rides here. */}
                      <span className="block sm:hidden text-xs font-normal text-text-muted">
                        {letterSound(letter)}
                      </span>
                    </th>
                    <td className={`${TD} text-text-muted italic whitespace-nowrap`}>
                      {letterTranslit(letter)}
                    </td>
                    <td className={`${TD} text-text-muted hidden sm:table-cell`}>
                      {letterSound(letter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Letters that behave alike">
          <ul className="divide-y divide-primary/5">
            {letterGroups.map((group) => (
              <li key={group.id} className="px-4 py-3 sm:flex sm:items-baseline sm:gap-4">
                <div className="sm:w-56 shrink-0">
                  <p className="text-sm font-semibold text-text">{group.name}</p>
                  <Hebrew className="text-xl">{group.letters.join(' ')}</Hebrew>
                </div>
                <p className="text-sm text-text-muted mt-1 sm:mt-0">
                  <Prose>{group.note}</Prose>
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="The dagesh">
          <div className="grid sm:grid-cols-2 sm:divide-x divide-primary/5">
            {dageshKinds.map((kind) => (
              <div key={kind.id} className="px-4 py-3 border-t border-primary/5 sm:border-t-0">
                <p className="text-sm font-semibold text-text">{kind.name}</p>
                <p className="mt-1">
                  <Hebrew className="text-2xl">{kind.example}</Hebrew>
                  <span className="text-xs text-text-muted ms-2">{kind.exampleGloss}</span>
                </p>
                <p className="text-sm text-text mt-2">
                  <Prose>{kind.does}</Prose>
                </p>
                <p className="text-sm text-text-muted mt-1">
                  <Prose>{kind.where}</Prose>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─── Vowels ───────────────────────────────────────────────────────────────────

function VowelEntry({ vowel }: { vowel: Vowel }) {
  return (
    <div className="flex flex-col items-start sm:flex-row sm:items-baseline sm:gap-2 py-1">
      <Hebrew className="text-2xl leading-tight sm:w-9 shrink-0 sm:text-center">
        {vowel.display}
      </Hebrew>
      <span className="text-sm text-text">
        {vowel.name} <span className="text-text-muted italic">{vowel.translit}</span>
      </span>
    </div>
  );
}

function VowelsSection() {
  const noted = VOWEL_LENGTHS.flatMap((length) =>
    VOWEL_CLASSES.flatMap((vowelClass) => vowelsAt(vowelClass, length)),
  ).filter((v) => v.note);

  return (
    <section id="vowels" aria-labelledby="vowels-heading" className="mb-16 scroll-mt-16">
      <SectionHeading id="vowels">Vowels</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        Vowels are points written around a consonant, shown here on פ. The hatephs stand under
        gutturals, so they are shown on א.
      </p>

      <div className="space-y-6">
        <Card title="The vowel chart">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/5">
                  <th scope="col" className={TH}>
                    <span className="sr-only">Length</span>
                  </th>
                  {VOWEL_CLASSES.map((vowelClass) => (
                    <th key={vowelClass} scope="col" className={TH}>
                      {VOWEL_CLASS_LABELS[vowelClass]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VOWEL_LENGTHS.map((length) => (
                  <tr key={length} className="border-t border-primary/5">
                    <th
                      scope="row"
                      className={`${TD} text-left text-xs font-semibold text-text-muted w-20 sm:w-40`}
                    >
                      {VOWEL_LENGTH_LABELS[length]}
                    </th>
                    {VOWEL_CLASSES.map((vowelClass) => (
                      <td key={vowelClass} className={`${TD} sm:min-w-36`}>
                        {vowelsAt(vowelClass, length).map((vowel) => (
                          <VowelEntry key={vowel.name} vowel={vowel} />
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {noted.map((vowel) => (
            <p
              key={vowel.name}
              className="px-4 py-2 text-xs text-text-muted border-t border-primary/5"
            >
              <span className="font-semibold capitalize">{vowel.name}.</span>{' '}
              <Prose>{vowel.note ?? ''}</Prose>
            </p>
          ))}
        </Card>

        <Card title="Sheva — vocal or silent">
          <div className="grid sm:grid-cols-2 sm:divide-x divide-primary/5">
            {(['vocal', 'silent'] as const).map((kind) => (
              <div key={kind} className="px-4 py-3 border-t border-primary/5 sm:border-t-0">
                <p className="text-sm font-semibold text-text">
                  {kind === 'vocal' ? 'Vocal — a hurried ə' : 'Silent — closes a syllable'}
                </p>
                <ul className="mt-2 space-y-2">
                  {shevaRules
                    .filter((rule) => rule.kind === kind)
                    .map((rule) => (
                      <li key={rule.rule} className="text-sm text-text-muted">
                        <Prose>{rule.rule}</Prose>{' '}
                        <span className="whitespace-nowrap">
                          <Hebrew className="text-lg">{rule.example}</Hebrew>{' '}
                          <span className="text-xs">{rule.exampleGloss}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─── Nouns ────────────────────────────────────────────────────────────────────

function NounEndingsCard() {
  return (
    <Card title="The endings">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th scope="col" className={TH}>
                <span className="sr-only">Number</span>
              </th>
              {(['m', 'f'] as const).flatMap((gender) =>
                NOUN_STATES.map((state) => (
                  <th key={`${gender}-${state}`} scope="col" className={TH}>
                    <span className="block">
                      <HeaderWord>{NOUN_GENDER_LABELS[gender]}</HeaderWord>
                    </span>
                    <span className="block font-normal normal-case tracking-normal">
                      <HeaderWord>{NOUN_STATE_LABELS[state]}</HeaderWord>
                    </span>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {NOUN_NUMBERS.map((number) => (
              <tr key={number} className="border-t border-primary/5">
                <th scope="row" className={`${TD} text-left text-xs font-semibold text-text-muted`}>
                  {NOUN_NUMBER_LABELS[number]}
                </th>
                {(['m', 'f'] as const).flatMap((gender) =>
                  NOUN_STATES.map((state) => {
                    const ending = NOUN_ENDINGS[gender][number][state];
                    return (
                      <td key={`${gender}-${state}`} className={TD}>
                        {ending ? (
                          <Hebrew className="text-xl leading-tight">{affixText(ending)}</Hebrew>
                        ) : (
                          <span className="text-text-muted">
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">no ending</span>
                          </span>
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NounGroupCard({ group }: { group: NounGroup }) {
  return (
    <Card title={group.title}>
      <p className="px-4 py-2 text-sm text-text-muted border-b border-primary/5">
        <Prose>{group.note}</Prose>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/5">
              <th scope="col" className={TH}>
                <span className="sr-only">Noun</span>
              </th>
              {group.columns.map((key) => {
                const [number, state] = NOUN_FORM_LABELS[key].split(' ');
                return (
                  <th key={key} scope="col" className={TH}>
                    <span className="block">
                      <HeaderWord>{number}</HeaderWord>
                    </span>
                    <span className="block font-normal normal-case tracking-normal">
                      <HeaderWord>{state}</HeaderWord>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {group.nouns.map((noun) => (
              <tr key={noun.id} className="border-t border-primary/5">
                <th scope="row" className={`${TD} text-left text-xs font-normal text-text-muted`}>
                  <span className="block font-semibold">{noun.gloss}</span>
                  {NOUN_GENDER_LABELS[noun.gender].toLowerCase()}
                </th>
                {group.columns.map((key) => (
                  <td key={key} className={`${TD} whitespace-nowrap`}>
                    <Hebrew className="text-lg sm:text-xl leading-tight">
                      {noun.forms[key] ?? ''}
                    </Hebrew>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NounsSection() {
  return (
    <section id="nouns" aria-labelledby="nouns-heading" className="mb-16 scroll-mt-16">
      <SectionHeading id="nouns">Nouns</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        A noun has a gender, a number, and a state. The ending shows all three; what happens to the
        vowels in front of it is the part worth learning by pattern.
      </p>
      <div className="space-y-6">
        <NounEndingsCard />
        {nounGroups.map((group) => (
          <NounGroupCard key={group.id} group={group} />
        ))}
        <Card title="Worth remembering">
          <Notes notes={nounNotes} />
        </Card>
      </div>
    </section>
  );
}

// ─── The article ──────────────────────────────────────────────────────────────

function ArticleSection() {
  return (
    <section id="article" aria-labelledby="article-heading" className="mb-16 scroll-mt-16">
      <SectionHeading id="article">The Article</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        <Prose>
          The article is הַ and a doubling of the letter that follows. Every other form is what
          happens when that letter cannot be doubled.
        </Prose>
      </p>
      <div className="space-y-6">
        <Card title="Forms of the article">
          <RuleList rules={articleRules} />
        </Card>
        <Card title="Nouns that change with the article">
          <p className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
            {articleIrregulars.map((example) => (
              <ExampleLine key={example.hebrew} example={example} />
            ))}
          </p>
        </Card>
        <Card title="Worth remembering">
          <Notes notes={articleNotes} />
        </Card>
      </div>
    </section>
  );
}

// ─── Prepositions ─────────────────────────────────────────────────────────────

function PrepositionsSection() {
  return (
    <section
      id="prepositions"
      aria-labelledby="prepositions-heading"
      className="mb-16 scroll-mt-16"
    >
      <SectionHeading id="prepositions">Prepositions</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        <Prose>
          Three prepositions are written as a prefix, מִן is written either way, and the rest stand
          as words of their own.
        </Prose>
      </p>
      <div className="space-y-6">
        <Card title="The inseparable prepositions">
          <GlossList entries={inseparablePrepositions} />
          <RuleList rules={inseparableRules} />
        </Card>
        <Card title="מִן — from">
          <RuleList rules={minRules} />
        </Card>
        <Card title="Independent prepositions">
          <GlossList entries={independentPrepositions} />
        </Card>
        <Card title="Worth remembering">
          <Notes notes={prepositionNotes} />
        </Card>
      </div>
    </section>
  );
}

// ─── Qal verb ─────────────────────────────────────────────────────────────────

/** "קטל (strong)" over "kill" — or just the root, for a verb that is its own class. */
function ParadigmHeader({ paradigm }: { paradigm: VerbParadigm }) {
  const className = VERB_CLASS_LABELS[paradigm.verbClass];
  return (
    <th scope="col" className={`${TH} normal-case tracking-normal`}>
      <Hebrew className="text-base font-bold">{paradigm.root}</Hebrew>
      <span className="block font-normal">
        {className === paradigm.root ? (
          paradigm.gloss
        ) : (
          <>
            <Prose>{className}</Prose>
            <span className="block">{paradigm.gloss}</span>
          </>
        )}
      </span>
    </th>
  );
}

function describeForm(paradigm: VerbParadigm, pgn: Pgn): string {
  return `${STEM_LABELS[paradigm.stem]} ${paradigm.conjugation} ${pgn} — ${pgnLabel(pgn)}, from ${paradigm.root} (${paradigm.gloss}). ${paradigm.source}.`;
}

function QalVerbSection() {
  const [conjugation, setConjugation] = useState<Conjugation>('qatal');
  const [description, setDescription] = useState<string | null>(null);
  const paradigms = paradigmsFor(conjugation);

  const select = (next: Conjugation) => {
    setConjugation(next);
    setDescription(null);
    posthog.capture('hebrew_grammar_conjugation_viewed', { conjugation: next });
  };

  return (
    <section id="qal-verb" aria-labelledby="qal-verb-heading" className="mb-16 scroll-mt-16">
      <SectionHeading id="qal-verb">Qal Verb</SectionHeading>
      <p className="text-sm mb-6 text-text-muted">
        The strong verb beside the classes that depart from it. Forms are printed with the
        textbook&rsquo;s stress mark where the accent falls before the last syllable.
      </p>

      <div role="tablist" aria-label="Conjugation" className="flex flex-wrap gap-2 mb-4">
        {CONJUGATIONS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`conjugation-tab-${id}`}
            aria-selected={conjugation === id}
            aria-controls="conjugation-panel"
            onClick={() => select(id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              conjugation === id
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-text-muted hover:bg-primary/15'
            }`}
          >
            {CONJUGATION_LABELS[id]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="conjugation-panel"
        aria-labelledby={`conjugation-tab-${conjugation}`}
      >
        <Card title={`${STEM_LABELS.qal} ${CONJUGATION_LABELS[conjugation]}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/5">
                  <th scope="col" className={TH}>
                    <span className="sr-only">Person, gender, number</span>
                  </th>
                  {paradigms.map((paradigm) => (
                    <ParadigmHeader key={paradigm.id} paradigm={paradigm} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONJUGATION_PGNS[conjugation].map((pgn) => (
                  <tr key={pgn} className="border-t border-primary/5">
                    <th
                      scope="row"
                      title={pgnLabel(pgn)}
                      className={`${TD} text-left text-xs font-semibold text-text-muted w-12`}
                    >
                      {pgn}
                    </th>
                    {paradigms.map((paradigm) => {
                      const form = paradigm.forms[pgn];
                      return (
                        <td key={paradigm.id} className={`${TD} whitespace-nowrap`}>
                          {form && (
                            <button
                              type="button"
                              aria-label={`${form} — ${pgnLabel(pgn)}`}
                              onClick={() => setDescription(describeForm(paradigm, pgn))}
                              onMouseEnter={() => setDescription(describeForm(paradigm, pgn))}
                              className="rounded px-1 -mx-1 hover:bg-accent/15 transition-colors"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <Hebrew className="text-lg sm:text-xl leading-tight">{form}</Hebrew>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            aria-live="polite"
            className={`px-4 py-2 text-xs text-text-muted border-t border-primary/5 min-h-8 ${
              description ? '' : 'opacity-60'
            }`}
          >
            {description ?? 'Tap or hover over a form to see what it is.'}
          </p>
        </Card>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function GrammarReferenceInner() {
  const [activeSection, setActiveSection] = useState<SectionId>(NAV_SECTIONS[0].id);

  const handleNavClick = (id: SectionId) => {
    setActiveSection(id);
    posthog.capture('hebrew_grammar_section_viewed', { section: id });
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navLink = (id: SectionId, label: string, className: string) => (
    <a
      key={id}
      href={`#${id}`}
      aria-current={activeSection === id ? 'true' : undefined}
      onClick={(e) => {
        e.preventDefault();
        handleNavClick(id);
      }}
      className={className}
    >
      {label}
    </a>
  );

  return (
    <div className="flex gap-8 relative">
      {/* Sidebar — desktop, and an iPad in landscape */}
      <aside className="hidden lg:block w-44 shrink-0">
        <nav aria-label="Grammar sections" className="sticky top-6 space-y-0.5">
          {NAV_SECTIONS.map((s) =>
            navLink(
              s.id,
              s.label,
              `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === s.id ? 'bg-primary/10 text-primary' : 'text-text-muted'
              }`,
            ),
          )}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Sticky pill row — phones, and an iPad in portrait */}
        <nav
          aria-label="Grammar sections"
          className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 mb-6 flex gap-1.5 overflow-x-auto bg-bg border-b border-primary/10"
        >
          {NAV_SECTIONS.map((s) =>
            navLink(
              s.id,
              s.label,
              `px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === s.id ? 'bg-primary text-white' : 'bg-primary/10 text-text-muted'
              }`,
            ),
          )}
        </nav>

        <AlphabetSection />
        <VowelsSection />
        <NounsSection />
        <ArticleSection />
        <PrepositionsSection />
        <QalVerbSection />
      </div>
    </div>
  );
}

export default function GrammarReference() {
  return (
    <ErrorBoundary component="GrammarReference">
      <GrammarReferenceInner />
    </ErrorBoundary>
  );
}
