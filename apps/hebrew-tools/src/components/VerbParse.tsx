// /parse (#82): a verb form from the Hebrew Bible, parsed field by field.
//
// The flow is greek.tools' /parse — settings, a form, its marks, the results —
// and the progress bar, choices, marks, chips and results screen are the same
// components (`@tools/shared/components/ParseDrill`). What is Hebrew here: the
// form, the fields (stem, conjugation, then what that conjugation inflects
// for), the typed root, and where the forms come from (the corpus, through
// `src/data/parse-forms.ts`). The rules for grading are in `src/lib/verb-parse.ts`.
//
// Every checked answer goes to the attempt log as `parse/verb/<stem>-<conjugation>`.

import {
  ParseFeedbackRow,
  ParseProgress,
  ParseResults,
  ParseSelect,
  ParseVerdict,
  SessionLengthPicker,
  ToggleChip,
} from '@tools/shared/components/ParseDrill';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { type ParseProperty, toggleValue } from '@tools/shared/parse-drill';
import { useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { type ReactNode, useEffect, useState } from 'react';
import type { GlossIndex } from '../data/morphhb';
import { fetchGlosses } from '../data/morphhb';
import { fetchParseForms, type ParsePool } from '../data/parse-forms';
import { logAttempts } from '../lib/attempt-log';
import { glossFor, stemSenses } from '../lib/gloss';
import { applyFinalForms } from '../lib/hebrew-input';
import { loadParseSettings, saveParseSettings } from '../lib/parse-settings';
import {
  buildSession,
  CONJUGATION_NAMES,
  DEFAULT_PARSE_SETTINGS,
  describeReading,
  eligibleItems,
  emptyAnswer,
  fieldsFor,
  GENDER_LABELS,
  gradeParse,
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
  type ParseSettings,
  PERSON_LABELS,
  parseVerbConcept,
  primaryReading,
  STATE_LABELS,
  STEM_LABELS,
  type VerbReading,
  withConjugation,
} from '../lib/verb-parse';
import ErrorBoundary from './ErrorBoundary';
import { TypedAnswerField } from './TypedAnswer';

const PRIMARY_BUTTON =
  'w-full py-3 rounded-xl text-base font-bold bg-primary text-white hover:opacity-90 transition-opacity';
const DISABLED_BUTTON = 'w-full py-3 rounded-xl text-base font-bold bg-bg-card text-text-muted';
const CAPTION = 'text-sm font-semibold uppercase tracking-wide text-text-muted mb-3';

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

const RESULT_PROPERTIES: ParseProperty[] = [
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

// ─── Settings ─────────────────────────────────────────────────────────────────

function ChipSection<T extends string>({
  title,
  options,
  labels,
  selected,
  onChange,
}: {
  title: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <section>
      <h2 className={CAPTION}>{title}</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <ToggleChip
            key={o}
            label={labels[o]}
            active={selected.includes(o)}
            onClick={() => onChange(options.filter((x) => toggleValue(selected, o).includes(x)))}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange([...options])}
          className="text-xs text-text-muted underline underline-offset-2 hover:text-text"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-text-muted underline underline-offset-2 hover:text-text"
        >
          None
        </button>
      </div>
    </section>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onStart,
  available,
}: {
  settings: ParseSettings;
  onChange: (s: ParseSettings) => void;
  onStart: () => void;
  /** Forms the settings allow; `null` while the forms load. */
  available: number | null;
}) {
  const chosen = settings.stems.length > 0 && settings.conjugations.length > 0;
  const canStart = chosen && available !== null && available > 0;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <ChipSection
        title="Stems"
        options={PARSE_STEMS}
        labels={STEM_LABELS}
        selected={settings.stems}
        onChange={(stems) => onChange({ ...settings, stems })}
      />
      <ChipSection
        title="Conjugations"
        options={PARSE_CONJUGATIONS}
        labels={CONJUGATION_NAMES}
        selected={settings.conjugations}
        onChange={(conjugations) => onChange({ ...settings, conjugations })}
      />
      <p className="-mt-6 text-xs text-text-muted">
        A form is asked under the conjugation the text uses it as most. Out of context a prefixed
        2nd masculine singular may also be a 3rd feminine, and a qatal after the conjunction a
        weqatal; either answer counts. Jussives and cohortatives are not asked yet.
      </p>

      <section>
        <h2 className={CAPTION}>Root</h2>
        <ToggleSwitch
          checked={settings.askRoot}
          onChange={() => onChange({ ...settings, askRoot: !settings.askRoot })}
          label="Ask for the root"
          accent="var(--color-primary, #15803D)"
        />
      </section>

      <section>
        <h2 className={CAPTION}>Forms per session</h2>
        <SessionLengthPicker
          value={settings.sessionLength}
          onChange={(sessionLength) => onChange({ ...settings, sessionLength })}
        />
      </section>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className={canStart ? PRIMARY_BUTTON : DISABLED_BUTTON}
      >
        Start Parsing
      </button>

      {!chosen ? (
        <p className="text-center text-xs text-red-500">
          Select at least one stem and one conjugation to continue.
        </p>
      ) : available === null ? (
        <p className="text-center text-xs text-text-muted">Loading forms from the text…</p>
      ) : (
        <p className="text-center text-xs text-text-muted">
          {available === 0
            ? 'No forms in the text match these settings.'
            : `${available.toLocaleString()} ${available === 1 ? 'form' : 'forms'} from the Hebrew Bible ${available === 1 ? 'matches' : 'match'} these settings.`}
        </p>
      )}
    </div>
  );
}

// ─── A form ───────────────────────────────────────────────────────────────────

function Question({
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

function Feedback({
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

// ─── The session ──────────────────────────────────────────────────────────────

type Phase = 'settings' | 'question' | 'feedback' | 'results';

function VerbParseInner() {
  const [settings, setSettings] = useStoredState(
    loadParseSettings,
    DEFAULT_PARSE_SETTINGS as ParseSettings,
    saveParseSettings,
  );
  const [pool, setPool] = useState<ParsePool | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('settings');
  const [session, setSession] = useState<ParseItem[]>([]);
  const [at, setAt] = useState(0);
  const [answer, setAnswer] = useState<ParseAnswer>(emptyAnswer());
  const [grades, setGrades] = useState<ParseGrade[]>([]);
  // The settings a session was dealt under; changing them mid-session changes nothing.
  const [askRoot, setAskRoot] = useState(settings.askRoot);
  // The keypad belongs to the page, not to one form: `Question` remounts for
  // every verb, so state kept there closed the keypad again on each one. A
  // touch screen starts with it open, read after mount (the page is prerendered).
  const [keypadOpen, setKeypadOpen] = useState(false);
  useEffect(() => {
    setKeypadOpen(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchParseForms()
      .then((p) => {
        if (!cancelled) setPool(p);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = () => {
    if (!pool) return;
    const items = buildSession(pool.items, settings);
    if (items.length === 0) return;
    setSession(items);
    setAskRoot(settings.askRoot);
    setAt(0);
    setGrades([]);
    setAnswer(emptyAnswer());
    setPhase('question');
    posthog.capture('hebrew_parse_started', {
      stems: settings.stems,
      conjugations: settings.conjugations,
      ask_root: settings.askRoot,
      length: items.length,
    });
  };

  const submit = () => {
    if (!pool) return;
    const grade = gradeParse(session[at], answer, pool.lemmas, askRoot);
    setGrades((g) => [...g, grade]);
    logAttempts([{ concept: parseVerbConcept(grade.reading), correct: grade.allCorrect }]);
    setPhase('feedback');
  };

  const next = () => {
    if (at + 1 >= session.length) {
      const correct = grades.filter((g) => g.allCorrect).length;
      posthog.capture('hebrew_parse_completed', { correct, total: session.length });
      setPhase('results');
      return;
    }
    setAt(at + 1);
    setAnswer(emptyAnswer());
    setPhase('question');
  };

  if (loadFailed) {
    return (
      <p className="max-w-lg mx-auto text-center text-text-muted">
        The verb forms could not be loaded. Check your connection and reload the page.
      </p>
    );
  }

  const item = session[at];
  return (
    <div>
      {phase === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onStart={start}
          available={pool ? eligibleItems(pool.items, settings).length : null}
        />
      )}
      {phase === 'question' && item && (
        <Question
          item={item}
          index={at}
          total={session.length}
          answer={answer}
          askRoot={askRoot}
          keypadOpen={keypadOpen}
          onToggleKeypad={() => setKeypadOpen((o) => !o)}
          onChange={setAnswer}
          onSubmit={submit}
        />
      )}
      {phase === 'feedback' && item && pool && (
        <Feedback
          item={item}
          answer={answer}
          grade={grades[at]}
          lemmas={pool.lemmas}
          askRoot={askRoot}
          onNext={next}
          isLast={at + 1 >= session.length}
        />
      )}
      {phase === 'results' && (
        <ParseResults
          sessionResults={{ results: grades, total: session.length }}
          properties={askRoot ? RESULT_PROPERTIES : RESULT_PROPERTIES.slice(0, -1)}
          onRetry={start}
          onChangeSettings={() => setPhase('settings')}
        />
      )}
    </div>
  );
}

export default function VerbParse() {
  return (
    <ErrorBoundary component="VerbParse">
      <VerbParseInner />
    </ErrorBoundary>
  );
}
