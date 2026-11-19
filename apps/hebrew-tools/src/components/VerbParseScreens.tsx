// The two screens of a Hebrew parse (#82): a verb form with its fields, and
// its marks after checking. /parse deals them a session at a time
// (`VerbParse.tsx`); /daily asks them of the verbs in today's verse, inside the
// shared inline quiz (`DailyVerseParse.tsx`). The rules for grading are in
// `src/lib/verb-parse.ts`; the progress bar, choices and marks are
// `@tools/shared/components/ParseDrill`.

import {
  ParseFeedbackRow,
  ParseProgress,
  ParseSelect,
  ParseVerdict,
} from '@tools/shared/components/ParseDrill';
import type { ParseProperty } from '@tools/shared/parse-drill';
import { type ReactNode, useEffect, useState } from 'react';
import type { GlossIndex } from '../data/morphhb';
import { fetchGlosses } from '../data/morphhb';
import { glossFor, stemSenses } from '../lib/gloss';
import { applyFinalForms } from '../lib/hebrew-input';
import {
  CONJUGATION_NAMES,
  describeReading,
  fieldsFor,
  GENDER_LABELS,
  isComplete,
  NUMBER_LABELS,
  PARSE_CONJUGATIONS,
  PARSE_GENDERS,
  PARSE_NUMBERS,
  PARSE_PERSONS,
  PARSE_STATES,
  PARSE_STEMS,
  type ParseAnswer,
  type ParseConjugation,
  type ParseFieldKey,
  type ParseGrade,
  type ParseItem,
  type ParseLemma,
  PERSON_LABELS,
  primaryReading,
  STATE_LABELS,
  STEM_LABELS,
  type VerbReading,
  withConjugation,
} from '../lib/verb-parse';
import { TypedAnswerField } from './TypedAnswer';

export const PRIMARY_BUTTON =
  'w-full py-3 rounded-xl text-base font-bold bg-primary text-white hover:opacity-90 transition-opacity';
export const DISABLED_BUTTON =
  'w-full py-3 rounded-xl text-base font-bold bg-bg-card text-text-muted';
export const CAPTION = 'text-sm font-semibold uppercase tracking-wide text-text-muted mb-3';

/** Each field's name and choices, in the order a parse is given. */
const FIELDS: Record<
  ParseFieldKey,
  { label: string; options: readonly string[]; labels: Record<string, string> }
> = {
  stem: { label: 'Stem', options: PARSE_STEMS, labels: STEM_LABELS },
  conjugation: { label: 'Conjugation', options: PARSE_CONJUGATIONS, labels: CONJUGATION_NAMES },
  person: { label: 'Person', options: PARSE_PERSONS, labels: PERSON_LABELS },
  gender: { label: 'Gender', options: PARSE_GENDERS, labels: GENDER_LABELS },
  number: { label: 'Number', options: PARSE_NUMBERS, labels: NUMBER_LABELS },
  state: { label: 'State', options: PARSE_STATES, labels: STATE_LABELS },
};

export const RESULT_PROPERTIES: ParseProperty[] = [
  ...(Object.keys(FIELDS) as ParseFieldKey[]).map((key) => ({ key, label: FIELDS[key].label })),
  { key: 'root', label: 'Root' },
];

function HebrewForm({ text, size }: { text: string; size: string }) {
  return (
    <p
      dir="rtl"
      lang="he"
      className={`${size} font-bold leading-none`}
      style={{ fontFamily: 'var(--font-hebrew)', color: 'var(--color-hebrew)' }}
    >
      {text}
    </p>
  );
}

function HebrewInline({ children }: { children: ReactNode }) {
  return (
    <span
      dir="rtl"
      lang="he"
      style={{ fontFamily: 'var(--font-hebrew)', unicodeBidi: 'isolate', fontSize: '1.125rem' }}
    >
      {children}
    </span>
  );
}
// ─── A form ───────────────────────────────────────────────────────────────────

export function ParseQuestion({
  item,
  index,
  total,
  answer,
  askRoot,
  keypadOpen,
  onToggleKeypad,
  onChange,
  onSubmit,
}: {
  item: ParseItem;
  index: number;
  total: number;
  answer: ParseAnswer;
  askRoot: boolean;
  keypadOpen: boolean;
  onToggleKeypad: () => void;
  onChange: (a: ParseAnswer) => void;
  onSubmit: () => void;
}) {
  const canSubmit = isComplete(answer, askRoot);
  const fields = fieldsFor(answer.conjugation);
  const submit = () => {
    if (canSubmit) onSubmit();
  };

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ParseProgress index={index} total={total} />

      <div className="text-center py-8">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-4">Parse this form</p>
        <HebrewForm text={item.form} size="text-6xl" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fields.map((key) => {
          const field = FIELDS[key];
          return (
            <ParseSelect<string>
              key={key}
              label={field.label}
              value={answer[key]}
              options={field.options}
              labels={field.labels}
              onChange={(v) =>
                onChange(
                  key === 'conjugation'
                    ? withConjugation(answer, v as ParseConjugation)
                    : { ...answer, [key]: v },
                )
              }
            />
          );
        })}
      </div>
      {!answer.conjugation && (
        <p className="-mt-4 text-xs text-text-muted">
          Pick a conjugation, and the fields it inflects for appear.
        </p>
      )}

      {askRoot && (
        <section className="text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted text-left">
            Root
          </h2>
          <TypedAnswerField
            value={answer.root}
            onChange={(root) => onChange({ ...answer, root })}
            onSubmit={submit}
            mark={null}
            hebrew
            focusKey={item.form}
            keypadOpen={keypadOpen}
            onToggleKeypad={onToggleKeypad}
            checkButton={false}
            hebrewPrompt={{ placeholder: 'Type the root', label: 'Root' }}
          />
        </section>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={canSubmit ? PRIMARY_BUTTON : DISABLED_BUTTON}
      >
        Submit
      </button>
    </div>
  );
}

// ─── Its marks ────────────────────────────────────────────────────────────────

const valueLabel = (key: ParseFieldKey, value: string) =>
  value ? (FIELDS[key].labels[value] ?? value) : '—';

function LemmaLine({ reading, lemma }: { reading: VerbReading; lemma: ParseLemma | undefined }) {
  const [glosses, setGlosses] = useState<GlossIndex | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchGlosses()
      .then((g) => {
        if (!cancelled) setGlosses(g);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!lemma) return null;
  const sense = stemSenses(reading.lemma, STEM_LABELS[reading.stem], glosses)?.[0]?.join(', ');
  const gloss = sense ?? glossFor(reading.lemma, { glosses: glosses ?? undefined });
  return (
    <div className="flex items-baseline gap-2 px-4 py-2.5 rounded-lg bg-bg-card border border-gray-100 text-sm">
      <span className="font-semibold" style={{ color: 'var(--color-hebrew)' }}>
        <HebrewInline>{lemma.headword}</HebrewInline>
      </span>
      {gloss && <span className="text-text">{gloss}</span>}
      <span className="text-text-muted ml-auto shrink-0">
        root <HebrewInline>{lemma.root}</HebrewInline>
      </span>
    </div>
  );
}

export function ParseFeedback({
  item,
  answer,
  grade,
  lemmas,
  askRoot,
  onNext,
  isLast,
}: {
  item: ParseItem;
  answer: ParseAnswer;
  grade: ParseGrade;
  lemmas: Record<string, ParseLemma>;
  askRoot: boolean;
  onNext: () => void;
  isLast: boolean;
}) {
  const { reading } = grade;
  const others = item.readings.filter((r) => r !== primaryReading(item));
  const lemma = lemmas[reading.lemma];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center py-6">
        <HebrewForm text={item.form} size="text-5xl" />
        <p className="mt-4 text-sm text-text-muted">{describeReading(primaryReading(item))}</p>
        {others.length > 0 && (
          <p className="mt-1 text-xs text-text-muted">
            Also valid: {others.map(describeReading).join('; ')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {fieldsFor(reading.conjugation).map((key) => (
          <ParseFeedbackRow
            key={key}
            property={FIELDS[key].label}
            correct={grade[key] === true}
            given={valueLabel(key, answer[key])}
            expected={valueLabel(key, reading[key] ?? '')}
          />
        ))}
        {askRoot && (
          <ParseFeedbackRow
            property="Root"
            correct={grade.root === true}
            given={answer.root ? <HebrewInline>{applyFinalForms(answer.root)}</HebrewInline> : '—'}
            expected={<HebrewInline>{lemma?.root}</HebrewInline>}
          />
        )}
      </div>

      {grade.allCorrect && grade.alsoAccepted && (
        <p className="text-xs text-text-muted text-center">
          Accepted as {describeReading(reading)}: the form looks the same, and only its verse
          decides.
        </p>
      )}

      <ParseVerdict correct={grade.allCorrect} />

      <LemmaLine reading={reading} lemma={lemma} />

      <button type="button" onClick={onNext} className={PRIMARY_BUTTON}>
        {isLast ? 'See Results' : 'Next Form'}
      </button>
    </div>
  );
}
