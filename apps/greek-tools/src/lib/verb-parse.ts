/**
 * Verb parsing challenge — form pool generation, types, and grading logic.
 *
 * Draws entirely from verbParadigms[] in src/data/grammar.ts.
 * No Greek text input needed; all answers are dropdown selections.
 */

import { type PersonNum, verbParadigms } from '../data/grammar';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ParseTense = 'present' | 'imperfect' | 'future' | 'aorist' | 'perfect';
export type ParseVoice = 'active' | 'middle' | 'passive' | 'mid-pass';
export type ParseMood = 'indicative' | 'subjunctive' | 'imperative';
export type ParsePerson = '1st' | '2nd' | '3rd';
export type ParseNumber = 'singular' | 'plural';

export const PARSE_TENSES: ParseTense[] = ['present', 'imperfect', 'future', 'aorist', 'perfect'];
export const PARSE_VOICES: ParseVoice[] = ['active', 'middle', 'passive'];
export const PARSE_MOODS: ParseMood[] = ['indicative', 'subjunctive', 'imperative'];
export const PARSE_PERSONS: ParsePerson[] = ['1st', '2nd', '3rd'];
export const PARSE_NUMBERS: ParseNumber[] = ['singular', 'plural'];

export const TENSE_LABELS: Record<ParseTense, string> = {
  present: 'Present',
  imperfect: 'Imperfect',
  future: 'Future',
  aorist: 'Aorist',
  perfect: 'Perfect',
};

export const VOICE_LABELS: Record<ParseVoice, string> = {
  active: 'Active',
  middle: 'Middle',
  passive: 'Passive',
  'mid-pass': 'Middle/Passive',
};

export const MOOD_LABELS: Record<ParseMood, string> = {
  indicative: 'Indicative',
  subjunctive: 'Subjunctive',
  imperative: 'Imperative',
};

export const PERSON_LABELS: Record<ParsePerson, string> = {
  '1st': '1st',
  '2nd': '2nd',
  '3rd': '3rd',
};

export const NUMBER_LABELS: Record<ParseNumber, string> = {
  singular: 'Singular',
  plural: 'Plural',
};

/**
 * Returns the available voice options for a given tense.
 * Perfect tense only has Active and Middle/Passive (no distinct passive form),
 * so 'mid-pass' replaces separate 'middle' and 'passive' options.
 */
export function voicesForTense(tense: ParseTense | ''): ParseVoice[] {
  if (tense === 'perfect') return ['active', 'mid-pass'];
  return ['active', 'middle', 'passive'];
}

/** A single verb form together with its full parse. */
export interface ParseItem {
  form: string;
  tense: ParseTense;
  voice: ParseVoice;
  mood: ParseMood;
  person: ParsePerson;
  number: ParseNumber;
  /** Display label for the source paradigm, e.g. "Present Active Indicative — λύω" */
  paradigmLabel: string;
  /** Base verb lemma extracted from paradigmLabel, e.g. "λύω" */
  lemma: string;
  /** Other valid parses when the same form appears in multiple paradigms. */
  ambiguous?: string[];
}

/** The student's answer for one ParseItem. */
export interface ParseAnswer {
  tense: ParseTense | '';
  voice: ParseVoice | '';
  mood: ParseMood | '';
  person: ParsePerson | '';
  number: ParseNumber | '';
}

/** Per-property grading for a single form. */
export interface ParseResult {
  tense: boolean;
  voice: boolean;
  mood: boolean;
  person: boolean;
  number: boolean;
  /** true iff all five properties are correct */
  allCorrect: boolean;
}

export function emptyAnswer(): ParseAnswer {
  return { tense: '', voice: '', mood: '', person: '', number: '' };
}

// ---------------------------------------------------------------------------
// Parse code extraction from paradigm ID
// ---------------------------------------------------------------------------

/** Map paradigm id segment → ParseTense */
const ID_TENSE: Record<string, ParseTense> = {
  pres: 'present',
  impf: 'imperfect',
  fut: 'future',
  aor: 'aorist',
  perf: 'perfect',
};

/** Map paradigm id segment → ParseVoice */
const ID_VOICE: Record<string, ParseVoice> = {
  act: 'active',
  mid: 'middle',
  pass: 'passive',
  'mid-pass': 'mid-pass',
};

/** Map paradigm id segment → ParseMood */
const ID_MOOD: Record<string, ParseMood> = {
  ind: 'indicative',
  subj: 'subjunctive',
  imp: 'imperative',
};

/** Map PersonNum key → ParsePerson + ParseNumber */
const PERSON_MAP: Record<PersonNum, { person: ParsePerson; number: ParseNumber }> = {
  '1sg': { person: '1st', number: 'singular' },
  '2sg': { person: '2nd', number: 'singular' },
  '3sg': { person: '3rd', number: 'singular' },
  '1pl': { person: '1st', number: 'plural' },
  '2pl': { person: '2nd', number: 'plural' },
  '3pl': { person: '3rd', number: 'plural' },
};

/** Extracts the lemma from a paradigm label, e.g. "Present Active Indicative — λύω" → "λύω" */
export function extractLemma(paradigmLabel: string): string {
  const parts = paradigmLabel.split(' — ');
  return parts[parts.length - 1].trim();
}

function parseTenseFromId(id: string): ParseTense | null {
  for (const [seg, tense] of Object.entries(ID_TENSE)) {
    if (id.startsWith(`${seg}-`)) return tense;
  }
  return null;
}

function parseVoiceFromId(id: string): ParseVoice | null {
  // Order matters: check mid-pass before mid and pass
  for (const seg of ['mid-pass', 'act', 'mid', 'pass']) {
    if (id.includes(`-${seg}-`)) return ID_VOICE[seg];
  }
  return null;
}

function parseMoodFromId(id: string): ParseMood | null {
  for (const [seg, mood] of Object.entries(ID_MOOD)) {
    if (id.endsWith(`-${seg}`)) return mood;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------

export interface ParseSettings {
  tenses: ParseTense[];
  voices: ParseVoice[];
  moods: ParseMood[];
  sessionLength: 10 | 20 | 30;
}

export const DEFAULT_PARSE_SETTINGS: ParseSettings = {
  tenses: [...PARSE_TENSES],
  voices: ['active', 'middle', 'passive'],
  moods: [...PARSE_MOODS],
  sessionLength: 20,
};

// ---------------------------------------------------------------------------
// Form pool generation
// ---------------------------------------------------------------------------

/**
 * Build the full pool of ParseItems from verbParadigms, then filter,
 * de-duplicate visible forms, and return a shuffled session of `count` items.
 */
export function buildSession(settings: ParseSettings, count: number): ParseItem[] {
  // 1. Expand all paradigms into individual ParseItems
  const allItems: ParseItem[] = [];

  for (const paradigm of verbParadigms) {
    const tense = parseTenseFromId(paradigm.id);
    const voice = parseVoiceFromId(paradigm.id);
    const mood = parseMoodFromId(paradigm.id);
    if (!tense || !voice || !mood) continue;

    // Filter by settings — mid-pass paradigms can count for either middle or passive
    const voiceMatch =
      settings.voices.includes(voice) ||
      (voice === 'mid-pass' &&
        (settings.voices.includes('middle') || settings.voices.includes('passive')));

    if (!settings.tenses.includes(tense) || !voiceMatch || !settings.moods.includes(mood)) continue;

    const paradigmLabel = `${paradigm.label} — λύω`;
    const lemma = extractLemma(paradigmLabel);
    for (const [personNum, form] of Object.entries(paradigm.forms) as [PersonNum, string][]) {
      const { person, number } = PERSON_MAP[personNum];
      allItems.push({
        form,
        tense,
        voice,
        mood,
        person,
        number,
        paradigmLabel,
        lemma,
      });
    }
  }

  // 2. Group by normalized form to detect ambiguous forms
  const byForm = new Map<string, ParseItem[]>();
  for (const item of allItems) {
    const key = normalizeForm(item.form);
    const existing = byForm.get(key) ?? [];
    existing.push(item);
    byForm.set(key, existing);
  }

  // 3. De-duplicate: for forms shared across paradigms, keep first occurrence
  //    but annotate with ambiguous[] listing the other parses.
  const deduped: ParseItem[] = [];
  for (const [, items] of byForm) {
    const primary = items[0];
    if (items.length > 1) {
      primary.ambiguous = items
        .slice(1)
        .map(
          (i) =>
            `${TENSE_LABELS[i.tense]} ${VOICE_LABELS[i.voice]} ${MOOD_LABELS[i.mood]} ${i.person} ${NUMBER_LABELS[i.number]}`,
        );
    }
    deduped.push(primary);
  }

  // 4. Shuffle and take `count`
  const shuffled = shuffle(deduped);
  return shuffled.slice(0, count);
}

/** Grade a student's answer against the correct parse. */
export function gradeAnswer(item: ParseItem, answer: ParseAnswer): ParseResult {
  const tense = answer.tense === item.tense;
  const voice = gradeVoice(item.voice, answer.voice);
  const mood = answer.mood === item.mood;
  const person = answer.person === item.person;
  const number = answer.number === item.number;
  return {
    tense,
    voice,
    mood,
    person,
    number,
    allCorrect: tense && voice && mood && person && number,
  };
}

/** mid-pass paradigms accept either 'middle' or 'passive' as correct. */
function gradeVoice(correct: ParseVoice, given: ParseVoice | ''): boolean {
  if (!given) return false;
  if (given === correct) return true;
  if (correct === 'mid-pass' && (given === 'middle' || given === 'passive')) return true;
  return false;
}

/** Strip parenthesized movable-nu variants, e.g. "λύουσι(ν)" → "λύουσι" */
export function normalizeForm(form: string): string {
  return form.replace(/\([^)]+\)$/, '').trim();
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const PARSE_SETTINGS_KEY = 'greek-tools-parse-settings-v1';

export function loadParseSettings(): ParseSettings {
  try {
    const raw = localStorage.getItem(PARSE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PARSE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ParseSettings>;
    return {
      tenses: Array.isArray(parsed.tenses) ? parsed.tenses : [...PARSE_TENSES],
      voices: Array.isArray(parsed.voices) ? parsed.voices : ['active', 'middle', 'passive'],
      moods: Array.isArray(parsed.moods) ? parsed.moods : [...PARSE_MOODS],
      sessionLength: ([10, 20, 30] as const).includes(parsed.sessionLength as 10 | 20 | 30)
        ? (parsed.sessionLength as 10 | 20 | 30)
        : 20,
    };
  } catch {
    return { ...DEFAULT_PARSE_SETTINGS };
  }
}

export function saveParseSettings(settings: ParseSettings): void {
  localStorage.setItem(PARSE_SETTINGS_KEY, JSON.stringify(settings));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
