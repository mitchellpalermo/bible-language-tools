/**
 * Reading a Cloudflare `_headers` file's Content Security Policy.
 *
 * Both apps pin, in a test or at build time, that their real `_headers` lets
 * the browser reach a third-party origin: the PostHog proxy, and the Daily Dose
 * of Scripture API. A host left out fails as a bare network error, which every
 * caller here turns into a quiet fallback, so the check has to be right.
 *
 * **Only `Content-Security-Policy:` lines are policy.** A `_headers` file
 * carries `#` comments, and a comment that mentions a directive by name ("the
 * API behind /daily, connect-src only") is the first match a bare
 * `/connect-src([^;]*)/` finds. That regex was how the Daily Dose test first
 * read the file, and it read the comment.
 */

/** The `Content-Security-Policy` values in a `_headers` file, one per rule. */
export function cspPolicies(headersText: string): string[] {
  return headersText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^content-security-policy\s*:/i.test(line))
    .map((line) => line.replace(/^content-security-policy\s*:/i, '').trim());
}

/** A directive's sources, falling back to `default-src`; null when neither is set. */
function sourcesFor(csp: string, directive: string): string[] | null {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives.get(directive) ?? directives.get('default-src') ?? null;
}

function allows(sources: string[] | null, origin: string): boolean {
  if (!sources) return true; // no policy for this directive: nothing blocks it
  return sources.some((s) => s === '*' || s === 'https:' || s.replace(/\/$/, '') === origin);
}

/**
 * The first of `directives` that some policy in the file blocks `origin` in,
 * or null when every policy allows it. A file with no CSP blocks nothing.
 */
export function cspBlockingDirective(
  headersText: string,
  origin: string,
  directives: readonly string[],
): string | null {
  for (const csp of cspPolicies(headersText)) {
    for (const directive of directives) {
      if (!allows(sourcesFor(csp, directive), origin)) return directive;
    }
  }
  return null;
}
