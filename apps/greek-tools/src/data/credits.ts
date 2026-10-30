import { type CreditSource, type CreditsCopy, LICENSES, placeholder } from '@tools/shared/credits';

// Facts only. Every `copy` string below is a stand-in until the owner writes it.
export const creditsCopy: CreditsCopy = {
  title: placeholder('page title'),
  intro: placeholder('intro paragraph'),
  footerLabel: placeholder('footer link label'),
};

export const creditSources: CreditSource[] = [
  {
    id: 'morphgnt',
    name: 'MorphGNT (SBLGNT edition)',
    url: 'https://github.com/morphgnt/sblgnt',
    ...LICENSES.ccBySa3,
    copy: placeholder('MorphGNT credit line'),
  },
  {
    id: 'sblgnt',
    name: 'SBL Greek New Testament',
    url: 'https://sblgnt.com/license/',
    // Per the owner's research doc: the licence page now shows CC BY 4.0 (the old EULA is
    // superseded). Taken from a secondary summary — confirm against sblgnt.com/license.
    ...LICENSES.ccBy4,
    copy: placeholder(
      'SBLGNT credit line (CC BY 4.0 requires indicating changes and linking the licence)',
    ),
  },
  {
    id: 'dodson',
    name: 'Dodson Greek-English Lexicon',
    url: 'https://github.com/biblicalhumanities/Dodson-Greek-Lexicon',
    ...LICENSES.cc0,
    copy: placeholder('Dodson credit line (optional, CC0)'),
  },
  {
    id: 'daily-dose',
    name: 'Daily Dose of Scripture',
    url: 'https://dailydoseofscripture.com',
    ...LICENSES.unverified,
    copy: placeholder('Daily Dose credit line (licence not yet checked)'),
  },
];
