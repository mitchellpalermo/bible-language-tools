import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GNTFiniteItem, GNTParseAnswer, GNTParseResult } from '../lib/gnt-parse';
import GNTFeedback from './GNTFeedback';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFiniteItem(overrides: Partial<GNTFiniteItem> = {}): GNTFiniteItem {
  return {
    type: 'finite',
    form: 'λύομεν',
    lemma: 'λύω',
    verseRef: 'John 1:1',
    verseWords: [],
    wordIndex: 0,
    tense: 'present',
    voice: 'active',
    mood: 'indicative',
    person: '1st',
    number: 'plural',
    ...overrides,
  };
}

const correctAnswer: GNTParseAnswer = {
  tense: 'present',
  voice: 'active',
  mood: 'indicative',
  person: '1st',
  number: 'plural',
  parseCase: '',
  gender: '',
};

const correctResult: GNTParseResult = {
  tense: true,
  voice: true,
  mood: true,
  person: true,
  number: true,
  parseCase: null,
  gender: null,
  allCorrect: true,
};

const wrongResult: GNTParseResult = {
  tense: false,
  voice: true,
  mood: true,
  person: true,
  number: true,
  parseCase: null,
  gender: null,
  allCorrect: false,
};

// ---------------------------------------------------------------------------
// Definition row — lemma found in vocabulary
// ---------------------------------------------------------------------------

describe('GNTFeedback — definition row', () => {
  it('shows the lemma when vocabulary entry exists', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getAllByText('λύω').length).toBeGreaterThan(0);
  });

  it('shows a gloss when vocabulary entry exists', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/loose|release|set free/i)).toBeInTheDocument();
  });

  it('shows frequency with × suffix', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
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
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/×/)).toBeInTheDocument();

    rerender(
      <GNTFeedback
        item={makeFiniteItem()}
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

describe('GNTFeedback — missing vocab entry', () => {
  it('omits the definition row when lemma is not in vocabulary', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem({ lemma: 'zzz-not-a-real-lemma' })}
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
// Verdict banner
// ---------------------------------------------------------------------------

describe('GNTFeedback — verdict', () => {
  it('shows "Correct!" for an all-correct result', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText('Correct!')).toBeInTheDocument();
  });

  it('shows error message for a wrong result', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={{ ...correctAnswer, tense: 'aorist' }}
        result={wrongResult}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Next button
// ---------------------------------------------------------------------------

describe('GNTFeedback — next button', () => {
  it('calls onNext when clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={onNext}
        isLast={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /next form/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows "See Results" on the last item', () => {
    render(
      <GNTFeedback
        item={makeFiniteItem()}
        answer={correctAnswer}
        result={correctResult}
        onNext={vi.fn()}
        isLast={true}
      />,
    );
    expect(screen.getByRole('button', { name: /see results/i })).toBeInTheDocument();
  });
});
