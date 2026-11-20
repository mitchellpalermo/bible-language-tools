import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineParseQuiz, type InlineParseQuizProps } from './InlineParseQuiz';

// A quiz with no language in it: each item is a word at a position in the
// passage, and the answer is that word typed back.
interface Item {
  word: string;
  at: number;
}
interface Result {
  allCorrect: boolean;
  word: boolean;
}

const ITEMS: Item[] = [
  { word: 'alpha', at: 2 },
  { word: 'beta', at: 5 },
];

function renderQuiz(props: Partial<InlineParseQuizProps<Item, string, Result>> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onTargetChange: vi.fn(),
    onAnswer: vi.fn(),
    onFinish: vi.fn(),
  };
  const utils = render(
    <InlineParseQuiz<Item, string, Result>
      items={ITEMS}
      wordIndexOf={(item) => item.at}
      emptyAnswer={() => ''}
      grade={(item, answer) => ({ allCorrect: answer === item.word, word: answer === item.word })}
      properties={[{ key: 'word', label: 'Word' }]}
      renderQuestion={({ item, index, total, answer, onChange, onSubmit }) => (
        <div>
          <p>
            Ask {item.word} ({index + 1} of {total})
          </p>
          <input aria-label="Answer" value={answer} onChange={(e) => onChange(e.target.value)} />
          <button type="button" onClick={onSubmit}>
            Check
          </button>
        </div>
      )}
      renderFeedback={({ item, result, onNext, isLast }) => (
        <div>
          <p>
            {item.word}: {result.allCorrect ? 'right' : 'wrong'}
          </p>
          <button type="button" onClick={onNext}>
            {isLast ? 'See Results' : 'Next'}
          </button>
        </div>
      )}
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, ...handlers };
}

async function answer(user: ReturnType<typeof userEvent.setup>, text: string, last = false) {
  await user.type(screen.getByLabelText('Answer'), text);
  await user.click(screen.getByRole('button', { name: 'Check' }));
  await user.click(screen.getByRole('button', { name: last ? 'See Results' : 'Next' }));
}

const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe('InlineParseQuiz', () => {
  it('asks each item in order and names its word for the page to highlight', async () => {
    const user = userEvent.setup();
    const { onTargetChange, onAnswer } = renderQuiz();

    expect(screen.getByText('Ask alpha (1 of 2)')).toBeTruthy();
    expect(onTargetChange).toHaveBeenLastCalledWith(2);

    await user.type(screen.getByLabelText('Answer'), 'alpha');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('alpha: right')).toBeTruthy();
    expect(onAnswer).toHaveBeenCalledWith(ITEMS[0], { allCorrect: true, word: true });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Ask beta (2 of 2)')).toBeTruthy();
    expect(onTargetChange).toHaveBeenLastCalledWith(5);
    // A fresh answer for the next item.
    expect((screen.getByLabelText('Answer') as HTMLInputElement).value).toBe('');
  });

  it('ends on the results, with nothing highlighted, and reports the round', async () => {
    const user = userEvent.setup();
    const { onTargetChange, onFinish } = renderQuiz();
    await answer(user, 'alpha');
    await answer(user, 'gamma', true);

    expect(screen.getByText('Session Score')).toBeTruthy();
    expect(screen.getByText('50% correct')).toBeTruthy();
    expect(onTargetChange).toHaveBeenLastCalledWith(null);
    expect(onFinish).toHaveBeenCalledWith([
      { allCorrect: true, word: true },
      { allCorrect: false, word: false },
    ]);
  });

  it('reviews only the missed, and Try Again asks everything again', async () => {
    const user = userEvent.setup();
    renderQuiz();
    await answer(user, 'alpha');
    await answer(user, 'gamma', true);

    await user.click(screen.getByRole('button', { name: 'Review Missed (1)' }));
    expect(screen.getByText('Ask beta (1 of 1)')).toBeTruthy();
    await answer(user, 'beta', true);
    expect(screen.getByText('Review: Missed Verbs (1)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Ask alpha (1 of 2)')).toBeTruthy();
  });

  it('closes from a question and from the results, under the label given', async () => {
    const user = userEvent.setup();
    const { onClose } = renderQuiz({ closeLabel: 'Back to the verse' });
    await user.click(screen.getByRole('button', { name: 'Back to the verse' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await answer(user, 'alpha');
    await answer(user, 'beta', true);
    await user.click(screen.getByRole('button', { name: 'Back to the verse' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('is called Close quiz by default', () => {
    renderQuiz();
    expect(screen.getByRole('button', { name: 'Close quiz' })).toBeTruthy();
  });

  it('scrolls into view on opening and on each new round, not on each answer', async () => {
    const user = userEvent.setup();
    renderQuiz();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'nearest' });

    await answer(user, 'alpha');
    await answer(user, 'beta', true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('jumps rather than glides for a student who asks for less motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    renderQuiz();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'nearest' });
    vi.unstubAllGlobals();
  });

  it('clears the highlight when it closes', () => {
    const { onTargetChange, unmount } = renderQuiz();
    onTargetChange.mockClear();
    unmount();
    expect(onTargetChange).toHaveBeenCalledWith(null);
  });

  it('hands a round to the results through the app’s own shaping', async () => {
    const user = userEvent.setup();
    renderQuiz({
      toSessionResults: (results, total) => ({
        results: results.map((r) => ({ ...r, word: true })),
        total,
      }),
    });
    await answer(user, 'x');
    await answer(user, 'y', true);
    // The score is still 0/2; the Word row reads the shaped flags.
    expect(screen.getByText('0/2')).toBeTruthy();
    expect(screen.getByText('2/2')).toBeTruthy();
  });

  it('draws nothing for an empty passage', () => {
    const { container } = renderQuiz({ items: [] });
    expect(container.textContent).toBe('');
  });
});
