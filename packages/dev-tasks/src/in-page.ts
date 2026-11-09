/**
 * Functions that run inside the page, passed to `page.evaluate` and
 * `addInitScript`. Playwright serialises each one and runs it in the browser,
 * so they must be self-contained (no imports, no closures) and V8 coverage in
 * Node never sees them run. `capture.test.ts` exercises every one in a real
 * Chromium; they are excluded from coverage for that reason only.
 */

/** Set localStorage before any page script runs. */
export function seedStorage(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
}

/**
 * Wait for running CSS transitions and animations to finish, up to `cap` ms.
 * Infinite animations (spinners) are ignored — they never finish.
 */
export async function settleAnimations(cap: number): Promise<void> {
  const deadline = performance.now() + cap;
  while (performance.now() < deadline) {
    const running = document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
    if (running.length === 0) return;
    await Promise.race([
      Promise.all(running.map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 100)),
    ]);
  }
}

/** Every webfont face the page declares, with whether it loaded. */
export async function fontFaces(): Promise<
  { family: string; status: string; unicodeRange: string }[]
> {
  await document.fonts.ready;
  return [...document.fonts].map((f) => ({
    family: f.family,
    status: f.status,
    unicodeRange: f.unicodeRange === 'U+0-10FFFF' ? '' : f.unicodeRange,
  }));
}

export function bodyText(): string {
  return document.body.innerText;
}
