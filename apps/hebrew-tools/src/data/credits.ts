import { type CreditSource, type CreditsCopy, LICENSES, placeholder } from '@tools/shared/credits';

// Facts only. Every `copy` string below is a stand-in until the owner writes it.
export const creditsCopy: CreditsCopy = {
  title: placeholder('page title'),
  intro: placeholder('intro paragraph'),
  footerLabel: placeholder('footer link label'),
};

export const creditSources: CreditSource[] = [
  {
    id: 'oshb',
    name: 'Open Scriptures Hebrew Bible (morphology)',
    url: 'https://github.com/openscriptures/morphhb',
    ...LICENSES.ccBy4,
    copy: placeholder('OSHB credit line'),
  },
  {
    id: 'wlc',
    name: 'Westminster Leningrad Codex',
    url: 'https://github.com/openscriptures/morphhb',
    ...LICENSES.unverified,
    copy: placeholder('WLC credit line (public domain text)'),
  },
  {
    id: 'oshb-lexicon',
    name: 'OSHB Hebrew Lexicon',
    url: 'https://github.com/openscriptures/HebrewLexicon',
    ...LICENSES.ccBy4,
    copy: placeholder('OSHB lexicon credit line (licence not independently confirmed)'),
  },
  {
    id: 'tbesh',
    name: 'TBESH (Tyndale House, STEPBible.org)',
    url: 'https://github.com/tyndale/STEPBible-Data',
    ...LICENSES.ccBy4,
    copy: placeholder('TBESH credit line (fetched at build time, never committed)'),
  },
  {
    id: 'daily-dose',
    name: 'Daily Dose of Scripture',
    url: 'https://dailydoseofscripture.com',
    ...LICENSES.unverified,
    copy: placeholder('Daily Dose credit line (licence not yet checked)'),
  },
];
