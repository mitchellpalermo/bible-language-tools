// The study modes behind the Study nav group and the /study hub (#229).
//
// Both read this list (Layout.astro and pages/study.astro), so a mode added
// here has its card and its nav child together; src/test/study-modes.test.ts
// fails when either stops reading it. There is no /quiz hub: Paradigms and
// Parse are modes in their own right, one tap from /study, as on hebrew.tools.
// The order matches hebrew.tools', whose own modes (Today, Accent Shift) slot in
// alongside these.

import type { StudyMode } from '@tools/shared/study-modes';

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const studyModes: readonly StudyMode[] = [
  {
    href: '/flashcards',
    label: 'Flashcards',
    description:
      'Study vocabulary from the Greek New Testament with spaced-repetition. Learn the most common words first.',
    accentColor: '#7C3AED',
    bgColor: '#F5F3FF',
    icon: svg(
      '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="9.5" y1="13.5" x2="14.5" y2="13.5"/>',
    ),
    detail: 'Spaced repetition · GNT vocabulary',
  },
  {
    href: '/paradigms',
    label: 'Paradigms',
    description:
      'Fill in the blanks of a full paradigm table from memory — noun declensions, verb conjugations, pronouns, and more.',
    accentColor: '#0F766E',
    bgColor: '#F0FDFA',
    icon: svg(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/>',
    ),
    detail: 'Declensions · Conjugations · Pronouns',
  },
  {
    href: '/parse',
    label: 'Parse',
    description:
      'Identify the tense, voice, mood, person and number of a verb form, or parse the verbs of a Greek New Testament chapter in context.',
    accentColor: '#1D4ED8',
    bgColor: '#EEF2FF',
    icon: svg(
      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    ),
    detail: 'Verb forms · GNT passages',
  },
  {
    href: '/focus',
    label: 'Focus Passages',
    description:
      'Pin a verse range and master it deeply — vocabulary flashcards, parsing drills, and reading all in one place.',
    accentColor: '#059669',
    bgColor: '#ECFDF5',
    icon: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    ),
    detail: 'Passage vocab · Parsing · Reading',
  },
];
