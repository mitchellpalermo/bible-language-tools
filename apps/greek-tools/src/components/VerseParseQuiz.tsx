// A short parse session over the verbs of a passage the student is reading,
// drawn inline on the reading screen (#249 on /daily; #204 is to mount it in
// the reader). It takes the verbs and nothing about the page: the page draws
// the text, highlights the word `onTargetChange` names, and keeps its own
// popup shut while a word is targeted, since the popup shows the parse.
//
// The question, the grading and the screens are /parse/gnt's own
// (`GNTParseQuestion`, `gradeGNTAnswer`, `GNTFeedback`, `ParseResults`).

import { useEffect, useState } from 'react';
import {
  emptyGNTAnswer,
  filterMissedItems,
  type GNTParseAnswer,
  type GNTParseItem,
  type GNTParseResult,
  gradeGNTAnswer,
  toSessionResults,
} from '../lib/gnt-parse';
import GNTFeedback from './GNTFeedback';
import GNTParseQuestion from './GNTParseQuestion';
import ParseResults from './ParseResults';

type Phase = 'question' | 'feedback' | 'results';

export interface VerseParseQuizProps {
  /** The verbs to ask, in the order asked (text order). */
  items: GNTParseItem[];
  /** Leave the quiz. Answers already given have been reported. */
  onClose: () => void;
  /**
   * The index in `verseWords` of the word being asked, or null once the
   * session is over. The page highlights it and keeps the word popup shut.
   */
  onTargetChange?: (wordIndex: number | null) => void;
  /** Each graded answer, as it is given. */
  onAnswer?: (item: GNTParseItem, result: GNTParseResult) => void;
  /** A round reached its summary (the first pass, or a review of the missed). */
  onFinish?: (results: GNTParseResult[]) => void;
  closeLabel?: string;
}

export default function VerseParseQuiz({
  items,
  onClose,
  onTargetChange,
  onAnswer,
  onFinish,
  closeLabel = 'Back to reading',
}: VerseParseQuizProps) {
  const [session, setSession] = useState(items);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [answer, setAnswer] = useState<GNTParseAnswer>(emptyGNTAnswer);
  const [result, setResult] = useState<GNTParseResult | null>(null);
  const [results, setResults] = useState<GNTParseResult[]>([]);
  const [isReview, setIsReview] = useState(false);

  const item = session[index];
  const target = phase === 'results' || !item ? null : item.wordIndex;

  useEffect(() => {
    onTargetChange?.(target);
  }, [target, onTargetChange]);

  // The page's highlight must not outlive the quiz.
  useEffect(() => () => onTargetChange?.(null), [onTargetChange]);

  function start(next: GNTParseItem[], review: boolean) {
    setSession(next);
    setIndex(0);
    setResults([]);
    setAnswer(emptyGNTAnswer());
    setResult(null);
    setIsReview(review);
    setPhase('question');
  }

  function handleSubmit() {
    const graded = gradeGNTAnswer(item, answer);
    setResult(graded);
    setPhase('feedback');
    onAnswer?.(item, graded);
  }

  function handleNext() {
    if (!result) return;
    const updated = [...results, result];
    setResults(updated);
    if (index + 1 >= session.length) {
      setPhase('results');
      onFinish?.(updated);
      return;
    }
    setIndex(index + 1);
    setAnswer(emptyGNTAnswer());
    setResult(null);
    setPhase('question');
  }

  if (phase === 'results') {
    return (
      <ParseResults
        sessionResults={toSessionResults(results, session.length)}
        onRetry={() => start(items, false)}
        onChangeSettings={onClose}
        changeSettingsLabel={closeLabel}
        onReviewMissed={() => start(filterMissedItems(session, results), true)}
        isReview={isReview}
      />
    );
  }

  if (!item) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-text-muted hover:border-gray-300 hover:text-text transition-colors"
        >
          {closeLabel}
        </button>
      </div>
      {phase === 'feedback' && result ? (
        <GNTFeedback
          item={item}
          answer={answer}
          result={result}
          onNext={handleNext}
          isLast={index + 1 >= session.length}
        />
      ) : (
        <GNTParseQuestion
          item={item}
          index={index}
          total={session.length}
          answer={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          showContext={false}
        />
      )}
    </div>
  );
}
