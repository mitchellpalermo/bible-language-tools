/**
 * GrammarReference — interactive grammar paradigm reference for Koine Greek.
 *
 * Sections: Nouns · Adjectives · Verbs · Contract Verbs · Liquid Verbs · Participles · Pronouns · Prepositions · Accent Rules
 *
 * Features:
 * - Sticky sidebar navigation (desktop) / horizontal scroll nav (mobile)
 * - Full-form / endings-only toggle on noun and adjective tables
 * - Verb paradigm tense × voice grid selector
 * - Sg/Pl toggle on wide tables (adjectives, gendered pronouns) for mobile
 * - Hover/tap tooltip showing grammatical description for each cell
 */

import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
import {
  accentSections,
  adjParadigms,
  CASE_DESCRIPTIONS,
  CASE_LABELS,
  CASES,
  type CaseKey,
  type ContractType,
  type ContractVerbParadigm,
  commonContractVerbs,
  contractionRules,
  contractVerbParadigms,
  genderedPronouns,
  getArticle,
  infinitiveForms,
  liquidFutureComparison,
  liquidPrincipalParts,
  type MiVerbEntry,
  type MiVerbId,
  type MiVerbParadigm,
  miVerbEntries,
  miVerbParadigms,
  type NounParadigm,
  NUM_LABELS,
  type NumKey,
  nounParadigms,
  type ParticipleParadigm,
  type ParticipleTense,
  PERSON_FULL_LABELS,
  PERSON_LABELS,
  PERSONS,
  type PersonalPronoun12,
  participleParadigms,
  personalPronouns12,
  prepositions,
  verbParadigms,
} from '../data/grammar';
import ErrorBoundary from './ErrorBoundary';
import {
  AdjParadigmCard,
  DescriptionBar,
  EndingsToggle,
  GenderedPronounCard,
  ParadigmHeading,
  ParticipleParadigmCard,
  SectionHeading,
  VerbParadigmGrid,
} from './grammar';
import type { Mood } from './grammar/VerbParadigmGrid';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_SECTIONS = [
  { id: 'nouns', label: 'Nouns', shortLabel: 'Nouns' },
  { id: 'adjectives', label: 'Adjectives', shortLabel: 'Adj' },
  { id: 'verbs', label: 'Verbs', shortLabel: 'Verbs' },
  { id: 'contract-verbs', label: 'Contract Verbs', shortLabel: 'Contract' },
  { id: 'liquid-verbs', label: 'Liquid Verbs', shortLabel: 'Liquid' },
  { id: 'mi-verbs', label: 'μι-Verbs', shortLabel: 'μι-Verbs' },
  { id: 'participles', label: 'Participles', shortLabel: 'Participles' },
  { id: 'pronouns', label: 'Pronouns', shortLabel: 'Pronouns' },
  { id: 'prepositions', label: 'Prepositions', shortLabel: 'Prepositions' },
  { id: 'accents', label: 'Accents', shortLabel: 'Accents' },
] as const;

const PARADIGM_NAV = NAV_SECTIONS.filter((s) =>
  [
    'nouns',
    'adjectives',
    'verbs',
    'contract-verbs',
    'liquid-verbs',
    'mi-verbs',
    'participles',
  ].includes(s.id),
);
const REFERENCE_NAV = NAV_SECTIONS.filter((s) =>
  ['pronouns', 'prepositions', 'accents'].includes(s.id),
);

// ---------------------------------------------------------------------------
// Noun paradigm table (kept inline — simple, not reused)
// ---------------------------------------------------------------------------

function NounParadigmCard({ paradigm }: { paradigm: NounParadigm }) {
  const [showEndings, setShowEndings] = useState(false);
  const [description, setDescription] = useState<string | null>(null);

  const handleCell = useCallback((caseKey: CaseKey, numKey: NumKey) => {
    setDescription(
      `${CASE_DESCRIPTIONS[caseKey].split(' — ')[0]} ${NUM_LABELS[numKey]} — ${CASE_DESCRIPTIONS[caseKey].split(' — ')[1]}`,
    );
  }, []);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--color-primary)' }}
      >
        <span className="text-sm font-semibold text-white">{paradigm.name}</span>
        <EndingsToggle showEndings={showEndings} onToggle={() => setShowEndings((v) => !v)} />
      </div>

      <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '4rem' }}
              />
              <th
                className="px-4 py-2 text-center font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Singular
              </th>
              <th
                className="px-4 py-2 text-center font-semibold text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Plural
              </th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c, i) => {
              const sgForm = paradigm.forms[c].sg;
              const plForm = paradigm.forms[c].pl;
              return (
                <tr
                  key={c}
                  style={{
                    background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                  }}
                >
                  <td
                    className="px-3 py-2 font-semibold text-xs uppercase tracking-wider cursor-default"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={() => setDescription(CASE_DESCRIPTIONS[c])}
                    onMouseLeave={() => setDescription(null)}
                  >
                    {CASE_LABELS[c]}
                  </td>
                  {(
                    [
                      ['sg', sgForm],
                      ['pl', plForm],
                    ] as [NumKey, typeof sgForm][]
                  ).map(([numKey, form]) => {
                    const article = !showEndings ? getArticle(c, numKey, paradigm.gender) : null;
                    return (
                      <td
                        key={numKey}
                        className="px-4 py-2 text-center font-greek text-base cursor-default rounded transition-colors"
                        style={{ color: 'var(--color-greek)' }}
                        onMouseEnter={() => handleCell(c, numKey)}
                        onMouseLeave={() => setDescription(null)}
                        onClick={() => handleCell(c, numKey)}
                      >
                        {showEndings ? (
                          form.ending
                        ) : (
                          <>
                            {article && (
                              <span
                                style={{ color: 'var(--color-text-muted)', marginRight: '0.2em' }}
                              >
                                {article}
                              </span>
                            )}
                            {form.full}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-3 pt-1" style={{ background: 'var(--color-bg-card)' }}>
        <DescriptionBar text={description} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verb section (uses extracted VerbParadigmGrid)
// ---------------------------------------------------------------------------

function VerbSection() {
  const [activeGroup, setActiveGroup] = useState<Mood>('indicative');
  const [activeId, setActiveId] = useState('pres-act-ind');
  const [description, setDescription] = useState<string | null>(null);

  const grouped = (['indicative', 'subjunctive', 'imperative'] as Mood[]).reduce(
    (acc, g) => ({ ...acc, [g]: verbParadigms.filter((p) => p.group === g) }),
    {} as Record<Mood, typeof verbParadigms>,
  );

  const activeParsed = verbParadigms.find((p) => p.id === activeId) ?? verbParadigms[0];

  return (
    <section id="verbs" className="mb-16">
      <SectionHeading id="verbs">Verbs — λύω</SectionHeading>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        All paradigms use λύω (I loose, release) as the model verb. Hover over any form to see its
        full parse.
      </p>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Paradigm grid selector */}
        <div className="md:shrink-0">
          <VerbParadigmGrid
            paradigms={verbParadigms}
            selectedId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              const paradigm = verbParadigms.find((p) => p.id === id);
              if (paradigm) setActiveGroup(paradigm.group as Mood);
            }}
            activeMood={activeGroup}
            onMoodChange={(mood) => {
              setActiveGroup(mood);
              setActiveId(grouped[mood][0].id);
            }}
            showFormPreview
          />
        </div>

        {/* Paradigm table */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-xl overflow-hidden shadow-sm"
            style={{ border: '1px solid #e5e7eb' }}
          >
            <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
              <span className="text-sm font-semibold text-white">{activeParsed.label}</span>
            </div>
            <div style={{ background: 'var(--color-bg-card)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
                    <th
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)', width: '5rem' }}
                    >
                      Person
                    </th>
                    <th
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Form
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERSONS.map((p, i) => {
                    const form = activeParsed.forms[p];
                    if (form === undefined) return null;
                    return (
                      <tr
                        key={p}
                        style={{
                          background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                        }}
                      >
                        <td
                          className="px-4 py-2 text-xs font-medium"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {PERSON_LABELS[p]}
                        </td>
                        <td
                          className="px-4 py-2 font-greek text-lg cursor-default"
                          style={{ color: 'var(--color-greek)' }}
                          onMouseEnter={() =>
                            setDescription(`${activeParsed.label} — ${PERSON_FULL_LABELS[p]}`)
                          }
                          onMouseLeave={() => setDescription(null)}
                          onClick={() =>
                            setDescription(`${activeParsed.label} — ${PERSON_FULL_LABELS[p]}`)
                          }
                        >
                          {form}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-3 pt-1" style={{ background: 'var(--color-bg-card)' }}>
              <DescriptionBar text={description} />
            </div>
          </div>
        </div>
      </div>

      {/* Infinitives */}
      <div className="mt-8 max-w-sm">
        <ParadigmHeading>Infinitives</ParadigmHeading>
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
            <span className="text-sm font-semibold text-white">Infinitives</span>
          </div>
          <table className="w-full text-sm" style={{ background: 'var(--color-bg-card)' }}>
            <tbody>
              {infinitiveForms.map(({ label, form }, i) => (
                <tr
                  key={label}
                  style={{
                    background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                  }}
                >
                  <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                  </td>
                  <td
                    className="px-4 py-2 font-greek text-base"
                    style={{ color: 'var(--color-greek)' }}
                  >
                    {form}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pronoun tables (1st/2nd person — kept inline, simple 2-column layout)
// ---------------------------------------------------------------------------

function PronounCard12({ pronoun }: { pronoun: PersonalPronoun12 }) {
  const [description, setDescription] = useState<string | null>(null);
  const cases = ['nom', 'gen', 'dat', 'acc'] as CaseKey[];

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
        <span className="text-sm font-semibold text-white">{pronoun.name}</span>
      </div>
      <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '4rem' }}
              />
              <th
                className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Singular
              </th>
              <th
                className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Plural
              </th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => (
              <tr
                key={c}
                style={{ background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)' }}
              >
                <td
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-default"
                  style={{ color: 'var(--color-text-muted)' }}
                  onMouseEnter={() => setDescription(CASE_DESCRIPTIONS[c])}
                  onMouseLeave={() => setDescription(null)}
                >
                  {CASE_LABELS[c]}
                </td>
                {(['sg', 'pl'] as NumKey[]).map((num) => (
                  <td
                    key={num}
                    className="px-4 py-2 text-center font-greek text-base cursor-default"
                    style={{ color: 'var(--color-greek)' }}
                    onMouseEnter={() =>
                      setDescription(
                        `${CASE_DESCRIPTIONS[c].split(' — ')[0]} ${NUM_LABELS[num]} — ${CASE_DESCRIPTIONS[c].split(' — ')[1]}`,
                      )
                    }
                    onMouseLeave={() => setDescription(null)}
                    onClick={() =>
                      setDescription(`${CASE_DESCRIPTIONS[c].split(' — ')[0]} ${NUM_LABELS[num]}`)
                    }
                  >
                    {pronoun.forms[num][c] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-3 pt-1" style={{ background: 'var(--color-bg-card)' }}>
        <DescriptionBar text={description} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prepositions (kept inline — simple card layout)
// ---------------------------------------------------------------------------

const PREP_CASE_LABELS: Record<string, string> = {
  gen: 'Genitive',
  dat: 'Dative',
  acc: 'Accusative',
};

const PREP_CASE_COLORS: Record<string, string> = {
  gen: '#1e3a5f',
  dat: '#7c3d12',
  acc: '#c49b3c',
};

function PrepCard({ entry }: { entry: (typeof prepositions)[number] }) {
  return (
    <div
      className="rounded-xl p-4 shadow-sm flex flex-col gap-2"
      style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
    >
      <div className="flex items-center gap-3">
        <span className="font-greek text-2xl" style={{ color: 'var(--color-greek)' }}>
          {entry.greek}
        </span>
        <div className="flex gap-1 flex-wrap">
          {entry.cases.map((c) => (
            <span
              key={c}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider text-white"
              style={{ background: PREP_CASE_COLORS[c] }}
            >
              {PREP_CASE_LABELS[c]}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {entry.cases.map((c) =>
          entry.glosses[c] ? (
            <p key={c} className="text-xs" style={{ color: 'var(--color-text)' }}>
              <span className="font-medium" style={{ color: PREP_CASE_COLORS[c] }}>
                +{PREP_CASE_LABELS[c]}:{' '}
              </span>
              {entry.glosses[c]}
            </p>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract verbs section
// ---------------------------------------------------------------------------

const _CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  alpha: 'α-contract — ἀγαπάω',
  epsilon: 'ε-contract — ποιέω',
  omicron: 'ο-contract — πληρόω',
};

const CONTRACT_TYPE_SHORT: Record<ContractType, string> = {
  alpha: 'α (ἀγαπάω)',
  epsilon: 'ε (ποιέω)',
  omicron: 'ο (πληρόω)',
};

function ContractionRulesCard() {
  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm mb-8"
      style={{ border: '1px solid #e5e7eb' }}
    >
      <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
        <span className="text-sm font-semibold text-white">Contraction Rules</span>
      </div>
      <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '5rem' }}
              >
                Following
              </th>
              {(['α-stem', 'ε-stem', 'ο-stem'] as const).map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contractionRules.map((rule, i) => (
              <tr
                key={rule.following}
                style={{ background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)' }}
              >
                <td
                  className="px-3 py-2 text-xs font-mono font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {rule.following}
                </td>
                <td
                  className="px-4 py-2 text-center font-greek text-base"
                  style={{ color: 'var(--color-greek)' }}
                >
                  {rule.alpha}
                </td>
                <td
                  className="px-4 py-2 text-center font-greek text-base"
                  style={{ color: 'var(--color-greek)' }}
                >
                  {rule.epsilon}
                </td>
                <td
                  className="px-4 py-2 text-center font-greek text-base"
                  style={{ color: 'var(--color-greek)' }}
                >
                  {rule.omicron}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractParadigmTable({ paradigm }: { paradigm: ContractVerbParadigm }) {
  const [description, setDescription] = useState<string | null>(null);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
        <span className="text-sm font-semibold text-white">{paradigm.label}</span>
      </div>
      <div style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
              <th
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '5rem' }}
              >
                Person
              </th>
              <th
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Contracted
              </th>
              <th
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Uncontracted
              </th>
            </tr>
          </thead>
          <tbody>
            {PERSONS.map((p, i) => {
              const contracted = paradigm.forms[p];
              const raw = paradigm.uncontracted[p];
              if (!contracted) return null;
              return (
                <tr
                  key={p}
                  style={{
                    background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                  }}
                >
                  <td
                    className="px-4 py-2 text-xs font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {PERSON_LABELS[p]}
                  </td>
                  <td
                    className="px-4 py-2 font-greek text-lg cursor-default"
                    style={{ color: 'var(--color-greek)' }}
                    onMouseEnter={() =>
                      setDescription(`${paradigm.label} — ${PERSON_FULL_LABELS[p]}`)
                    }
                    onMouseLeave={() => setDescription(null)}
                    onClick={() => setDescription(`${paradigm.label} — ${PERSON_FULL_LABELS[p]}`)}
                  >
                    {contracted}
                  </td>
                  <td
                    className="px-4 py-2 font-greek text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {raw ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 pb-3 pt-1" style={{ background: 'var(--color-bg-card)' }}>
        <DescriptionBar text={description} />
      </div>
    </div>
  );
}

function ContractVerbsSection() {
  const types: ContractType[] = ['alpha', 'epsilon', 'omicron'];
  const [activeType, setActiveType] = useState<ContractType>('alpha');

  const byType = types.reduce(
    (acc, t) => ({ ...acc, [t]: contractVerbParadigms.filter((p) => p.contractType === t) }),
    {} as Record<ContractType, ContractVerbParadigm[]>,
  );

  const [activeId, setActiveId] = useState(byType.alpha[0].id);

  const handleTypeChange = (t: ContractType) => {
    setActiveType(t);
    setActiveId(byType[t][0].id);
  };

  const activeParadigm =
    contractVerbParadigms.find((p) => p.id === activeId) ?? byType[activeType][0];

  const contractColors: Record<ContractType, string> = {
    alpha: 'var(--color-primary)',
    epsilon: '#7c3d12',
    omicron: '#166534',
  };

  return (
    <section id="contract-verbs" className="mb-16">
      <SectionHeading id="contract-verbs">Contract Verbs</SectionHeading>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Contract verbs have stems ending in α, ε, or ο. When these stem vowels meet the following
        ending vowel they merge according to fixed rules, producing forms that look nothing like the
        standard λύω paradigm. The contracted form is shown alongside the uncontracted form for
        comparison.
      </p>

      <ContractionRulesCard />

      {/* Contract type tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'rgba(30,58,95,0.07)' }}>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => handleTypeChange(t)}
            className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              activeType === t
                ? { background: contractColors[t], color: '#fff' }
                : { background: 'transparent', color: 'var(--color-text-muted)' }
            }
          >
            {CONTRACT_TYPE_SHORT[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-10">
        {/* Paradigm selector */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0 md:shrink-0 md:w-52">
          {byType[activeType].map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className="shrink-0 md:shrink md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
              style={
                activeId === p.id
                  ? { background: contractColors[activeType], color: '#fff' }
                  : { background: 'rgba(30,58,95,0.07)', color: 'var(--color-text)' }
              }
            >
              {p.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          <ContractParadigmTable paradigm={activeParadigm} />
        </div>
      </div>

      {/* Common GNT contract verbs */}
      <div>
        <ParadigmHeading>Common GNT Contract Verbs</ParadigmHeading>
        <div className="space-y-3">
          {types.map((t) => {
            const verbs = commonContractVerbs.filter((v) => v.type === t);
            return (
              <div key={t} className="flex flex-wrap items-center gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded shrink-0"
                  style={{
                    background: contractColors[t],
                    color: '#fff',
                    minWidth: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  {t === 'alpha' ? 'α' : t === 'epsilon' ? 'ε' : 'ο'}
                </span>
                {verbs.map((v) => (
                  <span
                    key={v.greek}
                    className="text-sm px-2.5 py-1 rounded-lg"
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid #e5e7eb',
                      color: 'var(--color-greek)',
                      fontFamily: 'var(--font-greek)',
                    }}
                    title={v.gloss}
                  >
                    {v.greek}
                    <span
                      className="ml-1.5 text-xs font-sans"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {v.gloss}
                    </span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Liquid verbs section
// ---------------------------------------------------------------------------

const LIQUID_AORIST_PATTERNS = [
  {
    title: 'Sigmatic Aorist with Stem Change',
    description: 'The σ drops but the stem vowel lengthens to compensate.',
    examples: [
      { verb: 'μένω', aorist: 'ἔμεινα', note: 'stem εν → ειν (compensatory lengthening)' },
      { verb: 'κρίνω', aorist: 'ἔκρινα', note: 'stem κριν-, augment + regular sigma-drop' },
      { verb: 'ἀποστέλλω', aorist: 'ἀπέστειλα', note: 'stem στελ → στειλ (lengthening)' },
    ],
  },
  {
    title: 'Asigmatic (2nd) Aorist',
    description: 'No sigma at all — uses a distinct stem with secondary active endings.',
    examples: [
      { verb: 'βάλλω', aorist: 'ἔβαλον', note: 'stem βαλ-, 2nd aorist endings (-ον, -ες, -ε…)' },
      {
        verb: 'ἀγγέλλω',
        aorist: 'ἤγγειλα',
        note: 'stem ἀγγελ → ἀγγειλ (1st aorist with lengthening)',
      },
    ],
  },
  {
    title: 'Stem + Augment Irregularity',
    description: 'Augment interacts with the stem, often with additional vowel changes.',
    examples: [
      { verb: 'αἴρω', aorist: 'ἦρα', note: 'stem ἀρ-, temporal augment α→η, no sigma' },
      { verb: 'ἐγείρω', aorist: 'ἤγειρα', note: 'temporal augment ε→η; stem ἐγερ-' },
    ],
  },
];

function LiquidVerbsSection() {
  return (
    <section id="liquid-verbs" className="mb-16">
      <SectionHeading id="liquid-verbs">Liquid Verbs</SectionHeading>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Liquid verbs have stems ending in λ, μ, ν, or ρ. They are irregular in the future and often
        in the aorist because the future-tense sigma (σ) is unstable between a liquid consonant and
        a vowel and drops out.
      </p>

      {/* Explainer callout */}
      <div
        className="rounded-xl p-4 mb-8 flex gap-3"
        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        <div className="shrink-0 mt-0.5">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--color-accent)' }}>
            σ-drop
          </span>
        </div>
        <div className="text-sm space-y-1" style={{ color: 'var(--color-text)' }}>
          <p>
            <strong>Why liquids are irregular:</strong> When σ is added to a liquid stem (e.g., βαλ
            + σ + ω), the σ is phonologically unstable between the liquid and the following vowel
            and drops out.
          </p>
          <p>
            <strong>The result:</strong> The future uses ε-contract endings instead of the standard
            -σω pattern (βαλ + ε → βαλέω type → contracts → βαλῶ, βαλεῖς, βαλεῖ…).
          </p>
        </div>
      </div>

      {/* Future comparison table */}
      <div className="mb-10">
        <ParadigmHeading>Future: Standard vs. Liquid</ParadigmHeading>
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
            <span className="text-sm font-semibold text-white">Future Active Indicative</span>
          </div>
          <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
                  <th
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', width: '5rem' }}
                  >
                    Person
                  </th>
                  <th
                    className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Standard — λύσω
                  </th>
                  <th
                    className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Liquid — βαλῶ
                  </th>
                </tr>
              </thead>
              <tbody>
                {liquidFutureComparison.map((row, i) => (
                  <tr
                    key={row.person}
                    style={{
                      background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                    }}
                  >
                    <td
                      className="px-4 py-2 text-xs font-medium"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {PERSON_LABELS[row.person]}
                    </td>
                    <td
                      className="px-4 py-2 text-center font-greek text-base"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {row.standard}
                    </td>
                    <td
                      className="px-4 py-2 text-center font-greek text-lg font-medium"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {row.liquid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Aorist patterns */}
      <div className="mb-10">
        <ParadigmHeading>Aorist Patterns</ParadigmHeading>
        <div className="space-y-4">
          {LIQUID_AORIST_PATTERNS.map((pattern, pi) => (
            <div
              key={pattern.title}
              className="rounded-xl p-4 shadow-sm"
              style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
            >
              <div className="flex items-start gap-2 mb-2">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ background: 'var(--color-accent)' }}
                >
                  {pi + 1}
                </span>
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {pattern.title}
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {pattern.description}
                  </p>
                </div>
              </div>
              <div className="space-y-1 ml-7">
                {pattern.examples.map((ex) => (
                  <div key={ex.verb} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-greek" style={{ color: 'var(--color-greek)' }}>
                      {ex.verb}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                    <span
                      className="font-greek font-medium"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {ex.aorist}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      ({ex.note})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Principal parts table */}
      <div>
        <ParadigmHeading>Common GNT Liquid Verbs — Principal Parts</ParadigmHeading>
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <div className="px-4 py-2.5" style={{ background: 'var(--color-primary)' }}>
            <span className="text-sm font-semibold text-white">Principal Parts</span>
          </div>
          <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
                  {[
                    'Verb',
                    'Gloss',
                    'Future',
                    'Aorist Act.',
                    'Perf. Act.',
                    'Perf. M/P',
                    'Aor. Pass.',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liquidPrincipalParts.map((verb, i) => (
                  <tr
                    key={verb.id}
                    style={{
                      background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                    }}
                  >
                    <td
                      className="px-3 py-2 font-greek text-base whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.lexical}
                    </td>
                    <td
                      className="px-3 py-2 text-xs whitespace-nowrap"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {verb.gloss}
                    </td>
                    <td
                      className="px-3 py-2 font-greek text-sm whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.future}
                    </td>
                    <td
                      className="px-3 py-2 font-greek text-sm whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.aoristAct}
                    </td>
                    <td
                      className="px-3 py-2 font-greek text-sm whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.perfectAct}
                    </td>
                    <td
                      className="px-3 py-2 font-greek text-sm whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.perfectMidPass}
                    </td>
                    <td
                      className="px-3 py-2 font-greek text-sm whitespace-nowrap"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {verb.aoristPass}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// μι-Verbs section
// ---------------------------------------------------------------------------

type MiVerbMood = 'indicative' | 'subjunctive' | 'imperative';

const MI_MOODS: MiVerbMood[] = ['indicative', 'subjunctive', 'imperative'];

const MI_MOOD_LABELS: Record<MiVerbMood, string> = {
  indicative: 'Indicative',
  subjunctive: 'Subjunctive',
  imperative: 'Imperative',
};

/** Tense abbreviations available per mood for μι-verbs (active only). */
const MI_TENSES_FOR_MOOD: Record<MiVerbMood, Array<{ key: string; label: string }>> = {
  indicative: [
    { key: 'pres', label: 'Pres' },
    { key: 'impf', label: 'Impf' },
    { key: 'aor', label: 'Aor' },
  ],
  subjunctive: [
    { key: 'pres', label: 'Pres' },
    { key: 'aor', label: 'Aor' },
  ],
  imperative: [
    { key: 'pres', label: 'Pres' },
    { key: 'aor', label: 'Aor' },
  ],
};

const MI_MOOD_SUFFIX: Record<MiVerbMood, string> = {
  indicative: 'ind',
  subjunctive: 'subj',
  imperative: 'imptv',
};

function MiVerbGrid({
  verbId,
  activeId,
  activeMood,
  onSelect,
  onMoodChange,
}: {
  verbId: MiVerbId;
  activeId: string;
  activeMood: MiVerbMood;
  onSelect: (id: string) => void;
  onMoodChange: (mood: MiVerbMood) => void;
}) {
  const tenses = MI_TENSES_FOR_MOOD[activeMood];

  return (
    <div>
      {/* Mood tabs — same pill-strip style as VerbParadigmGrid */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'rgba(30,58,95,0.07)' }}>
        {MI_MOODS.map((mood) => (
          <button
            key={mood}
            onClick={() => onMoodChange(mood)}
            className="flex-1 px-4 py-1.5 rounded-md text-sm font-medium text-center transition-colors"
            style={
              activeMood === mood
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { background: 'transparent', color: 'var(--color-text-muted)' }
            }
          >
            {MI_MOOD_LABELS[mood]}
          </button>
        ))}
      </div>

      {/* Tense selector — full-width pill matching the mood tab strip above */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(30,58,95,0.07)' }}>
        {tenses.map(({ key: tense, label }) => {
          const cellId = `${verbId}-${tense}-${MI_MOOD_SUFFIX[activeMood]}`;
          const isSelected = activeId === cellId;
          return (
            <button
              key={tense}
              onClick={() => onSelect(cellId)}
              className="flex-1 px-4 py-1.5 rounded-md text-sm font-medium text-center transition-colors"
              style={
                isSelected
                  ? { background: 'var(--color-primary)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--color-text-muted)' }
              }
              title={`${label} Active ${MI_MOOD_LABELS[activeMood]}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiVerbConjugationCard({ paradigm }: { paradigm: MiVerbParadigm }) {
  const [description, setDescription] = useState<string | null>(null);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #e5e7eb' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--color-primary)' }}
      >
        <span className="text-sm font-semibold text-white">{paradigm.label}</span>
      </div>
      {description && (
        <div
          className="px-4 py-2 text-xs"
          style={{ background: 'rgba(30,58,95,0.06)', color: 'var(--color-text-muted)' }}
        >
          {description}
        </div>
      )}
      <div style={{ background: 'var(--color-bg-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(30,58,95,0.04)' }}>
              <th
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', width: '5.5rem' }}
              >
                Person
              </th>
              <th
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {PERSONS.map((pn, i) => {
              const form = paradigm.forms[pn];
              if (form === undefined) return null;
              return (
                <tr
                  key={pn}
                  className="cursor-pointer transition-colors hover:bg-blue-50"
                  style={{
                    background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.02)',
                  }}
                  onClick={() => setDescription(PERSON_FULL_LABELS[pn])}
                  title={PERSON_FULL_LABELS[pn]}
                >
                  <td
                    className="px-4 py-2 text-xs font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {PERSON_LABELS[pn]}
                  </td>
                  <td
                    className="px-4 py-2 font-greek text-lg"
                    style={{ color: 'var(--color-greek)' }}
                  >
                    {form}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiVerbCard({ entry }: { entry: MiVerbEntry }) {
  const verbParadigms = miVerbParadigms.filter((p) => p.verbId === entry.id);
  const [activeMood, setActiveMood] = useState<MiVerbMood>('indicative');
  const [activeId, setActiveId] = useState(verbParadigms[0]?.id ?? '');

  const handleMoodChange = (mood: MiVerbMood) => {
    setActiveMood(mood);
    const first = verbParadigms.find((p) => p.group === mood);
    if (first) setActiveId(first.id);
  };

  const activeParadigm = verbParadigms.find((p) => p.id === activeId) ?? verbParadigms[0];

  return (
    <div
      className="rounded-xl p-5 shadow-sm"
      style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
    >
      {/* Verb header */}
      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <span className="font-greek text-2xl font-semibold" style={{ color: 'var(--color-greek)' }}>
          {entry.lexical}
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {entry.gloss}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(30,58,95,0.08)', color: 'var(--color-primary)' }}
        >
          {entry.gntCount}× GNT
        </span>
      </div>

      {/* Pattern notes */}
      <ul className="mb-5 space-y-1">
        {entry.patternNotes.map((note, i) => (
          <li key={i} className="flex gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
              style={{ background: 'var(--color-accent)' }}
            >
              {i + 1}
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ul>

      {/* Paradigm selector + table */}
      <div className="mb-5">
        <ParadigmHeading>Conjugation</ParadigmHeading>
        <div className="mb-3">
          <MiVerbGrid
            verbId={entry.id}
            activeId={activeId}
            activeMood={activeMood}
            onSelect={setActiveId}
            onMoodChange={handleMoodChange}
          />
        </div>
        {activeParadigm && <MiVerbConjugationCard paradigm={activeParadigm} />}
      </div>

      {/* Infinitives */}
      <div className="mb-5">
        <ParadigmHeading>Infinitives</ParadigmHeading>
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
                  {['Tense / Voice', 'Infinitive'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.infinitives.map((inf, i) => (
                  <tr
                    key={inf.label}
                    style={{
                      background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                    }}
                  >
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {inf.label}
                    </td>
                    <td
                      className="px-4 py-2 font-greek text-lg"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {inf.form}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Participle nom sg */}
      <div>
        <ParadigmHeading>Participle — Nom Sg</ParadigmHeading>
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: '1px solid #e5e7eb' }}
        >
          <div className="overflow-x-auto" style={{ background: 'var(--color-bg-card)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(30,58,95,0.06)' }}>
                  {['Tense / Voice', 'Masc.', 'Fem.', 'Neut.'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.participleNomSg.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      background: i % 2 === 0 ? 'var(--color-bg-card)' : 'rgba(30,58,95,0.03)',
                    }}
                  >
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {row.label}
                    </td>
                    <td
                      className="px-4 py-2 font-greek text-lg"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {row.m}
                    </td>
                    <td
                      className="px-4 py-2 font-greek text-lg"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {row.f}
                    </td>
                    <td
                      className="px-4 py-2 font-greek text-lg"
                      style={{ color: 'var(--color-greek)' }}
                    >
                      {row.n}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiVerbsSection() {
  const [activeVerbId, setActiveVerbId] = useState<MiVerbId>('didomi');
  const activeEntry = miVerbEntries.find((e) => e.id === activeVerbId) ?? miVerbEntries[0];

  return (
    <section id="mi-verbs" className="mb-16">
      <SectionHeading id="mi-verbs">μι-Verb Paradigms</SectionHeading>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        μι-verbs follow a different conjugation pattern from the standard ω-verbs: they use no
        thematic vowel, reduplicate the initial consonant in the present, and show stem alternation
        between singular and plural. These four verbs account for over 800 occurrences combined in
        the Greek New Testament (GNT).
      </p>

      {/* Verb tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {miVerbEntries.map((e) => (
          <button
            key={e.id}
            onClick={() => setActiveVerbId(e.id)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors font-greek"
            style={
              activeVerbId === e.id
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { background: 'rgba(30,58,95,0.08)', color: 'var(--color-primary)' }
            }
          >
            {e.lexical}
          </button>
        ))}
      </div>

      <MiVerbCard key={activeVerbId} entry={activeEntry} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Participles section
// ---------------------------------------------------------------------------

const TENSE_LABELS: Record<ParticipleTense, string> = {
  present: 'Present',
  future: 'Future',
  aorist: 'Aorist',
  perfect: 'Perfect',
};

const TENSE_ORDER: ParticipleTense[] = ['present', 'future', 'aorist', 'perfect'];

function ParticipleSection() {
  const byTense = TENSE_ORDER.reduce(
    (acc, t) => ({ ...acc, [t]: participleParadigms.filter((p) => p.tense === t) }),
    {} as Record<ParticipleTense, ParticipleParadigm[]>,
  );

  const [activeTense, setActiveTense] = useState<ParticipleTense>('present');
  const [activeId, setActiveId] = useState<string>(participleParadigms[0].id);

  const activeParadigm =
    participleParadigms.find((p) => p.id === activeId) ?? participleParadigms[0];

  return (
    <section id="participles" className="mb-16">
      <SectionHeading id="participles">Participles — λύω</SectionHeading>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Participles are verbal adjectives: they carry tense and voice from the verb but decline for
        case, number, and gender like adjectives. Present and Perfect use combined Middle/Passive
        forms; Aorist and Future distinguish Middle from Passive.
      </p>

      {/* Tense tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {TENSE_ORDER.map((tense) => (
          <button
            key={tense}
            onClick={() => {
              setActiveTense(tense);
              setActiveId(byTense[tense][0].id);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={
              activeTense === tense
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { background: 'rgba(30,58,95,0.08)', color: 'var(--color-primary)' }
            }
          >
            {TENSE_LABELS[tense]}
          </button>
        ))}
      </div>

      {/* Voice buttons for active tense */}
      <div className="flex flex-wrap gap-2 mb-4">
        {byTense[activeTense].map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={
              activeId === p.id
                ? { background: 'var(--color-accent)', color: '#fff' }
                : {
                    background: 'rgba(30,58,95,0.05)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid #e5e7eb',
                  }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <ParticipleParadigmCard paradigm={activeParadigm} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function GrammarReferenceInner() {
  const [activeSection, setActiveSection] = useState<string>('nouns');

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    posthog.capture('grammar_section_viewed', { section: id });
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-8 relative">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-44 shrink-0">
        <nav className="sticky top-6 space-y-0.5">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(s.id);
              }}
              className="block px-3 py-2 rounded-lg text-sm transition-colors font-medium"
              style={
                activeSection === s.id
                  ? { background: 'rgba(30,58,95,0.1)', color: 'var(--color-primary)' }
                  : { color: 'var(--color-text-muted)' }
              }
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        {/* Mobile sticky section nav — segmented rows */}
        <div
          className="lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2"
          style={{ background: 'var(--color-bg)', borderBottom: '1px solid #e5e7eb' }}
        >
          {(
            [
              ['Paradigms', PARADIGM_NAV],
              ['Reference', REFERENCE_NAV],
            ] as const
          ).map(([group, items]) => (
            <div key={group} className="mb-1 last:mb-0">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {group}
              </span>
              <div className="flex gap-1 mt-0.5">
                {items.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(s.id);
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
                    style={
                      activeSection === s.id
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'rgba(30,58,95,0.07)', color: 'var(--color-text-muted)' }
                    }
                  >
                    {s.shortLabel}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Nouns */}
        <section id="nouns" className="mb-16">
          <SectionHeading id="nouns">Noun Declensions</SectionHeading>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Toggle between full inflected forms and endings only. Hover over any cell to see its
            case description.
          </p>
          <div className="space-y-6">
            {nounParadigms.map((p) => (
              <NounParadigmCard key={p.id} paradigm={p} />
            ))}
          </div>
        </section>

        {/* Adjectives */}
        <section id="adjectives" className="mb-16">
          <SectionHeading id="adjectives">Adjectives</SectionHeading>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            The 2-1-2 pattern follows 2nd declension (masc./neut.) and 1st declension (fem.). The
            3-1-3 pattern uses 3rd declension for masc./neut. and 1st for fem.
          </p>
          <div className="space-y-6">
            {adjParadigms.map((p) => (
              <AdjParadigmCard key={p.id} paradigm={p} />
            ))}
          </div>
        </section>

        {/* Verbs */}
        <VerbSection />

        {/* Contract Verbs */}
        <ContractVerbsSection />

        {/* Liquid Verbs */}
        <LiquidVerbsSection />

        {/* μι-Verbs */}
        <MiVerbsSection />

        {/* Participles */}
        <ParticipleSection />

        {/* Pronouns */}
        <section id="pronouns" className="mb-16">
          <SectionHeading id="pronouns">Pronouns</SectionHeading>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Personal, demonstrative, relative, and interrogative pronouns. Hover over cells for case
            descriptions.
          </p>
          <div className="space-y-6">
            {personalPronouns12.map((p) => (
              <PronounCard12 key={p.id} pronoun={p} />
            ))}
            {genderedPronouns.map((p) => (
              <GenderedPronounCard key={p.id} pronoun={p} />
            ))}
          </div>
        </section>

        {/* Prepositions */}
        <section id="prepositions" className="mb-16">
          <SectionHeading id="prepositions">Prepositions</SectionHeading>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            All GNT prepositions grouped by the case(s) they govern. The case badge color indicates:
            <span className="ml-2 font-semibold" style={{ color: '#1e3a5f' }}>
              Genitive
            </span>
            <span className="mx-2">·</span>
            <span className="font-semibold" style={{ color: '#7c3d12' }}>
              Dative
            </span>
            <span className="mx-2">·</span>
            <span className="font-semibold" style={{ color: '#c49b3c' }}>
              Accusative
            </span>
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prepositions.map((p) => (
              <PrepCard key={p.greek} entry={p} />
            ))}
          </div>
        </section>

        {/* Accent rules */}
        <section id="accents" className="mb-16">
          <SectionHeading id="accents">Accent Rules</SectionHeading>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            A structured summary of Greek accentuation for reference while reading.
          </p>
          <div className="space-y-5">
            {accentSections.map((section) => (
              <div
                key={section.title}
                className="rounded-xl p-5 shadow-sm"
                style={{ background: 'var(--color-bg-card)', border: '1px solid #e5e7eb' }}
              >
                <h3 className="font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.rules.map((rule, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm"
                      style={{ color: 'var(--color-text)' }}
                    >
                      <span
                        className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {i + 1}
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
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
