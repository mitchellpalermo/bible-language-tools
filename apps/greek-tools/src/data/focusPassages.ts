import type { SRSCard } from './srs';

export interface FocusPassage {
  id: string;
  label?: string;
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
  createdAt: string;
}

export interface ParseHistory {
  correct: number;
  total: number;
}

const PASSAGES_KEY = 'greek-tools-focus-passages-v1';
const PARSE_KEY = 'greek-tools-focus-parse-v1';

export function loadFocusPassages(): FocusPassage[] {
  try {
    const raw = localStorage.getItem(PASSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FocusPassage[];
  } catch {
    return [];
  }
}

export function saveFocusPassages(passages: FocusPassage[]): void {
  localStorage.setItem(PASSAGES_KEY, JSON.stringify(passages));
}

export function loadParseHistoryStore(): Record<string, ParseHistory> {
  try {
    const raw = localStorage.getItem(PARSE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ParseHistory>;
  } catch {
    return {};
  }
}

export function saveParseHistoryStore(store: Record<string, ParseHistory>): void {
  localStorage.setItem(PARSE_KEY, JSON.stringify(store));
}

export function recordParseSession(id: string, correct: number, total: number): void {
  const store = loadParseHistoryStore();
  const prev = store[id] ?? { correct: 0, total: 0 };
  store[id] = { correct: prev.correct + correct, total: prev.total + total };
  saveParseHistoryStore(store);
}

export function deletePassage(id: string): void {
  saveFocusPassages(loadFocusPassages().filter((p) => p.id !== id));
  const store = loadParseHistoryStore();
  delete store[id];
  saveParseHistoryStore(store);
}

export type MaturityLevel = 0 | 1 | 2 | 3;

export function getMaturityLevel(interval: number): MaturityLevel {
  if (interval <= 0) return 0;
  if (interval <= 5) return 1;
  if (interval <= 20) return 2;
  return 3;
}

export interface MaturityBreakdown {
  mature: number;
  familiar: number;
  learning: number;
  unseen: number;
}

export function getVocabMaturityBreakdown(
  lemmas: string[],
  srsStore: Record<string, SRSCard>,
): MaturityBreakdown {
  const result: MaturityBreakdown = { mature: 0, familiar: 0, learning: 0, unseen: 0 };
  for (const lemma of lemmas) {
    const card = srsStore[lemma];
    if (!card) {
      result.unseen++;
    } else {
      const level = getMaturityLevel(card.interval);
      if (level === 3) result.mature++;
      else if (level === 2) result.familiar++;
      else if (level === 1) result.learning++;
      else result.unseen++;
    }
  }
  return result;
}

export type ParseGrade = 'A' | 'B' | 'C' | 'D' | 'E' | '—';

export function getParseGrade(id: string): ParseGrade {
  const store = loadParseHistoryStore();
  const entry = store[id];
  if (!entry || entry.total === 0) return '—';
  const accuracy = entry.correct / entry.total;
  if (accuracy >= 0.9) return 'A';
  if (accuracy >= 0.75) return 'B';
  if (accuracy >= 0.6) return 'C';
  if (accuracy >= 0.45) return 'D';
  return 'E';
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
