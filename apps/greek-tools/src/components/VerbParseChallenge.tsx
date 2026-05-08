import { useEffect, useState } from 'react';
import type {
  ParseAnswer,
  ParseItem,
  ParseResult,
  ParseSettings as ParseSettingsType,
} from '../lib/verb-parse';
import {
  buildSession,
  DEFAULT_PARSE_SETTINGS,
  emptyAnswer,
  gradeAnswer,
  loadParseSettings,
  saveParseSettings,
} from '../lib/verb-parse';
import ErrorBoundary from './ErrorBoundary';
import ParseFeedback from './ParseFeedback';
import ParseQuestion from './ParseQuestion';
import type { SessionResults } from './ParseResults';
import ParseResults from './ParseResults';
import ParseSettings from './ParseSettings';

type Phase = 'settings' | 'question' | 'feedback' | 'results';

function VerbParseChallengeInner() {
  const [settings, setSettings] = useState<ParseSettingsType>(DEFAULT_PARSE_SETTINGS);
  const [phase, setPhase] = useState<Phase>('settings');
  const [session, setSession] = useState<ParseItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<ParseAnswer>(emptyAnswer());
  const [results, setResults] = useState<ParseResult[]>([]);
  const [currentResult, setCurrentResult] = useState<ParseResult | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load persisted settings on mount (client-only)
  useEffect(() => {
    setSettings(loadParseSettings());
    setSettingsLoaded(true);
  }, []);

  function handleSettingsChange(s: ParseSettingsType) {
    setSettings(s);
    saveParseSettings(s);
  }

  function handleStart() {
    const items = buildSession(settings, settings.sessionLength);
    if (items.length === 0) return; // No matching forms — settings too narrow
    setSession(items);
    setCurrentIndex(0);
    setResults([]);
    setAnswer(emptyAnswer());
    setCurrentResult(null);
    setPhase('question');
  }

  function handleSubmit() {
    const item = session[currentIndex];
    const result = gradeAnswer(item, answer);
    setCurrentResult(result);
    setPhase('feedback');
  }

  function handleNext() {
    const updatedResults = [...results, currentResult!];
    setResults(updatedResults);

    if (currentIndex + 1 >= session.length) {
      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer(emptyAnswer());
      setCurrentResult(null);
      setPhase('question');
    }
  }

  function handleRetry() {
    handleStart();
  }

  function handleChangeSettings() {
    setPhase('settings');
    setSession([]);
    setResults([]);
    setCurrentIndex(0);
    setAnswer(emptyAnswer());
    setCurrentResult(null);
  }

  if (!settingsLoaded) return null;

  const sessionResults: SessionResults = {
    results,
    total: session.length,
  };

  return (
    <div>
      {phase === 'settings' && (
        <ParseSettings settings={settings} onChange={handleSettingsChange} onStart={handleStart} />
      )}

      {phase === 'question' && session[currentIndex] && (
        <ParseQuestion
          item={session[currentIndex]}
          index={currentIndex}
          total={session.length}
          answer={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
        />
      )}

      {phase === 'feedback' && session[currentIndex] && currentResult && (
        <ParseFeedback
          item={session[currentIndex]}
          answer={answer}
          result={currentResult}
          onNext={handleNext}
          isLast={currentIndex + 1 >= session.length}
        />
      )}

      {phase === 'results' && (
        <ParseResults
          sessionResults={sessionResults}
          onRetry={handleRetry}
          onChangeSettings={handleChangeSettings}
        />
      )}
    </div>
  );
}

export default function VerbParseChallenge() {
  return (
    <ErrorBoundary component="VerbParseChallenge">
      <VerbParseChallengeInner />
    </ErrorBoundary>
  );
}
