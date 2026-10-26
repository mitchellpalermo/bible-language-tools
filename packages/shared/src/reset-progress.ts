// Erasing the SRS store — the rules both apps' "Reset review progress" follows.
//
// The reset used to be a footer button on the Flashcards page behind a bare
// `confirm()`, one stray tap from wiping every review schedule on the device.
// It now lives on each app's account page behind a typed confirmation, and this
// module is the part of it that is not UI: what counts as confirmed, and the
// order the two stores are cleared in.
//
// Two rules, both from the sync design rather than taste:
//
// - **Local first, and local decides.** localStorage is the working copy, so a
//   reset is done once this browser's store is empty. The server delete is a
//   follow-up that may fail, and a failure there must never undo or block what
//   the student already sees — the same rule every call in each app's
//   sync-manager follows.
// - **The server copy has to be deleted, not overwritten.** hebrew.tools' PUT
//   merges server-side, so pushing an empty store adds nothing and removes
//   nothing; the next sync would bring every card back. greek.tools' PUT still
//   replaces, but any pull-and-merge that runs before the next push ("Sync
//   now", signing in) unions the server's cards straight back into the
//   browser. DELETE is the only path that removes a card in both apps, and it
//   stays correct if greek's PUT ever learns to merge.
//
//   When the local clear fails the server is left alone: deleting it while
//   this browser still holds the cards would only have the next push put
//   them back.

/** The word the student types to arm the destructive button. */
export const RESET_CONFIRM_WORD = 'RESET';

/**
 * Has the student typed the confirmation word?
 *
 * Case-insensitive and trimmed: the point is a deliberate act, not a
 * keyboard-caps test, and an iPad's auto-capitalisation or a trailing space
 * from autocorrect should not leave the button dead with no explanation.
 */
export function isResetConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === RESET_CONFIRM_WORD;
}

export interface ResetDeps {
  /** Empty this browser's SRS store. May throw if storage is unavailable. */
  clearLocal: () => void;
  /**
   * Whether the server has a copy to delete. Pass what the server said about
   * the session (the account page's `Astro.locals.user`), never the auth hint
   * cookie — the hint carries no authority.
   */
  signedIn: boolean;
  /** Delete the account's server copy. Resolves false on failure; never throws. */
  clearServer: () => Promise<boolean>;
}

/**
 * - `skipped` — signed out, or the local clear failed, so nothing was sent.
 * - `cleared` — the server copy is gone.
 * - `failed` — the request failed; the next sync would restore the cards.
 */
export type ServerResetResult = 'skipped' | 'cleared' | 'failed';

export interface ResetOutcome {
  local: 'cleared' | 'failed';
  server: ServerResetResult;
}

/** Erase the SRS store: this browser first, then the account's copy. Never throws. */
export async function resetSrsProgress({
  clearLocal,
  signedIn,
  clearServer,
}: ResetDeps): Promise<ResetOutcome> {
  try {
    clearLocal();
  } catch {
    return { local: 'failed', server: 'skipped' };
  }
  if (!signedIn) return { local: 'cleared', server: 'skipped' };
  return { local: 'cleared', server: await retryServerReset(clearServer) };
}

/** Retry only the server half — for a reset whose local half already landed. */
export async function retryServerReset(
  clearServer: ResetDeps['clearServer'],
): Promise<ServerResetResult> {
  try {
    return (await clearServer()) ? 'cleared' : 'failed';
  } catch {
    // The contract says clearServer never throws; this keeps a binding that
    // does from turning a finished local reset into an error screen.
    return 'failed';
  }
}
