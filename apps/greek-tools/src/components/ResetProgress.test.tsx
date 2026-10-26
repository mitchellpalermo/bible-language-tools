import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CustomDeck, loadCustomDecks, saveCustomDecks } from '../data/customDecks';
import {
  loadSRSStore,
  loadStats,
  newCard,
  type SRSCard,
  saveSRSStore,
  saveStats,
} from '../data/srs';
import { pullAndMerge, readLocalProgress } from '../lib/sync-manager';
import type { ProgressPayload } from '../lib/sync-types';
import ResetProgress, { clearLocalSrs } from './ResetProgress';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

const DECK: CustomDeck = {
  id: 'deck-1',
  name: 'John 1',
  wordKeys: ['λόγος'],
  createdAt: '2026-09-01T00:00:00.000Z',
};

function seedLocal() {
  const store: Record<string, SRSCard> = {};
  for (const key of ['λόγος', 'θεός', 'ἀρχή']) {
    store[key] = { ...newCard(key), repetition: 3, interval: 12, lastReviewed: '2026-10-01' };
  }
  saveSRSStore(store);
  saveStats({ ...loadStats(), totalReviewed: 50, totalCorrect: 40 });
  saveCustomDecks([DECK]);
}

/**
 * An in-memory /api/progress with greek's real semantics: GET returns null
 * until something is stored, PUT is a full replace, DELETE removes everything
 * (cards, stats, decks, passages, parse history).
 */
function fakeServer(initial: ProgressPayload | null) {
  let data = initial;
  const calls: string[] = [];
  const handler = vi.fn(async (_url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push(method);
    if (method === 'GET') return new Response(JSON.stringify({ data }), { status: 200 });
    if (method === 'DELETE') {
      data = null;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const syncedAt = new Date().toISOString();
    data = { ...(JSON.parse(String(init.body)) as ProgressPayload), syncedAt };
    return new Response(JSON.stringify({ syncedAt }), { status: 200 });
  });
  return {
    handler,
    calls,
    get data() {
      return data;
    },
  };
}

function serverCopyOfLocal(): ProgressPayload {
  return { ...readLocalProgress(), syncedAt: '2026-10-01T00:00:00.000Z' };
}

beforeEach(() => {
  localStorage.clear();
  seedLocal();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function confirmReset() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Reset review progress…' }));
  await user.type(screen.getByLabelText('Type RESET to confirm'), 'RESET');
  await user.click(screen.getByRole('button', { name: 'Erase review progress' }));
}

describe('greek.tools ResetProgress', () => {
  it('names focus passage vocabulary as sharing the flashcard schedules, and lists what is kept', async () => {
    const user = userEvent.setup();
    render(<ResetProgress signedIn={false} />);
    await user.click(screen.getByRole('button', { name: 'Reset review progress…' }));

    const panel = screen.getByRole('group', { name: 'Erase all review progress?' });
    expect(panel).toHaveTextContent(/Vocabulary flashcards/);
    expect(panel).toHaveTextContent(/Focus passage vocabulary/);
    expect(panel).toHaveTextContent(
      'Kept: your streak, accuracy stats, custom decks, focus passages and parse history.',
    );
  });

  it('signed out: clears the SRS store only, with no network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ResetProgress signedIn={false} />);
    await confirmReset();

    expect(await screen.findByRole('status')).toHaveTextContent('erased in this browser');
    expect(loadSRSStore()).toEqual({});
    expect(loadStats()).toMatchObject({ totalReviewed: 50 });
    expect(loadCustomDecks()).toEqual([DECK]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signed in: deletes the account copy, then restores the decks and stats it took with it', async () => {
    const server = fakeServer(serverCopyOfLocal());
    vi.stubGlobal('fetch', server.handler);
    render(<ResetProgress signedIn />);
    await confirmReset();

    expect(await screen.findByRole('status')).toHaveTextContent('and on your account');
    expect(server.calls).toEqual(['DELETE', 'PUT']);
    expect(server.data?.srsStore).toEqual({});
    expect(server.data?.customDecks).toEqual([DECK]);
    expect(server.data?.studyStats.totalReviewed).toBe(50);
  });

  it('signed in: a reset survives the next "Sync now"', async () => {
    const server = fakeServer(serverCopyOfLocal());
    vi.stubGlobal('fetch', server.handler);
    render(<ResetProgress signedIn />);
    await confirmReset();
    await screen.findByRole('status');

    await pullAndMerge();

    expect(loadSRSStore()).toEqual({});
  });

  it('the old local-only reset was undone by the next "Sync now"', async () => {
    // What the Flashcards footer button used to do: clear localStorage and
    // nothing else. A pull merges the server's cards straight back.
    const server = fakeServer(serverCopyOfLocal());
    vi.stubGlobal('fetch', server.handler);

    clearLocalSrs();
    expect(loadSRSStore()).toEqual({});
    await pullAndMerge();

    expect(new Set(Object.keys(loadSRSStore()))).toEqual(new Set(['λόγος', 'θεός', 'ἀρχή']));
  });

  it('does not push when the delete fails, and reports the failure without undoing the local reset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ResetProgress signedIn />);
    await confirmReset();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be erased/);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(loadSRSStore()).toEqual({});
  });
});
