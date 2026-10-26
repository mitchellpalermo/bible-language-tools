/**
 * Pure pieces of the flashcard session state machine. hebrew-tools'
 * `Flashcards.tsx` uses them today; greek-tools adopts them with #87.
 *
 * Endless mode (#164) is "the queue ran out, deal a new round" — a session
 * rule, not a rendering one — so it lives here rather than in either
 * component, and is where #87's `useFlashcardSession` hook should pick it up.
 */

/** Fisher–Yates. `random` is injectable so tests can pin an order. */
export function shuffle<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The next round of an endless drill: the deck reshuffled, never opening on
 * the card that closed the last round.
 *
 * Seeing the same card twice in a row across the boundary reads as a bug, and
 * it hands over a free answer — the student just saw it. When the shuffle lands
 * `last` first, it is swapped with a random later card rather than reshuffled,
 * so the round is still uniformly ordered apart from that one constraint.
 *
 * A one-card deck cannot avoid the repeat, and returns that card.
 */
export function nextRound<T>(
  deck: readonly T[],
  last: T | undefined,
  keyOf: (item: T) => string,
  random: () => number = Math.random,
): T[] {
  const round = shuffle(deck, random);
  if (last === undefined || round.length < 2) return round;
  if (keyOf(round[0]) !== keyOf(last)) return round;
  const j = 1 + Math.floor(random() * (round.length - 1));
  [round[0], round[j]] = [round[j], round[0]];
  return round;
}
