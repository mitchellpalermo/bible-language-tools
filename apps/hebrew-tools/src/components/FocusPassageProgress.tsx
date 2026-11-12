import { useEffect, useState } from 'react';
import { loadSRSStore, type SRSCard } from '../data/srs';
import { type PassageVocabulary, passageProgress } from '../lib/focus-passages';
import { StudyDeckButton } from './FocusPassageVocabulary';

const BANDS = [
  ['mature', 'Mature', '#15803D'],
  ['familiar', 'Familiar', '#65A30D'],
  ['learning', 'Learning', '#B45309'],
  ['unseen', 'Not started', '#6B7280'],
] as const;

/**
 * How well the student knows a passage, read from the SRS store each time it is
 * shown. A passage keeps no score of its own: the words are the same cards the
 * flashcards schedule, so the figures here move when the reviews do.
 */
export default function FocusPassageProgress({
  title,
  vocabulary,
}: {
  title: string;
  vocabulary: PassageVocabulary;
}) {
  const [store, setStore] = useState<Record<string, SRSCard> | null>(null);
  useEffect(() => setStore(loadSRSStore()), []);

  if (!store) return <p className="text-text-muted">Loading…</p>;

  const progress = passageProgress(vocabulary, store);
  const percent = Math.round(progress.known * 100);
  const total = vocabulary.words.length;

  return (
    <div className="space-y-8 max-w-xl">
      <section aria-labelledby="known-heading" className="space-y-3">
        <h2 id="known-heading" className="text-lg font-bold text-text">
          {percent}% of the words you would read
        </h2>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Share of this passage’s words you have studied"
          className="h-3 rounded-full bg-gray-200 overflow-hidden"
        >
          <div
            className="h-full"
            style={{ width: `${percent}%`, background: 'var(--color-primary)' }}
          />
        </div>
        <p className="text-sm text-text-muted">
          Counted over every word of the passage, repeats included, so a word used ten times moves
          this ten times as far as one used once. Words outside the course vocabulary count as not
          yet known.
        </p>
      </section>

      <section aria-labelledby="bands-heading" className="space-y-3">
        <h2 id="bands-heading" className="text-lg font-bold text-text">
          The {total} course {total === 1 ? 'word' : 'words'}
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          {BANDS.map(([band, label, color]) => (
            <div key={band} className="bg-bg-card rounded-xl border border-white shadow-sm p-4">
              <dt className="text-sm font-semibold" style={{ color }}>
                {label}
              </dt>
              <dd className="text-2xl font-extrabold text-text">{progress.words[band]}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-text-muted">
          {progress.due === 0
            ? 'Nothing from this passage is due for review right now.'
            : `${progress.due} ${progress.due === 1 ? 'word is' : 'words are'} due for review.`}
        </p>
      </section>

      <StudyDeckButton title={title} vocabulary={vocabulary} label="Study this passage" />

      <p className="text-sm text-text-muted">
        Parsing drills for a passage are not here yet; the words and the reading are.
      </p>
    </div>
  );
}
