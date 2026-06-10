// Client-side sync lifecycle for signed-in users.
//
// Sync is a layer on top of the existing localStorage read/write paths in
// src/data/srs.ts and src/data/customDecks.ts — it never replaces them, and a
// sync failure must never interrupt a study session. Every network error here
// is caught; callers get a boolean and the UI decides whether to surface it
// (only the account page does).

import { loadCustomDecks, saveCustomDecks } from '../data/customDecks';
import { loadSRSStore, loadStats, saveSRSStore, saveStats } from '../data/srs';
import { hasAuthHint } from './auth-cookie';
import { mergeProgress, type ProgressSnapshot } from './sync-merge';
import type { ProgressPayload } from './sync-types';

export const LAST_SYNCED_KEY = 'greek-tools-last-synced';
export const IMPORT_OFFERED_KEY = 'greek-tools-import-offered';

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, iso);
  } catch {
    // localStorage unavailable — sync status display degrades gracefully
  }
}

export function readLocalProgress(): ProgressSnapshot {
  return {
    srsStore: loadSRSStore(),
    studyStats: loadStats(),
    customDecks: loadCustomDecks(),
  };
}

export function writeLocalProgress(snapshot: ProgressSnapshot): void {
  saveSRSStore(snapshot.srsStore);
  saveStats(snapshot.studyStats);
  saveCustomDecks(snapshot.customDecks);
}

/** Does this device have any study progress worth importing? */
export function hasLocalProgress(): boolean {
  const { srsStore, customDecks } = readLocalProgress();
  if (customDecks.length > 0) return true;
  return Object.values(srsStore).some((card) => card.repetition > 0);
}

async function putProgress(
  snapshot: ProgressSnapshot,
  init: RequestInit = {},
): Promise<string | null> {
  const response = await fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
    ...init,
  });
  if (!response.ok) return null;
  const { syncedAt } = (await response.json()) as { syncedAt: string };
  return syncedAt;
}

/**
 * Push the current local state to the server.
 * Returns true on success; never throws.
 */
export async function push(init: RequestInit = {}): Promise<boolean> {
  try {
    const syncedAt = await putProgress(readLocalProgress(), init);
    if (!syncedAt) return false;
    setLastSyncedAt(syncedAt);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull server progress, merge it with local state, and write the merged
 * result back to both sides. Returns true on success; never throws.
 */
export async function pullAndMerge(): Promise<boolean> {
  try {
    const response = await fetch('/api/progress');
    if (!response.ok) return false;
    const { data } = (await response.json()) as { data: ProgressPayload | null };

    const local = readLocalProgress();
    const merged = data ? mergeProgress(local, data) : local;

    writeLocalProgress(merged);

    const syncedAt = await putProgress(merged);
    if (!syncedAt) return false;
    setLastSyncedAt(syncedAt);
    return true;
  } catch {
    return false;
  }
}

/** Delete all server-side progress (the "Start fresh" import option). */
export async function deleteServerProgress(): Promise<boolean> {
  try {
    const response = await fetch('/api/progress', { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Push progress when the tab is hidden — the "session end" signal. Uses
 * keepalive so the request survives navigation. Skipped when signed out.
 *
 * Browsers cap keepalive bodies at 64 KB; a very large store makes this
 * particular push fail silently, and the next sign-in pull or manual
 * "Sync now" covers it.
 */
export function registerSessionEndPush(target: Document = document): void {
  target.addEventListener('visibilitychange', () => {
    if (target.visibilityState !== 'hidden') return;
    if (!hasAuthHint()) return;
    void push({ keepalive: true });
  });
}

/** "Last synced 3 minutes ago" / "just now" — for the account page display. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
