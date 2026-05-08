/**
 * Tests for src/components/ParseResults.tsx
 *
 * Covers: score display, property breakdown, action buttons,
 * "Review Missed" button visibility, and isReview label.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ParseResults, { type SessionResults } from './ParseResults';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeResult(allCorrect: boolean) {
  return {
    tense: allCorrect,
    voice: allCorrect,
    mood: allCorrect,
    person: allCorrect,
    number: allCorrect,
    allCorrect,
  };
}

function makeSession(corrects: boolean[]): SessionResults {
  return {
    results: corrects.map(makeResult),
    total: corrects.length,
  };
}

const noop = vi.fn();

// ---------------------------------------------------------------------------
// Score display
// ---------------------------------------------------------------------------

describe('ParseResults — score display', () => {
  it('shows correct count and percentage', () => {
    render(
      <ParseResults
        sessionResults={makeSession([true, true, false])}
        onRetry={noop}
        onChangeSettings={noop}
      />,
    );
    // getByText can match multiple nodes (hero + property rows); check for the percentage text
    expect(screen.getByText('67% correct')).toBeInTheDocument();
  });

  it('shows 100% when all correct', () => {
    render(
      <ParseResults
        sessionResults={makeSession([true, true])}
        onRetry={noop}
        onChangeSettings={noop}
      />,
    );
    expect(screen.getByText('100% correct')).toBeInTheDocument();
  });

  it('shows 0% when all wrong', () => {
    render(
      <ParseResults
        sessionResults={makeSession([false, false])}
        onRetry={noop}
        onChangeSettings={noop}
      />,
    );
    expect(screen.getByText('0% correct')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// isReview label
// ---------------------------------------------------------------------------

describe('ParseResults — isReview label', () => {
  it('shows "Session Score" label by default', () => {
    render(
      <ParseResults sessionResults={makeSession([true])} onRetry={noop} onChangeSettings={noop} />,
    );
    expect(screen.getByText('Session Score')).toBeInTheDocument();
  });

  it('shows review label with item count when isReview=true', () => {
    render(
      <ParseResults
        sessionResults={makeSession([false, false, false])}
        onRetry={noop}
        onChangeSettings={noop}
        isReview
      />,
    );
    expect(screen.getByText('Review: Missed Verbs (3)')).toBeInTheDocument();
    expect(screen.queryByText('Session Score')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Action buttons — Try Again / Change Settings
// ---------------------------------------------------------------------------

describe('ParseResults — action buttons', () => {
  it('calls onRetry when "Try Again" is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ParseResults
        sessionResults={makeSession([true])}
        onRetry={onRetry}
        onChangeSettings={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls onChangeSettings when "Change Settings" is clicked', async () => {
    const user = userEvent.setup();
    const onChangeSettings = vi.fn();
    render(
      <ParseResults
        sessionResults={makeSession([true])}
        onRetry={noop}
        onChangeSettings={onChangeSettings}
      />,
    );
    await user.click(screen.getByRole('button', { name: /change settings/i }));
    expect(onChangeSettings).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Review Missed button
// ---------------------------------------------------------------------------

describe('ParseResults — Review Missed button', () => {
  it('is not rendered when onReviewMissed is not provided', () => {
    render(
      <ParseResults
        sessionResults={makeSession([false, false])}
        onRetry={noop}
        onChangeSettings={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /review missed/i })).not.toBeInTheDocument();
  });

  it('is not rendered when all results are correct (no misses)', () => {
    render(
      <ParseResults
        sessionResults={makeSession([true, true])}
        onRetry={noop}
        onChangeSettings={noop}
        onReviewMissed={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /review missed/i })).not.toBeInTheDocument();
  });

  it('is rendered when onReviewMissed provided and there are misses', () => {
    render(
      <ParseResults
        sessionResults={makeSession([true, false])}
        onRetry={noop}
        onChangeSettings={noop}
        onReviewMissed={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /review missed \(1\)/i })).toBeInTheDocument();
  });

  it('shows the correct missed count in the button label', () => {
    render(
      <ParseResults
        sessionResults={makeSession([false, true, false, false])}
        onRetry={noop}
        onChangeSettings={noop}
        onReviewMissed={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /review missed \(3\)/i })).toBeInTheDocument();
  });

  it('calls onReviewMissed when clicked', async () => {
    const user = userEvent.setup();
    const onReviewMissed = vi.fn();
    render(
      <ParseResults
        sessionResults={makeSession([true, false])}
        onRetry={noop}
        onChangeSettings={noop}
        onReviewMissed={onReviewMissed}
      />,
    );
    await user.click(screen.getByRole('button', { name: /review missed/i }));
    expect(onReviewMissed).toHaveBeenCalledOnce();
  });

  it('remains visible after a review session if there are still misses', () => {
    render(
      <ParseResults
        sessionResults={makeSession([false])}
        onRetry={noop}
        onChangeSettings={noop}
        onReviewMissed={noop}
        isReview
      />,
    );
    expect(screen.getByRole('button', { name: /review missed \(1\)/i })).toBeInTheDocument();
  });
});
