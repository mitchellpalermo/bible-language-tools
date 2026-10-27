import SharedResetProgress from '@tools/shared/components/ResetProgress';
import { saveSRSStore } from '../data/srs';
import { deleteServerProgress, push } from '../lib/sync-manager';
import ErrorBoundary from './ErrorBoundary';

// greek.tools' binding of the shared Danger zone (see
// packages/shared/src/components/ResetProgress.tsx). This file owns the two
// things that are app-specific: what the copy says, and which store is erased.

/**
 * Everything that reads or writes the one SRS store, `greek-tools-srs-v2`.
 * Focus passage vocabulary schedules the same word cards the flashcards do
 * (both key by `normalizeKey(lemma)`), so a reset takes both.
 */
export const ERASES = [
  'Vocabulary flashcards — every word you have reviewed',
  'Focus passage vocabulary — the same word schedules, and each passage’s vocabulary progress',
  'The reader’s marks on words you have studied',
] as const;

/** Left alone by the reset, in this browser and — after the push below — on the account. */
export const KEEPS = [
  'streak',
  'accuracy stats',
  'custom decks',
  'focus passages',
  'parse history',
] as const;

/** Empty this browser's SRS store. Throws if storage cannot be written. */
export function clearLocalSrs(): void {
  saveSRSStore({});
}

/**
 * Delete the account's copy, then push this browser's back.
 *
 * greek's `DELETE /api/progress` takes custom decks, focus passages and parse
 * history along with the cards — it was written for "Start fresh", where that
 * is the point. A reset is not meant to touch them, so the follow-up push
 * restores them (and the stats) from this browser at once, rather than leaving
 * the account without them until the next session-end push. The push's result
 * does not decide the outcome: the cards are gone either way, and the next push
 * covers a failed one.
 */
export async function clearServerSrs(): Promise<boolean> {
  const deleted = await deleteServerProgress();
  if (deleted) await push();
  return deleted;
}

export default function ResetProgress({ signedIn }: { signedIn: boolean }) {
  return (
    <ErrorBoundary component="ResetProgress">
      <SharedResetProgress
        signedIn={signedIn}
        erases={ERASES}
        keeps={KEEPS}
        clearLocal={clearLocalSrs}
        clearServer={clearServerSrs}
      />
    </ErrorBoundary>
  );
}
