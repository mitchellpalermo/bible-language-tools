/**
 * The cross-site form check both apps run in their middleware, in place of
 * Astro's built-in `security.checkOrigin`.
 *
 * Astro's check refuses every cross-site POST that looks like a form, with no
 * way to exempt a route. Sign in with Apple returns by exactly that: Apple's
 * page POSTs the authorization code to `/api/auth/callback/apple`
 * (`response_mode=form_post`) from `https://appleid.apple.com`. With Astro's
 * check on, every Apple sign-in ended on a bare "Cross-site POST form
 * submissions are forbidden" page before Better Auth saw the request (Nov 2026).
 *
 * So each app sets `security: { checkOrigin: false }` and calls
 * `crossSiteRefusal` first thing in its middleware. The rule is Astro's, word
 * for word, except for the paths in `CROSS_SITE_POST_PATHS`.
 */

/** Routes a third party is expected to POST a form to. Exact paths only. */
export const CROSS_SITE_POST_PATHS: readonly string[] = [
  // Better Auth turns this POST into a same-site GET redirect before it reads
  // any cookie, and checks the request's origin against its trusted origins.
  '/api/auth/callback/apple',
];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

function isFormLike(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return FORM_CONTENT_TYPES.some((type) => lower.includes(type));
}

/**
 * A 403 response when the request is a cross-site form submission Astro's own
 * check would have refused, or null when it may go on.
 *
 * As in Astro: safe methods always pass; a request with a form-like content
 * type, or with no content type at all, must come from this origin. A JSON
 * body may come from anywhere, because a browser cannot send one cross-site
 * without a CORS preflight, which these apps never answer.
 */
export function crossSiteRefusal(request: Request): Response | null {
  if (SAFE_METHODS.includes(request.method)) return null;

  const url = new URL(request.url);
  if (CROSS_SITE_POST_PATHS.includes(url.pathname)) return null;

  if (request.headers.get('origin') === url.origin) return null;

  const contentType = request.headers.get('content-type');
  if (contentType !== null && !isFormLike(contentType)) return null;

  return new Response(`Cross-site ${request.method} form submissions are forbidden`, {
    status: 403,
  });
}
