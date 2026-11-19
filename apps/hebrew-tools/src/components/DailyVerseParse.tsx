// The parse quiz on /daily: the verbs of today's verse, asked one at a time
// under the text. The session, the highlight, the scrolling and the results
// are `@tools/shared/components/InlineParseQuiz`, which greek.tools' /daily
// runs on too. What is Hebrew here is /parse's own two screens
// (`VerbParseScreens.tsx`) and its grading, read in context: the verse's
// reading is the answer (`gradeParse`'s `inContext`).

import { InlineParseQuiz } from '@tools/shared/components/InlineParseQuiz';
import { useKeypad } from '../lib/use-keypad';
import {
  emptyAnswer,
  gradeParse,
  type ParseAnswer,
  type ParseGrade,
  type ParseLemma,
} from '../lib/verb-parse';
import type { VerseParseItem } from '../lib/verse-parse';
import { ParseFeedback, ParseQuestion, RESULT_PROPERTIES } from './VerbParseScreens';

export interface DailyVerseParseProps {
  /** The verse's verbs, in text order (`verseVerbs`). */
  items: VerseParseItem[];
  /** Each reading's headword and root (`verseLemmas`). */
  lemmas: Record<string, ParseLemma>;
  /** Whether the root is asked: /parse's own setting. */
  askRoot: boolean;
  onClose: () => void;
  onTargetChange?: (wordIndex: number | null) => void;
  onAnswer?: (item: VerseParseItem, grade: ParseGrade) => void;
  onFinish?: (grades: ParseGrade[]) => void;
}

const wordIndexOf = (item: VerseParseItem) => item.wordIndex;
const ROOTLESS_PROPERTIES = RESULT_PROPERTIES.filter((p) => p.key !== 'root');

export default function DailyVerseParse({ items, lemmas, askRoot, ...rest }: DailyVerseParseProps) {
  // Held here, not in the question, which remounts for every verb.
  const keypad = useKeypad();

  return (
    <InlineParseQuiz<VerseParseItem, ParseAnswer, ParseGrade>
      {...rest}
      items={items}
      wordIndexOf={wordIndexOf}
      emptyAnswer={emptyAnswer}
      grade={(item, answer) => gradeParse(item, answer, lemmas, askRoot, { inContext: true })}
      properties={askRoot ? RESULT_PROPERTIES : ROOTLESS_PROPERTIES}
      renderQuestion={(q) => (
        <ParseQuestion
          {...q}
          askRoot={askRoot}
          keypadOpen={keypad.open}
          onToggleKeypad={keypad.toggle}
        />
      )}
      renderFeedback={({ result, ...f }) => (
        <ParseFeedback {...f} grade={result} lemmas={lemmas} askRoot={askRoot} />
      )}
    />
  );
}
