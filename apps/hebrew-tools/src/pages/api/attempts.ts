// The attempt log's own endpoint (#196). It is not part of /api/progress: a
// full log is too large for that payload, and it is append-only, so it needs no
// read-merge-replace. See progress-store.ts, "The attempt log".
//
// DELETE lives on /api/progress, which clears the log along with everything
// else — one route for every destructive act.

import { createDb } from '@tools/db';
import { type Attempt, MAX_ATTEMPTS_PER_REQUEST, parseAttempt } from '@tools/shared/attempt-log';
import type { APIRoute } from 'astro';
import { appendAttempts, getAttempts } from '../../lib/progress-store';
import type { AttemptsPayload } from '../../lib/sync-types';

export const prerender = false;

/** Reject request bodies larger than this (decoded bytes). A full request is ~130 KB. */
export const MAX_BODY_BYTES = 512 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Same response for missing and expired sessions — do not leak which.
const unauthorized = () => json({ error: 'Unauthorized' }, 401);

/** Every attempt checked, or null on any violation; the caller turns that into a 400. */
function validateAttempts(body: unknown): Attempt[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const { attempts } = body as Record<string, unknown>;
  if (!Array.isArray(attempts) || attempts.length > MAX_ATTEMPTS_PER_REQUEST) return null;
  const parsed = attempts.map(parseAttempt);
  return parsed.every((a) => a !== null) ? (parsed as Attempt[]) : null;
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return unauthorized();
  const db = createDb(locals.runtime.env.DB);
  const payload: AttemptsPayload = { attempts: await getAttempts(db, locals.user.id) };
  return json(payload);
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) return unauthorized();

  // Read as text and parse manually: keepalive pushes may not carry an
  // application/json content type, and we need the real byte size.
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

  const attempts = validateAttempts(body);
  if (!attempts) return json({ error: 'Invalid payload' }, 400);

  const db = createDb(locals.runtime.env.DB);
  await appendAttempts(db, locals.user.id, attempts);
  return json({ ok: true });
};
