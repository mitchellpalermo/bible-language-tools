// A short parse session over the verbs of a passage the student is reading,
// drawn inline under the text (greek.tools' /daily, #249; hebrew.tools' /daily).
// It owns everything about such a session that is not about a language: the
// rounds (the first pass, Try Again, Review Missed), which verb is being asked,
// scrolling the quiz into view, the Close quiz button and the results screen.
//
// Each app supplies the verbs, how an answer is graded, and the two screens it
// already draws on its own /parse: the question and the feedback. The page
// draws the text, highlights the word `onTargetChange` names, and keeps its own
// word popup shut while a word is targeted, since the popup shows the parse.
//
// Styled inline on fallback-bearing tokens, like the rest of ParseDrill, because
// Tailwind does not scan this package. The close button therefore has no hover.

import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { ParseFieldResults, ParseProperty, SessionResults } from '../parse-drill';
import { ParseResults } from './ParseDrill';

type Phase = 'question' | 'feedback' | 'results';

export interface InlineQuestionProps<Item, Answer> {
  item: Item;
  /** Zero-based position in this round. */
  index: number;
  total: number;
  answer: Answer;
  onChange: (answer: Answer) => void;
  onSubmit: () => void;
}

export interface InlineFeedbackProps<Item, Answer, Result> {
  item: Item;
  answer: Answer;
  result: Result;
  onNext: () => void;
  isLast: boolean;
}

export interface InlineParseQuizProps<Item, Answer, Result extends ParseFieldResults> {
  /** The verbs to ask, in the order asked (text order). */
  items: readonly Item[];
  /** Where an item's word sits in the passage the page draws. */
  wordIndexOf: (item: Item) => number;
  emptyAnswer: () => Answer;
  grade: (item: Item, answer: Answer) => Result;
  renderQuestion: (props: InlineQuestionProps<Item, Answer>) => ReactNode;
  renderFeedback: (props: InlineFeedbackProps<Item, Answer, Result>) => ReactNode;
  /** The fields the results screen breaks the score down by. */
  properties: readonly ParseProperty[];
  /** How a round's results reach the results screen. Defaults to as they are. */
  toSessionResults?: (results: Result[], total: number) => SessionResults;
  /** Leave the quiz. Answers already given have been reported. */
  onClose: () => void;
  /**
   * The index of the word being asked, or null once the session is over. The
   * page highlights it and keeps the word popup shut.
   */
  onTargetChange?: (wordIndex: number | null) => void;
  /** Each graded answer, as it is given. */
  onAnswer?: (item: Item, result: Result) => void;
  /** A round reached its summary (the first pass, or a review of the missed). */
  onFinish?: (results: Result[]) => void;
  closeLabel?: string;
}

const CLOSE_BUTTON = {
  padding: '0.375rem 0.75rem',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  border: '1px solid #E5E7EB',
  background: 'transparent',
  color: 'var(--color-text-muted, #6B7280)',
  cursor: 'pointer',
} as const;

export function InlineParseQuiz<Item, Answer, Result extends ParseFieldResults>({
  items,
  wordIndexOf,
  emptyAnswer,
  grade,
  renderQuestion,
  renderFeedback,
  properties,
  toSessionResults = (results, total) => ({ results, total }),
  onClose,
  onTargetChange,
  onAnswer,
  onFinish,
  closeLabel = 'Close quiz',
}: InlineParseQuizProps<Item, Answer, Result>) {
  const [session, setSession] = useState<readonly Item[]>(items);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [answer, setAnswer] = useState<Answer>(emptyAnswer);
  const [result, setResult] = useState<Result | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [isReview, setIsReview] = useState(false);
  const [round, setRound] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const item = session[index];
  const target = phase === 'results' || item === undefined ? null : wordIndexOf(item);

  useEffect(() => {
    onTargetChange?.(target);
  }, [target, onTargetChange]);

  // The quiz opens below the passage, which on a phone is off-screen: the only
  // visible change would be the highlight. Bring it into view when it opens and
  // when a round restarts; 'nearest' leaves it alone where it already shows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per round on purpose
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rootRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }, [round]);

  // The page's highlight must not outlive the quiz.
  useEffect(() => () => onTargetChange?.(null), [onTargetChange]);

  function start(next: readonly Item[], review: boolean) {
    setSession(next);
    setIndex(0);
    setResults([]);
    setAnswer(emptyAnswer());
    setResult(null);
    setIsReview(review);
    setPhase('question');
    setRound((r) => r + 1);
  }

  function submit() {
    if (item === undefined) return;
    const graded = grade(item, answer);
    setResult(graded);
    setPhase('feedback');
    onAnswer?.(item, graded);
  }

  function next() {
    if (!result) return;
    const updated = [...results, result];
    setResults(updated);
    if (index + 1 >= session.length) {
      setPhase('results');
      onFinish?.(updated);
      return;
    }
    setIndex(index + 1);
    setAnswer(emptyAnswer());
    setResult(null);
    setPhase('question');
  }

  const missed = session.filter((_, i) => i < results.length && !results[i].allCorrect);

  return (
    <div ref={rootRef} style={{ scrollMarginTop: '1rem' }}>
      {phase === 'results' ? (
        <ParseResults
          sessionResults={toSessionResults(results, session.length)}
          properties={properties}
          onRetry={() => start(items, false)}
          onChangeSettings={onClose}
          changeSettingsLabel={closeLabel}
          onReviewMissed={() => start(missed, true)}
          isReview={isReview}
        />
      ) : item !== undefined ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={CLOSE_BUTTON}>
              {closeLabel}
            </button>
          </div>
          {phase === 'feedback' && result
            ? renderFeedback({
                item,
                answer,
                result,
                onNext: next,
                isLast: index + 1 >= session.length,
              })
            : renderQuestion({
                item,
                index,
                total: session.length,
                answer,
                onChange: setAnswer,
                onSubmit: submit,
              })}
        </div>
      ) : null}
    </div>
  );
}
