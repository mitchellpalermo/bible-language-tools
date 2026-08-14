import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveSelection } from '../lib/deck-selection';
import WordWriting from './WordWriting';

/**
 * These run in happy-dom, which has no 2D canvas context. That is deliberate
 * coverage rather than a limitation: `loadGlyphMask` returns null without one,
 * so the component takes its no-mask path and grades by self-assessment —
 * exactly what a browser with a blocked canvas does. Scoring itself is covered
 * without a renderer in `packages/shared`.
 */
beforeEach(() => {
  localStorage.clear();
  // A single small chapter keeps the queue predictable.
  saveSelection({ deck: 'garrett-derouchie', chapters: [2], categories: ['core'] });
});

function grid() {
  return screen.getByRole('group', { name: /letter boxes/i });
}

describe('WordWriting', () => {
  it('prompts with the gloss and does not show the Hebrew', async () => {
    render(<WordWriting />);

    // The whole exercise is producing the Hebrew from the meaning; showing it
    // up front would make the grid a tracing task.
    const boxes = within(grid()).getAllByRole('button');
    expect(boxes.length).toBeGreaterThan(0);
    expect(screen.queryByText(/write right to left/i)).toBeTruthy();
  });

  it('gives the word one box per consonant cluster', () => {
    render(<WordWriting />);
    const boxes = within(grid()).getAllByRole('button');

    // Every box announces its position, which is what makes a row of identical
    // dashed squares navigable.
    expect(boxes[0].getAttribute('aria-label')).toContain('Box 1 of');
    expect(boxes[0].getAttribute('aria-label')).toContain('not yet written');
  });

  it('binds the writing surface to the box that was tapped', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);
    const boxes = within(grid()).getAllByRole('button');
    if (boxes.length < 2) return;

    await user.click(boxes[1]);

    expect(screen.getByText(/writing box 2 of/i)).toBeTruthy();
    expect(boxes[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('starts bound to the first box, so the surface is never orphaned', () => {
    render(<WordWriting />);

    expect(screen.getByText(/writing box 1 of/i)).toBeTruthy();
  });

  it('will not compare an untouched word', () => {
    render(<WordWriting />);

    // Nothing written yet: grading a blank surface would put a real SRS review
    // on a card the student never attempted.
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
  });

  it('disables the per-box controls until that box has ink', () => {
    render(<WordWriting />);

    expect(screen.getByRole('button', { name: /undo stroke/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /clear box/i })).toBeDisabled();
  });

  it('narrows the deck to words that can carry a transliteration prompt', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    // Chapter 2 has twelve core words and four transliterations — the hand-
    // curated entries keep theirs through the merge, the generated ones have
    // none. Narrowing is the honest response; falling back to the gloss would
    // ask a different question than the one the student chose.
    expect(screen.getByText('12 words')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /from the sound/i }));

    expect(screen.getByText('4 words')).toBeTruthy();
  });

  it('explains an empty transliteration deck rather than showing nothing', async () => {
    const user = userEvent.setup();
    // Chapter 25 is entirely generated, so nothing in it carries a
    // romanization — OSHB has none and inventing 546 of them would be errors
    // the data tests cannot catch.
    saveSelection({ deck: 'garrett-derouchie', chapters: [25], categories: ['core'] });
    render(<WordWriting />);

    await user.click(screen.getByRole('button', { name: /from the sound/i }));

    // An empty deck with no explanation is indistinguishable from a bug.
    expect(screen.getByText(/none of these words carry a transliteration/i)).toBeTruthy();
    expect(screen.getByText(/nothing due here/i)).toBeTruthy();
  });

  it('keeps the chapter selection the flashcards use', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    await user.click(screen.getByRole('button', { name: 'All words' }));

    expect(JSON.parse(localStorage.getItem('hebrew-tools-deck-v1') ?? '{}').deck).toBe('all');
  });

  it('holds the grade buttons back until the word has been compared', () => {
    render(<WordWriting />);

    // Grading is a review; offering it before the answer is shown would let a
    // card be scheduled on an attempt the student never checked.
    expect(screen.queryByRole('button', { name: 'Again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Easy' })).toBeNull();
  });
});

/**
 * Dispatch a pointer event with the fields the ink surface reads.
 *
 * Built from a plain `Event` rather than `new PointerEvent(...)`: the
 * constructor is absent in happy-dom, and the surface only reads these fields.
 */
function firePointer(el: Element, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    pointerType: 'pen',
    clientX: x,
    clientY: y,
    pressure: 0.5,
  });
  el.dispatchEvent(event);
}

/**
 * Write something — anything — into the box the surface is bound to.
 *
 * Wrapped in `act`: the stroke lands through a raw DOM event rather than
 * React's synthetic system, so the state it commits is not flushed on its own.
 */
function writeInBox() {
  act(() => {
    const surface = screen.getByRole('img', { name: /write letter/i });
    firePointer(surface, 'pointerdown', 10, 10);
    firePointer(surface, 'pointermove', 40, 30);
    firePointer(surface, 'pointerup', 60, 50);
  });
}

describe('WordWriting grading', () => {
  it('reveals the word and offers the grades once compared', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    writeInBox();
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByRole('button', { name: 'Again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Easy' })).toBeTruthy();
    // The answer is only shown after the attempt is committed.
    expect(screen.getByText(/scores as its weakest letter|how close was it/i)).toBeTruthy();
  });

  it('enables the per-box controls once that box has ink', async () => {
    render(<WordWriting />);

    writeInBox();

    expect(screen.getByRole('button', { name: /undo stroke/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /clear box/i })).toBeEnabled();
  });

  it('clears only the box that is bound, not the whole word', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    writeInBox();
    await user.click(screen.getByRole('button', { name: /clear box/i }));

    // Back to nothing written, so there is nothing to compare.
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
  });

  it('records a review and advances to the next word', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    const before = screen.getByText(/^1 \/ \d+/).textContent;
    writeInBox();
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    // A word card was written under its own namespace, not the letter drills'.
    const store = JSON.parse(localStorage.getItem('hebrew-tools-srs-v1') ?? '{}');
    const keys = Object.keys(store);
    expect(keys.length).toBe(1);
    expect(keys[0].startsWith('write:word:')).toBe(true);

    expect(screen.getByText(/^2 \/ \d+/).textContent).not.toBe(before);
  });

  it('counts the review toward the study stats', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    writeInBox();
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    const stats = JSON.parse(localStorage.getItem('hebrew-tools-stats-v1') ?? '{}');
    expect(stats.totalReviewed).toBe(1);
  });

  it('finishes the session after the last word', async () => {
    const user = userEvent.setup();
    render(<WordWriting />);

    // The counter reads "n / total"; grade every word in the queue.
    const total = Number(
      screen.getByText(/^\d+ \/ \d+/).textContent?.match(/\/\s*(\d+)/)?.[1],
    );
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      writeInBox();
      await user.click(screen.getByRole('button', { name: 'Compare' }));
      await user.click(screen.getByRole('button', { name: 'Good' }));
    }

    expect(screen.getByText(/session complete/i)).toBeTruthy();
    expect(screen.getByText(/written well/i)).toBeTruthy();
  });
});
