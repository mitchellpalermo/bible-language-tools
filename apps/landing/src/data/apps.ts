/** One daughter app, as the landing page presents it. */
export interface AppEntry {
  /** Stable id; also the CSS class that picks the app's colour. */
  id: 'greek' | 'hebrew';
  name: string;
  /** The short label used in the nav. */
  navLabel: string;
  language: string;
  /** The letter on the card (alpha, alef). */
  glyph: string;
  /** BCP 47 tag for the glyph, so screen readers and fonts pick the script. */
  glyphLang: 'grc' | 'he';
  dir: 'ltr' | 'rtl';
  description: string;
  features: string[];
  url: string;
}

export const apps: AppEntry[] = [
  {
    id: 'greek',
    name: 'Greek Tools',
    navLabel: 'Greek',
    language: 'Koine Greek',
    glyph: 'α',
    glyphLang: 'grc',
    dir: 'ltr',
    description:
      'Read the Greek New Testament, and drill the vocabulary, paradigms and parsing behind it.',
    features: ['Flashcards', 'Paradigms', 'Parsing', 'Reader'],
    url: 'https://greek.tools',
  },
  {
    id: 'hebrew',
    name: 'Hebrew Tools',
    navLabel: 'Hebrew',
    language: 'Biblical Hebrew',
    glyph: 'א',
    glyphLang: 'he',
    dir: 'rtl',
    description:
      'Flashcards, verb tables, handwriting and a reader, all built on the text of the Hebrew Bible.',
    features: ['Flashcards', 'Paradigms', 'Handwriting', 'Reader'],
    url: 'https://hebrew.tools',
  },
];

/** The host shown under a card: `https://greek.tools` becomes `greek.tools`. */
export function hostOf(url: string): string {
  return new URL(url).host;
}
