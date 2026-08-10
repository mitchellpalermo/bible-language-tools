import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromNow, loadSRSStore, loadStats, newCard, saveSRSStore } from '../data/srs';
import { buildDecks, writingCardKey } from '../data/writing';
import WritingPractice from './WritingPractice';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const [ALPHABET, FINALS] = buildDecks();

function canvas() {
  return screen.getByLabelText(/Write the Hebrew letter/);
}

/** Lay down one stroke on the surface. */
function drawOn(el: Element) {
  const fire = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'pen', clientX: x, clientY: 10, pressure: 0.5 });
    el.dispatchEvent(event);
  };
  fire('pointerdown', 10);
  fire('pointermove', 60);
  fire('pointerup', 110);
}

/** Reveal the reference, then grade the current letter. */
async function gradeCurrent(user: ReturnType<typeof userEvent.setup>, grade = 'Good') {
  await user.click(screen.getByRole('button', { name: 'Compare' }));
  await user.click(screen.getByRole('button', { name: grade }));
}

describe('deck and mode selection', () => {
  it('starts on the alphabet deck at alef, in trace mode', () => {
    render(<WritingPractice />);

    expect(screen.getByRole('button', { name: /The alphabet/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Trace' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('alef')).toBeInTheDocument();
    // The counter shares its element with the "new" tally, so match loosely.
    expect(screen.getByText(/1 \/ 23/)).toBeInTheDocument();
  });

  it('shows the letter itself only in copy mode', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    // Trace mode ghosts it onto the canvas instead of printing it.
    expect(screen.queryByText('א')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByText('א')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recall' }));
    expect(screen.queryByText('א')).not.toBeInTheDocument();
    expect(screen.getByText('alef')).toBeInTheDocument();
  });

  it('switches decks and restarts the session', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    expect(screen.getByText('kaf sofit')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`1 / ${FINALS.glyphs.length}`))).toBeInTheDocument();
  });

  it('offers every deck with its size', () => {
    render(<WritingPractice />);
    expect(screen.getByRole('button', { name: /Letters \+ finals/ })).toHaveTextContent('28');
    expect(ALPHABET.glyphs).toHaveLength(23);
  });
});

describe('the writing surface', () => {
  it('enables undo and clear only once there is ink', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();

    drawOn(canvas());
    expect(await screen.findByRole('button', { name: 'Undo stroke' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });

  it('reports that palm rejection has engaged once a stylus is used', async () => {
    render(<WritingPractice />);
    expect(screen.queryByText(/palm rejection on/)).not.toBeInTheDocument();

    drawOn(canvas());
    expect(await screen.findByText(/Stylus detected/)).toBeInTheDocument();
  });

  it('removes one stroke at a time with undo', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    drawOn(canvas());
    drawOn(canvas());
    await user.click(screen.getByRole('button', { name: 'Undo stroke' }));

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });
});

describe('grading', () => {
  it('hides the grade buttons until the student has compared', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    expect(screen.queryByRole('button', { name: 'Good' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
  });

  it('shows the discrimination note for a confusable letter', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    // alef has no note; bet does. Grade past alef to reach it.
    await gradeCurrent(user);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText(/The base extends left past the vertical/)).toBeInTheDocument();
  });

  it('writes a prefixed SRS card and advances', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user);

    const store = loadSRSStore();
    expect(store[writingCardKey('א')]).toBeDefined();
    expect(store[writingCardKey('א')].repetition).toBe(1);
    // The bare lemma key belongs to vocabulary; writing must not touch it.
    expect(store['א']).toBeUndefined();

    expect(screen.getByText('bet')).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 23/)).toBeInTheDocument();
  });

  it('counts a lapse without advancing the repetition count', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user, 'Again');
    expect(loadSRSStore()[writingCardKey('א')].repetition).toBe(0);
  });

  it('records the review in the shared study stats', async () => {
    // Handwriting reviews feed the same streak as vocabulary reviews — that
    // shared store is what lets them sync with no schema change.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user);
    const stats = loadStats();
    expect(stats.totalReviewed).toBe(1);
    expect(stats.totalCorrect).toBe(1);
  });

  it('clears the ink between letters', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    drawOn(canvas());
    await gradeCurrent(user);

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });
});

describe('session end', () => {
  it('summarises the session after the last letter', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    for (let i = 0; i < FINALS.glyphs.length; i++) await gradeCurrent(user);

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText(/5 written well, 0 to revisit/)).toBeInTheDocument();
  });

  it('restarts on demand', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    for (let i = 0; i < FINALS.glyphs.length; i++) await gradeCurrent(user);
    await user.click(screen.getByRole('button', { name: 'Practice again' }));

    // Every card was just scheduled into the future, so nothing is due.
    expect(screen.getByText('Nothing due in this deck')).toBeInTheDocument();
  });

  it('says so when a deck is entirely scheduled for later', async () => {
    const user = userEvent.setup();
    saveSRSStore(
      Object.fromEntries(
        FINALS.glyphs.map(g => {
          const key = writingCardKey(g.char);
          return [key, { ...newCard(key), dueDate: daysFromNow(5) }];
        }),
      ),
    );

    render(<WritingPractice />);
    // The alphabet is untouched and still due; the finals are not.
    expect(screen.getByText('alef')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    expect(screen.getByText('Nothing due in this deck')).toBeInTheDocument();
  });
});
