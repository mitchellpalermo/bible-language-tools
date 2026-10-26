import { describe, expect, it } from 'vitest';
import { nextRound, shuffle } from './flashcard-session';

/** A `random` that replays a fixed sequence, so an order can be pinned. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const id = (s: string) => s;

describe('shuffle', () => {
  it('returns a permutation and leaves the input alone', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('is driven by the random source it is given', () => {
    // 0.999… keeps every element in place: j is always i.
    expect(shuffle(['a', 'b', 'c'], () => 0.9999)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextRound', () => {
  it('deals every card in the deck exactly once', () => {
    const deck = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (let n = 0; n < 50; n++) {
      expect([...nextRound(deck, 'c', id)].sort()).toEqual(deck);
    }
  });

  it('never opens on the card that closed the previous round', () => {
    const deck = ['a', 'b', 'c', 'd'];
    for (let n = 0; n < 200; n++) {
      const last = deck[n % deck.length];
      expect(nextRound(deck, last, id)[0]).not.toBe(last);
    }
  });

  it('swaps the repeat out rather than leaving it first', () => {
    // An identity shuffle puts 'a' first. The swap partner is then drawn from
    // the cards behind it: the last one for a high pick, the next for a low one.
    expect(nextRound(['a', 'b', 'c'], 'a', id, () => 0.9999)).toEqual(['c', 'b', 'a']);
    expect(nextRound(['a', 'b', 'c'], 'a', id, sequence(0.9999, 0.9999, 0))).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('compares cards by key, not identity', () => {
    const deck = [{ k: 'x' }, { k: 'y' }];
    const last = { k: 'x' }; // a different object for the same card
    for (let n = 0; n < 20; n++) {
      expect(nextRound(deck, last, (c) => c.k)[0].k).toBe('y');
    }
  });

  it('cannot avoid the repeat in a one-card deck', () => {
    expect(nextRound(['a'], 'a', id)).toEqual(['a']);
  });

  it('is a plain shuffle when there is no previous card', () => {
    expect(nextRound(['a', 'b', 'c'], undefined, id, () => 0.9999)).toEqual(['a', 'b', 'c']);
  });
});
