// /parse (#82): a verb form from the Hebrew Bible, parsed field by field.
//
// The flow is greek.tools' /parse — settings, a form, its marks, the results —
// and the progress bar, choices, marks, chips and results screen are the same
// components (`@tools/shared/components/ParseDrill`). What is Hebrew here: the
// form, the fields (stem, conjugation, then what that conjugation inflects
// for), the typed root, and where the forms come from (the corpus, through
// `src/data/parse-forms.ts`). The rules for grading are in `src/lib/verb-parse.ts`.
//
// The two screens of a form are `VerbParseScreens.tsx`, shared with /daily.
//
// Every checked answer goes to the attempt log as `parse/verb/<stem>-<conjugation>`.

import { ParseResults, SessionLengthPicker, ToggleChip } from '@tools/shared/components/ParseDrill';
import ToggleSwitch from '@tools/shared/components/ToggleSwitch';
import { toggleValue } from '@tools/shared/parse-drill';
import { useStoredState } from '@tools/shared/use-stored-state';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { fetchParseForms, type ParsePool } from '../data/parse-forms';
import { logAttempts } from '../lib/attempt-log';
import { loadParseSettings, saveParseSettings } from '../lib/parse-settings';
import { useKeypad } from '../lib/use-keypad';
import {
  buildSession,
  CONJUGATION_NAMES,
  DEFAULT_PARSE_SETTINGS,
  eligibleItems,
  emptyAnswer,
  gradeParse,
  PARSE_CONJUGATIONS,
  PARSE_STEMS,
  type ParseAnswer,
  type ParseGrade,
  type ParseItem,
  type ParseSettings,
  parseVerbConcept,
  STEM_LABELS,
} from '../lib/verb-parse';
import ErrorBoundary from './ErrorBoundary';
import {
  CAPTION,
  DISABLED_BUTTON,
  ParseFeedback,
  ParseQuestion,
  PRIMARY_BUTTON,
  RESULT_PROPERTIES,
} from './VerbParseScreens';

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
  // Held here, not in `Question`, which remounts for every verb.
  const keypad = useKeypad();

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
        <ParseQuestion
          item={item}
          index={at}
          total={session.length}
          answer={answer}
          askRoot={askRoot}
          keypadOpen={keypad.open}
          onToggleKeypad={keypad.toggle}
          onChange={setAnswer}
          onSubmit={submit}
        />
      )}
      {phase === 'feedback' && item && pool && (
        <ParseFeedback
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
