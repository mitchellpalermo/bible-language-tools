import { createDb } from '@tools/db';
import type { APIRoute } from 'astro';
import { deleteProgress, getProgress, putProgress } from '../../lib/progress-store';
import type { ProgressPayload } from '../../lib/sync-types';

export const prerender = false;

/** Reject request bodies larger than this (decoded bytes). */
export const MAX_BODY_BYTES = 512 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Same response for missing and expired sessions — do not leak which.
const unauthorized = () => json({ error: 'Unauthorized' }, 401);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STATS_NUMBER_FIELDS = [
  'streak',
  'cardsStudiedToday',
  'totalReviewed',
  'totalCorrect',
] as const;
const STATS_STRING_FIELDS = ['lastStreakDate', 'lastStudyDate'] as const;

function validatePayload(
  body: unknown,
): Pick<ProgressPayload, 'srsStore' | 'studyStats' | 'customDecks' | 'focusPassages' | 'parseHistory'> | null {
  if (!isRecord(body)) return null;

  const { srsStore, studyStats, customDecks, focusPassages, parseHistory } = body;
  if (!isRecord(srsStore)) return null;

  if (!isRecord(studyStats)) return null;
  if (STATS_NUMBER_FIELDS.some((f) => typeof studyStats[f] !== 'number')) return null;
  if (STATS_STRING_FIELDS.some((f) => typeof studyStats[f] !== 'string')) return null;

  if (!Array.isArray(customDecks)) return null;
  for (const deck of customDecks) {
    if (!isRecord(deck)) return null;
    if (typeof deck.id !== 'string' || typeof deck.name !== 'string') return null;
    if (!Array.isArray(deck.wordKeys) || typeof deck.createdAt !== 'string') return null;
  }

  for (const card of Object.values(srsStore)) {
    if (!isRecord(card)) return null;
    if (
      typeof card.interval !== 'number' ||
      typeof card.repetition !== 'number' ||
      typeof card.easeFactor !== 'number' ||
      typeof card.dueDate !== 'string' ||
      typeof card.lastReviewed !== 'string'
    ) {
      return null;
    }
  }

  // focusPassages defaults to [] for old clients that predate this field.
  const passages = Array.isArray(focusPassages) ? focusPassages : [];
  for (const p of passages) {
    if (!isRecord(p)) return null;
    if (typeof p.id !== 'string' || typeof p.book !== 'string') return null;
    if (
      typeof p.startChapter !== 'number' ||
      typeof p.startVerse !== 'number' ||
      typeof p.endChapter !== 'number' ||
      typeof p.endVerse !== 'number'
    ) {
      return null;
    }
    if (typeof p.createdAt !== 'string') return null;
    if (p.label !== undefined && p.label !== null && typeof p.label !== 'string') return null;
  }

  // parseHistory defaults to {} for old clients that predate this field.
  const history = isRecord(parseHistory) ? parseHistory : {};
  for (const entry of Object.values(history)) {
    if (!isRecord(entry)) return null;
    if (typeof entry.correct !== 'number' || typeof entry.total !== 'number') return null;
  }

  return {
    ...(body as object),
    focusPassages: passages,
    parseHistory: history,
  } as Pick<ProgressPayload, 'srsStore' | 'studyStats' | 'customDecks' | 'focusPassages' | 'parseHistory'>;
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return unauthorized();
  const db = createDb(locals.runtime.env.DB);
  const data = await getProgress(db, locals.user.id);
  return json({ data });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return unauthorized();

  // Read as text and parse manually: keepalive pushes from the client may not
  // carry an application/json content type, and we need the real byte size.
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const payload = validatePayload(body);
  if (!payload) return json({ error: 'Invalid payload' }, 400);

  const db = createDb(locals.runtime.env.DB);
  const syncedAt = await putProgress(db, locals.user.id, payload);
  return json({ syncedAt });
};

export const DELETE: APIRoute = async ({ locals }) => {
  if (!locals.user) return unauthorized();
  const db = createDb(locals.runtime.env.DB);
  await deleteProgress(db, locals.user.id);
  return json({ ok: true });
};
