/**
 * Tests for src/components/ParseFeedback.tsx
 *
 * Covers: definition row visibility, lemma/gloss/frequency rendering,
 * graceful omission when no vocab entry exists, and feedback rows.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ParseAnswer, ParseItem, ParseResult } from '../lib/verb-parse';
import ParseFeedback from './ParseFeedback';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ParseItem> = {}): ParseItem {
  return {
    form: 'λύω',
    tense: 'present',
    voice: 'active',
    mood: 'indicative',
    person: '1st',
    number: 'singular',
    paradigmLabel: 'Present Active Indicative — λύω',
    lemma: 'λύω',
    ...overrides,
  };
}

const correctAnswer: ParseAnswer = {
  tense: 'present',
  voice: 'active',
  mood: 'indicative',
  person: '1st',
  number: 'singular',
};

const correctResult: ParseResult = {
  tense: true,
  voice: true,
  mood: true,
  person: true,
  number: true,
  allCorrect: true,
};

const wrongResult: ParseResult = {
  tense: false,
  voice: true,
  mood: true,
  person: true,
  number: true,
  allCorrect: false,
};

// ---------------------------------------------------------------------------
// Definition row — lemma found in vocabulary
// ---------------------------------------------------------------------------

describe('ParseFeedback — definition row', () => {
  it('shows the lemma when vocabulary entry exists', () => {
    render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    // λύω is the form displayed at the top AND the lemma in the definition row;
    // we check for it being present at all
    expect(screen.getAllByText('λύω').length).toBeGreaterThan(0);
  });

  it('shows a gloss when vocabulary entry exists', () => {
    render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    // λύω should have a gloss — we just verify some gloss text appears
    // (avoid hard-coding the exact string in case vocab data changes)
    const glossEl = screen.getByText(/loose|release|set free/i);
    expect(glossEl).toBeInTheDocument();
  });

  it('shows frequency with × suffix', () => {
    render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/×/)).toBeInTheDocument();
  });

  it('shows definition for both correct and incorrect answers', () => {
    const { rerender } = render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/×/)).toBeInTheDocument();

    rerender(
      <ParseFeedback
        item={makeItem()}
        answer={{ ...correctAnswer, tense: 'aorist' }}
        result={wrongResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/×/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Definition row — lemma NOT found in vocabulary
// ---------------------------------------------------------------------------

describe('ParseFeedback — missing vocab entry', () => {
  it('omits the definition row when lemma is not in vocabulary', () => {
    render(
      <ParseFeedback
        item={makeItem({ lemma: 'zzz-not-a-real-lemma' })}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Next button
// ---------------------------------------------------------------------------

describe('ParseFeedback — next button', () => {
  it('calls onNext when the button is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={onNext}
        isLast={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /next form/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows "See Results" when isLast=true', () => {
    render(
      <ParseFeedback
        item={makeItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={true}
      />,
    );
    expect(screen.getByRole('button', { name: /see results/i })).toBeInTheDocument();
  });
});
