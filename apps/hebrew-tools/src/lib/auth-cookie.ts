// Non-httpOnly companion to the Better Auth session cookie.
//
// Most pages are prerendered, so they cannot read the session server-side.
// The client reads this cookie to render signed-in nav state, and (once the
// sync layer lands — see #91) to decide whether to push progress on tab hide.
//
// It carries no auth authority — the httpOnly session cookie does. Never gate
// anything server-side on this value; a user can set it by hand.
//
// greek-tools uses `gt-auth`. The two apps are on separate apex domains so the
// cookies never collide, but distinct names keep two open tabs legible while
// debugging.

export const AUTH_HINT_COOKIE = 'ht-auth';

/** Matches the Better Auth session expiry configured in src/lib/auth.ts. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function authHintSetCookie(): string {
  return `${AUTH_HINT_COOKIE}=1; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function authHintClearCookie(): string {
  return `${AUTH_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Client-side check: is the auth hint cookie present? */
export function hasAuthHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${AUTH_HINT_COOKIE}=1`);
}
