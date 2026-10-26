import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadSRSStore,
  loadStats,
  newCard,
  type SRSCard,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import ResetProgress, { ERASES } from './ResetProgress';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

// One store holds every feature's cards — that is why a reset is not a
// flashcards-only action, and why the confirmation has to say so.
const SEEDED_KEYS = [
  'אָב',
  'write:letter:א',
  'write:nikud:בָ',
  'write:word:דָּבָר',
  'paradigm:qal-perf:3ms',
];

function seedStore() {
  const store: Record<string, SRSCard> = {};
  for (const key of SEEDED_KEYS) {
    store[key] = { ...newCard(key), repetition: 3, interval: 12, lastReviewed: '2026-10-01' };
  }
  saveSRSStore(store);
  saveStats({ ...loadStats(), totalReviewed: 120, totalCorrect: 100 });
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  seedStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function confirmReset() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Reset review progress…' }));
  await user.type(screen.getByLabelText('Type RESET to confirm'), 'RESET');
  await user.click(screen.getByRole('button', { name: 'Erase review progress' }));
  return user;
}

describe('hebrew.tools ResetProgress', () => {
  it('names flashcards, handwriting and the paradigm quiz before anything is erased', async () => {
    const user = userEvent.setup();
    render(<ResetProgress signedIn={false} />);
    await user.click(screen.getByRole('button', { name: 'Reset review progress…' }));

    const panel = screen.getByRole('group', { name: 'Erase all review progress?' });
    expect(panel).toHaveTextContent(/Vocabulary flashcards/);
    expect(panel).toHaveTextContent(/Handwriting practice/);
    expect(panel).toHaveTextContent(/Paradigm quiz/);
    expect(panel).toHaveTextContent('Kept: your streak, accuracy stats and deck choices.');
    expect(ERASES).toHaveLength(4);
  });

  it('erases every card in this browser — all features — and keeps the stats', async () => {
    render(<ResetProgress signedIn={false} />);
    await confirmReset();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Review progress erased in this browser.',
    );
    expect(loadSRSStore()).toEqual({});
    expect(loadStats()).toMatchObject({ totalReviewed: 120, totalCorrect: 100 });
  });

  it('never calls the server for a signed-out visitor', async () => {
    render(<ResetProgress signedIn={false} />);
    await confirmReset();
    await screen.findByRole('status');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes the account copy when signed in', async () => {
    render(<ResetProgress signedIn />);
    await confirmReset();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'in this browser and on your account',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/progress', { method: 'DELETE' });
    expect(loadSRSStore()).toEqual({});
  });

  it('keeps the local reset when the server delete fails, and says so', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    render(<ResetProgress signedIn />);
    await confirmReset();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be erased/);
    expect(screen.getByRole('status')).toHaveTextContent('erased in this browser');
    expect(loadSRSStore()).toEqual({});
  });

  it('erases nothing until the word is typed', async () => {
    const user = userEvent.setup();
    render(<ResetProgress signedIn />);
    await user.click(screen.getByRole('button', { name: 'Reset review progress…' }));
    await user.type(screen.getByLabelText('Type RESET to confirm'), 'yes');

    expect(screen.getByRole('button', { name: 'Erase review progress' })).toBeDisabled();
    expect(Object.keys(loadSRSStore())).toHaveLength(SEEDED_KEYS.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
