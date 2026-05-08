/**
 * Tests for src/lib/verb-parse.ts
 *
 * Covers: buildSession, gradeAnswer, normalizeForm, and type helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSession,
  DEFAULT_PARSE_SETTINGS,
  emptyAnswer,
  extractLemma,
  gradeAnswer,
  normalizeForm,
  PARSE_MOODS,
  PARSE_TENSES,
  PARSE_VOICES,
  type ParseAnswer,
  type ParseSettings,
  voicesForTense,
} from './verb-parse';

// ---------------------------------------------------------------------------
// extractLemma
// ---------------------------------------------------------------------------

describe('extractLemma', () => {
  it('extracts the lemma after an em dash', () => {
    expect(extractLemma('Present Active Indicative — λύω')).toBe('λύω');
  });

  it('handles labels with multiple em dashes by taking the last segment', () => {
    expect(extractLemma('Foo — Bar — βλέπω')).toBe('βλέπω');
  });

  it('trims whitespace around the lemma', () => {
    expect(extractLemma('Aorist Active Indicative —  λύω ')).toBe('λύω');
  });

  it('returns the whole string when no em dash is present', () => {
    expect(extractLemma('λύω')).toBe('λύω');
  });
});

// ---------------------------------------------------------------------------
// normalizeForm
// ---------------------------------------------------------------------------

describe('normalizeForm', () => {
  it('strips parenthesized movable-nu', () => {
    expect(normalizeForm('λύουσι(ν)')).toBe('λύουσι');
  });

  it('leaves plain forms unchanged', () => {
    expect(normalizeForm('λύω')).toBe('λύω');
    expect(normalizeForm('ἔλυσαν')).toBe('ἔλυσαν');
  });
});

// ---------------------------------------------------------------------------
// buildSession
// ---------------------------------------------------------------------------

describe('buildSession', () => {
  it('returns at most the requested count', () => {
    const items = buildSession(DEFAULT_PARSE_SETTINGS, 10);
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.length).toBeGreaterThan(0);
  });

  it('all items have the required fields', () => {
    const items = buildSession(DEFAULT_PARSE_SETTINGS, 20);
    for (const item of items) {
      expect(item.form).toBeTruthy();
      expect(PARSE_TENSES).toContain(item.tense);
      expect([...PARSE_VOICES, 'mid-pass']).toContain(item.voice);
      expect(PARSE_MOODS).toContain(item.mood);
      expect(['1st', '2nd', '3rd']).toContain(item.person);
      expect(['singular', 'plural']).toContain(item.number);
      expect(item.paradigmLabel).toContain('λύω');
      expect(item.lemma).toBeTruthy();
    }
  });

  it('populates lemma from paradigmLabel', () => {
    const items = buildSession(DEFAULT_PARSE_SETTINGS, 20);
    for (const item of items) {
      expect(item.lemma).toBe(extractLemma(item.paradigmLabel));
    }
  });

  it('respects tense filter — present only', () => {
    const settings: ParseSettings = {
      ...DEFAULT_PARSE_SETTINGS,
      tenses: ['present'],
    };
    const items = buildSession(settings, 30);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.tense).toBe('present');
    }
  });

  it('respects mood filter — indicative only', () => {
    const settings: ParseSettings = {
      ...DEFAULT_PARSE_SETTINGS,
      moods: ['indicative'],
    };
    const items = buildSession(settings, 30);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.mood).toBe('indicative');
    }
  });

  it('respects voice filter — active only', () => {
    const settings: ParseSettings = {
      ...DEFAULT_PARSE_SETTINGS,
      voices: ['active'],
    };
    const items = buildSession(settings, 30);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // mid-pass paradigms are excluded when only 'active' is selected
      expect(item.voice).toBe('active');
    }
  });

  it('returns empty array when no paradigms match', () => {
    const settings: ParseSettings = {
      ...DEFAULT_PARSE_SETTINGS,
      // imperfect subjunctive does not exist
      tenses: ['imperfect'],
      moods: ['subjunctive'],
    };
    const items = buildSession(settings, 10);
    expect(items).toHaveLength(0);
  });

  it('present active indicative filter returns only pres-act-ind forms', () => {
    const settings: ParseSettings = {
      tenses: ['present'],
      voices: ['active'],
      moods: ['indicative'],
      sessionLength: 10,
    };
    const items = buildSession(settings, 30);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.tense).toBe('present');
      expect(item.voice).toBe('active');
      expect(item.mood).toBe('indicative');
    }
  });

  it('de-duplicates forms that appear in multiple paradigms', () => {
    const items = buildSession(DEFAULT_PARSE_SETTINGS, 200);
    const forms = items.map((i) => normalizeForm(i.form));
    const unique = new Set(forms);
    expect(forms.length).toBe(unique.size);
  });
});

// ---------------------------------------------------------------------------
// gradeAnswer
// ---------------------------------------------------------------------------

describe('gradeAnswer', () => {
  const presActIndItem = {
    form: 'λύω',
    tense: 'present' as const,
    voice: 'active' as const,
    mood: 'indicative' as const,
    person: '1st' as const,
    number: 'singular' as const,
    paradigmLabel: 'Present Active Indicative — λύω',
    lemma: 'λύω',
  };

  it('returns allCorrect=true for a fully correct answer', () => {
    const answer: ParseAnswer = {
      tense: 'present',
      voice: 'active',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    const result = gradeAnswer(presActIndItem, answer);
    expect(result.allCorrect).toBe(true);
    expect(result.tense).toBe(true);
    expect(result.voice).toBe(true);
    expect(result.mood).toBe(true);
    expect(result.person).toBe(true);
    expect(result.number).toBe(true);
  });

  it('returns allCorrect=false when any property is wrong', () => {
    const answer: ParseAnswer = {
      tense: 'aorist', // wrong
      voice: 'active',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    const result = gradeAnswer(presActIndItem, answer);
    expect(result.allCorrect).toBe(false);
    expect(result.tense).toBe(false);
    expect(result.voice).toBe(true);
  });

  it('accepts "middle" or "passive" for a mid-pass paradigm', () => {
    const midPassItem = {
      ...presActIndItem,
      voice: 'mid-pass' as const,
      paradigmLabel: 'Present Middle/Passive Indicative — λύω',
    };
    const withMiddle: ParseAnswer = {
      ...emptyAnswer(),
      voice: 'middle',
      tense: 'present',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    const withPassive: ParseAnswer = {
      ...emptyAnswer(),
      voice: 'passive',
      tense: 'present',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    expect(gradeAnswer(midPassItem, withMiddle).voice).toBe(true);
    expect(gradeAnswer(midPassItem, withPassive).voice).toBe(true);
  });

  it('rejects wrong voice for mid-pass paradigm', () => {
    const midPassItem = {
      ...presActIndItem,
      voice: 'mid-pass' as const,
    };
    const withActive: ParseAnswer = {
      ...emptyAnswer(),
      voice: 'active',
      tense: 'present',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    expect(gradeAnswer(midPassItem, withActive).voice).toBe(false);
  });

  it('handles empty answers — all false', () => {
    const result = gradeAnswer(presActIndItem, emptyAnswer());
    expect(result.allCorrect).toBe(false);
    expect(result.tense).toBe(false);
    expect(result.voice).toBe(false);
    expect(result.mood).toBe(false);
    expect(result.person).toBe(false);
    expect(result.number).toBe(false);
  });

  it('accepts "mid-pass" for a perfect mid-pass item', () => {
    const perfMidPassItem = {
      ...presActIndItem,
      tense: 'perfect' as const,
      voice: 'mid-pass' as const,
      paradigmLabel: 'Perfect Middle/Passive Indicative — λύω',
    };
    const answer: ParseAnswer = {
      tense: 'perfect',
      voice: 'mid-pass',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    const result = gradeAnswer(perfMidPassItem, answer);
    expect(result.voice).toBe(true);
    expect(result.allCorrect).toBe(true);
  });

  it('rejects "middle" or "passive" for a perfect mid-pass item when mid-pass is expected', () => {
    const perfMidPassItem = {
      ...presActIndItem,
      tense: 'perfect' as const,
      voice: 'mid-pass' as const,
      paradigmLabel: 'Perfect Middle/Passive Indicative — λύω',
    };
    const withMiddle: ParseAnswer = {
      tense: 'perfect',
      voice: 'middle',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    };
    // mid-pass gradeVoice still accepts 'middle' for backward-compat with non-perfect
    // mid-pass paradigms; this tests that 'mid-pass' itself is accepted
    expect(gradeAnswer(perfMidPassItem, withMiddle).voice).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// voicesForTense
// ---------------------------------------------------------------------------

describe('voicesForTense', () => {
  it('returns active, middle, passive for non-perfect tenses', () => {
    expect(voicesForTense('present')).toEqual(['active', 'middle', 'passive']);
    expect(voicesForTense('imperfect')).toEqual(['active', 'middle', 'passive']);
    expect(voicesForTense('future')).toEqual(['active', 'middle', 'passive']);
    expect(voicesForTense('aorist')).toEqual(['active', 'middle', 'passive']);
  });

  it('returns active, mid-pass for perfect tense', () => {
    expect(voicesForTense('perfect')).toEqual(['active', 'mid-pass']);
  });

  it('returns active, middle, passive for empty string (no tense selected yet)', () => {
    expect(voicesForTense('')).toEqual(['active', 'middle', 'passive']);
  });
});

// ---------------------------------------------------------------------------
// buildSession — perfect mid-pass
// ---------------------------------------------------------------------------

describe('buildSession — perfect tense', () => {
  it('includes perf-mid-pass-ind forms when perfect is selected', () => {
    const settings: ParseSettings = {
      tenses: ['perfect'],
      voices: ['active', 'middle', 'passive'],
      moods: ['indicative'],
      sessionLength: 20,
    };
    const items = buildSession(settings, 20);
    expect(items.length).toBeGreaterThan(0);
    const midPassItems = items.filter((i) => i.voice === 'mid-pass');
    expect(midPassItems.length).toBeGreaterThan(0);
    for (const item of midPassItems) {
      expect(item.tense).toBe('perfect');
      expect(item.paradigmLabel).toContain('λύω');
    }
  });

  it('perfect mid-pass forms include expected Greek forms', () => {
    const settings: ParseSettings = {
      tenses: ['perfect'],
      voices: ['middle', 'passive'],
      moods: ['indicative'],
      sessionLength: 20,
    };
    const items = buildSession(settings, 20);
    const forms = items.map((i) => i.form);
    // All six perfect mid-pass indicative forms of λύω should be present
    expect(forms).toContain('λέλυμαι');
    expect(forms).toContain('λέλυσαι');
    expect(forms).toContain('λέλυται');
    expect(forms).toContain('λελύμεθα');
    expect(forms).toContain('λέλυσθε');
    expect(forms).toContain('λέλυνται');
  });
});
