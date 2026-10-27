/**
 * Pure pieces of the flashcard session state machine, used by
 * `useFlashcardSession` in `./use-flashcard-session` (#87).
 *
 * Endless mode (#164) is "the queue ran out, deal a new round" — a session
 * rule, not a rendering one — so it lives here rather than in either app.
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

/**
 * How many other cards a missed card waits behind before it comes back.
 *
 * A miss returns later in the same round, never immediately. Recalling an item
 * after a gap is harder than recalling it straight away, and the harder
 * successful recall is the one that strengthens memory (Pyc & Rawson 2009,
 * the "retrieval effort hypothesis"). Asked again at once, the student is
 * reading the answer back out of short-term memory.
 *
 * The 4–6 range is an engineering choice, not a figure from the research: long
 * enough that the answer has left working memory, short enough that the card
 * comes back within the same sitting on a small chapter deck.
 */
export const REQUEUE_GAP = { min: 4, max: 6 } as const;

/**
 * Put the card at `index` back into the queue a few cards later, for a
 * successive-relearning drill: a missed card keeps coming back until it is
 * recalled correctly once (Rawson & Dunlosky 2011). The queue therefore ends
 * only when every card in it has been got right at least once.
 *
 * The card lands `REQUEUE_GAP.min`–`max` cards after the current one, at a
 * random point in that range. When fewer cards than that remain, it goes to the
 * end. If it was the last card, it is next, since there is nothing to put
 * between.
 *
 * Returns a new array. The caller's queue is left alone.
 */
export function requeueMissed<T>(
  queue: readonly T[],
  index: number,
  random: () => number = Math.random,
): T[] {
  const next = [...queue];
  const card = queue[index];
  if (card === undefined) return next;
  const span = REQUEUE_GAP.max - REQUEUE_GAP.min + 1;
  const gap = REQUEUE_GAP.min + Math.floor(random() * span);
  const at = Math.min(index + 1 + gap, next.length);
  next.splice(at, 0, card);
  return next;
}
