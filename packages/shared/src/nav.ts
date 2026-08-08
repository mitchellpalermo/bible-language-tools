// Site navigation link data, shared by greek.tools and hebrew.tools.
//
// Each app owns its own link list; everything about how that list is rendered
// (desktop header nav, mobile hamburger menu) lives in
// `components/SiteNav.astro` so the two apps cannot drift apart again.

/** A destination in the site navigation. */
export interface NavLink {
  href: string;
  label: string;
  /** Extra path prefixes that also light this link up. */
  matchPaths?: string[];
  /**
   * Sub-destinations listed beneath this link in the mobile menu. The parent
   * stays a real link — a group heading is a destination, not just a label.
   */
  children?: NavLink[];
}

/**
 * Prefix match against the current path.
 *
 * `/` is compared exactly, because a prefix match on it would light the home
 * link up on every page. Everything else keeps prefix semantics so `/parse`
 * covers `/parse/gnt` and `/account` covers `/account/signin`.
 */
export function matchesPath(path: string, currentPath: string): boolean {
  if (path === '/') return currentPath === '/';
  return currentPath.startsWith(path);
}

/** Every path that should mark `link` as the active section. */
export function navLinkPaths(link: NavLink): string[] {
  return [link.href, ...(link.matchPaths ?? []), ...(link.children ?? []).map((c) => c.href)];
}

/**
 * Is this link the active section?
 *
 * True when the current path matches the link's own href, any of its
 * `matchPaths`, or any of its children's hrefs. The children clause is what
 * keeps greek.tools' Study link lit on `/flashcards`, `/quiz`, `/paradigms`,
 * `/parse`, and `/focus` — the job the hand-written `STUDY_PATHS` list did.
 */
export function isNavLinkActive(link: NavLink, currentPath: string): boolean {
  return navLinkPaths(link).some((p) => matchesPath(p, currentPath));
}

/**
 * Is this link the current page specifically, rather than its section?
 *
 * Drives `aria-current="page"`, which should not appear on both a group
 * heading and the child below it when only one of them is the page you are on.
 */
export function isNavLinkCurrent(link: NavLink, currentPath: string): boolean {
  return [link.href, ...(link.matchPaths ?? [])].some((p) => matchesPath(p, currentPath));
}
