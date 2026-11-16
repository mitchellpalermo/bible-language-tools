// The verb forms /parse asks (#82), read from `public/data/morphhb/parse-forms.json`.
//
// The file is built from the corpus by `scripts/lib/parse-forms.mjs` (see its
// header for what is in the pool and why), gitignored with the rest of the
// corpus, and about 120 KB gzipped. It is fetched once per page and cached.

import { type ParseItem, type ParseLemma, readVerbMorph } from '../lib/verb-parse';

/** The file as written: `[form, [[lemma, morph, count], …]]`. */
export interface ParseFormsFile {
  lemmas: Record<string, [headword: string, root: string]>;
  forms: [form: string, readings: [lemma: string, morph: string, count: number][]][];
}

export interface ParsePool {
  items: ParseItem[];
  lemmas: Record<string, ParseLemma>;
}

/**
 * The file as items. A reading whose code the drill cannot read is dropped,
 * and a form left with none is dropped with it; the corpus test asserts that
 * neither ever happens, so this is a guard and not a filter.
 */
export function decodeParseForms(file: ParseFormsFile): ParsePool {
  const lemmas = Object.fromEntries(
    Object.entries(file.lemmas).map(([key, [headword, root]]) => [key, { headword, root }]),
  );
  const items: ParseItem[] = [];
  for (const [form, raw] of file.forms) {
    const readings = raw.flatMap(([lemma, morph]) => readVerbMorph(lemma, morph) ?? []);
    if (readings.length > 0) items.push({ form, readings });
  }
  return { items, lemmas };
}

let cache: Promise<ParsePool> | null = null;

export function fetchParseForms(): Promise<ParsePool> {
  cache ??= fetch('/data/morphhb/parse-forms.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load parse forms: HTTP ${res.status}`);
      return res.json() as Promise<ParseFormsFile>;
    })
    .then(decodeParseForms)
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

/** For tests. */
export function clearParseFormsCache(): void {
  cache = null;
}
