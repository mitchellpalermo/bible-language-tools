// The end of a parse session: greek.tools' five fields over the shared results
// screen (`@tools/shared/components/ParseDrill`, #82), which hebrew.tools' /parse
// draws too. Every greek caller passes results that carry all five flags.

import { ParseResults as SharedParseResults } from '@tools/shared/components/ParseDrill';
import type { ParseProperty } from '@tools/shared/parse-drill';
import type { ParseResult } from '../lib/verb-parse';

export interface SessionResults {
  results: ParseResult[];
  total: number;
}

interface Props {
  sessionResults: SessionResults;
  onRetry: () => void;
  onChangeSettings: () => void;
  changeSettingsLabel?: string;
  onReviewMissed?: () => void;
  isReview?: boolean;
}

export const PARSE_PROPERTIES: ParseProperty<Exclude<keyof ParseResult, 'allCorrect'>>[] = [
  { key: 'tense', label: 'Tense' },
  { key: 'voice', label: 'Voice' },
  { key: 'mood', label: 'Mood' },
  { key: 'person', label: 'Person' },
  { key: 'number', label: 'Number' },
];

export default function ParseResults(props: Props) {
  return <SharedParseResults {...props} properties={PARSE_PROPERTIES} />;
}
