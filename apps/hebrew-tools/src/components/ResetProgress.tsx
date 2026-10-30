import SharedResetProgress from '@tools/shared/components/ResetProgress';
import { saveSRSStore } from '../data/srs';
import { deleteServerProgress, push } from '../lib/sync-manager';
import ErrorBoundary from './ErrorBoundary';

// hebrew.tools' binding of the shared Danger zone (see
// packages/shared/src/components/ResetProgress.tsx). This file owns the two
// things that are app-specific: what the copy says, and which store is erased.

/**
 * Everything that reads or writes the one SRS store, `hebrew-tools-srs-v1`.
 * A reset erases the store, so it erases all of these — the list is what the
 * confirmation shows, and it must grow with the next feature that keys a card
 * into the store (`write:letter:`, `write:nikud:`, `write:word:`, `paradigm:`
 * today, beside the vocabulary's own keys).
 */
export const ERASES = [
  'Vocabulary flashcards — every word you have reviewed',
  'Handwriting practice — letters, vowel points and whole words',
  'Paradigm quiz — every form you have been quizzed on',
  'Accent-shift trainer — every word you have worked through',
  'The reader’s marks on words you have studied',
] as const;

/**
 * Left alone by the reset. On the server `DELETE /api/progress` removes the
 * stats along with the cards; `clearServerSrs` pushes them straight back.
 */
export const KEEPS = ['streak', 'accuracy stats', 'deck choices', 'suffix ladder rungs'] as const;

/** Empty this browser's SRS store. Throws if storage cannot be written. */
export function clearLocalSrs(): void {
  saveSRSStore({});
}

/**
 * Delete the account's copy, then push this browser's back.
 *
 * `DELETE /api/progress` removes the stats and the sync record along with the
 * cards, while this browser keeps its stats. Without the push, the account
 * would sit with no stats — and no record of ever having synced — until the
 * next session-end push. PUT merges server-side, so pushing an empty store
 * onto an empty account adds no cards back. The push's result does not decide
 * the outcome: the cards are gone either way, and the next push covers a
 * failed one. Same shape as greek.tools' reset.
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
        // PUT merges server-side and can never remove a card, so only DELETE
        // makes the reset stick across a sync.
        clearServer={clearServerSrs}
      />
    </ErrorBoundary>
  );
}
