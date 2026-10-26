import SharedResetProgress from '@tools/shared/components/ResetProgress';
import { saveSRSStore } from '../data/srs';
import { deleteServerProgress } from '../lib/sync-manager';
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
  'The reader’s marks on words you have studied',
] as const;

/**
 * Left alone by the reset. Stats stay in this browser; on the server,
 * `DELETE /api/progress` removes them along with the cards, and the next push
 * from this browser puts them back.
 */
export const KEEPS = ['streak', 'accuracy stats', 'deck choices'] as const;

/** Empty this browser's SRS store. Throws if storage cannot be written. */
export function clearLocalSrs(): void {
  saveSRSStore({});
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
        clearServer={deleteServerProgress}
      />
    </ErrorBoundary>
  );
}
