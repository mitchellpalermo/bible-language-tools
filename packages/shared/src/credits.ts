/**
 * Structure for a site's data credits. Facts (names, URLs, licence names) live here;
 * every user-facing sentence is written by the site owner and arrives as `copy`.
 */
export interface CreditSource {
  id: string;
  name: string;
  url: string;
  /** Licence short name, or null when it has not been verified. */
  license: string | null;
  licenseUrl: string | null;
  /** Owner-written credit line for this source. */
  copy: string;
}

export interface CreditsCopy {
  /** Owner-written page heading. */
  title: string;
  /** Owner-written lead-in paragraph. */
  intro: string;
  /** Owner-written label for the footer link. */
  footerLabel: string;
}

export const LICENSES = {
  ccBy4: { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  ccBySa3: {
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  cc0: { license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  unverified: { license: null, licenseUrl: null },
} as const;

/** Visible stand-in for wording the owner has not written yet. */
export const placeholder = (what: string): string => `[OWNER WORDING NEEDED: ${what}]`;

/** True while any wording is still a stand-in — lets a test keep the PR honest. */
export const hasPlaceholders = (copy: CreditsCopy, sources: CreditSource[]): boolean =>
  [copy.title, copy.intro, copy.footerLabel, ...sources.map((s) => s.copy)].some((t) =>
    t.startsWith('[OWNER WORDING NEEDED'),
  );
