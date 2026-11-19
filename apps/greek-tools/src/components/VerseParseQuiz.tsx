// A short parse session over the verbs of a passage the student is reading,
// drawn inline on the reading screen (#249 on /daily; #204 is to mount it in
// the reader). The session, the highlight, the scrolling and the results are
// `@tools/shared/components/InlineParseQuiz`, which hebrew.tools' /daily runs
// on too; what is Greek here is /parse/gnt's own question, grading and
// feedback (`GNTParseQuestion`, `gradeGNTAnswer`, `GNTFeedback`).

import { InlineParseQuiz } from '@tools/shared/components/InlineParseQuiz';
import {
  emptyGNTAnswer,
  type GNTParseAnswer,
  type GNTParseItem,
  type GNTParseResult,
  gradeGNTAnswer,
  toSessionResults,
} from '../lib/gnt-parse';
import GNTFeedback from './GNTFeedback';
import GNTParseQuestion from './GNTParseQuestion';
import { PARSE_PROPERTIES } from './ParseResults';

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

const wordIndexOf = (item: GNTParseItem) => item.wordIndex;

export default function VerseParseQuiz(props: VerseParseQuizProps) {
  return (
    <InlineParseQuiz<GNTParseItem, GNTParseAnswer, GNTParseResult>
      {...props}
      wordIndexOf={wordIndexOf}
      emptyAnswer={emptyGNTAnswer}
      grade={gradeGNTAnswer}
      properties={PARSE_PROPERTIES}
      toSessionResults={toSessionResults}
      renderQuestion={(q) => <GNTParseQuestion {...q} showContext={false} />}
      renderFeedback={(f) => <GNTFeedback {...f} />}
    />
  );
}
