// Which forms /parse asks, kept per browser (`hebrew-tools-parse-settings-v1`).
// A preference about the session, not progress, so it is never synced — the
// same reasoning as the deck selection. Read through `useStoredState`.

import { isSessionLength } from '@tools/shared/parse-drill';
import {
  DEFAULT_PARSE_SETTINGS,
  PARSE_CONJUGATIONS,
  PARSE_STEMS,
  type ParseSettings,
} from './verb-parse';

export const PARSE_SETTINGS_KEY = 'hebrew-tools-parse-settings-v1';

/** Only values the drill offers, in its order; `null` when nothing valid is left. */
function known<T extends string>(list: readonly T[], value: unknown): T[] | null {
  if (!Array.isArray(value)) return null;
  return list.filter((v) => value.includes(v));
}

export function loadParseSettings(): ParseSettings {
  try {
    const raw = localStorage.getItem(PARSE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PARSE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Record<keyof ParseSettings, unknown>>;
    return {
      stems: known(PARSE_STEMS, parsed.stems) ?? [...DEFAULT_PARSE_SETTINGS.stems],
      conjugations: known(PARSE_CONJUGATIONS, parsed.conjugations) ?? [
        ...DEFAULT_PARSE_SETTINGS.conjugations,
      ],
      askRoot:
        typeof parsed.askRoot === 'boolean' ? parsed.askRoot : DEFAULT_PARSE_SETTINGS.askRoot,
      sessionLength: isSessionLength(parsed.sessionLength)
        ? parsed.sessionLength
        : DEFAULT_PARSE_SETTINGS.sessionLength,
    };
  } catch {
    return { ...DEFAULT_PARSE_SETTINGS };
  }
}

export function saveParseSettings(settings: ParseSettings): void {
  localStorage.setItem(PARSE_SETTINGS_KEY, JSON.stringify(settings));
}
