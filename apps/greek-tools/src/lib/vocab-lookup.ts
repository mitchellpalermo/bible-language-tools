import { vocabulary } from '../data/vocabulary';

export interface VocabEntry {
  gloss: string;
  frequency: number;
}

export function buildVocabLookup(): Map<string, VocabEntry> {
  const map = new Map<string, VocabEntry>();
  for (const w of vocabulary) {
    for (const form of w.greek.split(', ')) {
      map.set(form.trim(), { gloss: w.gloss, frequency: w.frequency });
    }
  }
  return map;
}

export const vocabLookup = buildVocabLookup();
