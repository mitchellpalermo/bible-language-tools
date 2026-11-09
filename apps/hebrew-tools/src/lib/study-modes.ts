// The study modes behind the Study nav group and the /study hub (#229).
//
// Both read this list (Layout.astro and pages/study.astro), so a mode added
// here has its card and its nav child together; src/test/study-modes.test.ts
// fails when either stops reading it. Today's Session is not in the list: it is
// the routine the modes make up, so Layout.astro adds it to the nav and the hub
// gives it its own panel above the cards. Parse (#82) and the greek-only modes
// join the list when they ship, with the same two edits nowhere else.

import type { StudyMode } from '@tools/shared/study-modes';

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const studyModes: readonly StudyMode[] = [
  {
    href: '/flashcards',
    label: 'Flashcards',
    description:
      'Study Biblical Hebrew vocabulary with spaced repetition, by textbook chapter or by frequency.',
    accentColor: '#7C3AED',
    bgColor: '#F5F3FF',
    icon: svg(
      '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="9.5" y1="13.5" x2="14.5" y2="13.5"/>',
    ),
    detail: 'Spaced repetition · Course vocabulary',
  },
  {
    href: '/paradigms',
    label: 'Paradigms',
    description:
      'Write Qal verb paradigms out from memory — one verb at a time, or the verb classes side by side.',
    accentColor: '#0F766E',
    bgColor: '#F0FDFA',
    icon: svg(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/>',
    ),
    detail: 'Qatal · Yiqtol · Wayyiqtol',
  },
  {
    href: '/accent',
    label: 'Accent Shift',
    description:
      'Add an ending to a noun and work out where the accent goes and which vowels reduce, one step at a time.',
    accentColor: '#F43F5E',
    bgColor: '#FFF1F2',
    icon: svg(
      '<path d="M4 18h4"/><path d="M10 18h4"/><path d="M16 18h4"/><path d="M17 14l1-6"/><path d="M6 12l12-8"/>',
    ),
    detail: 'Syllables · Accent · Vowel reduction',
  },
  {
    href: '/focus',
    label: 'Focus Passages',
    description:
      'Pick a stretch of the Hebrew Bible and study it: the course vocabulary it uses, its text, and how well you know it.',
    accentColor: '#059669',
    bgColor: '#ECFDF5',
    icon: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    ),
    detail: 'Passage vocabulary · Reading · Progress',
  },
];
