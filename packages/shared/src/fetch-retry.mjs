/**
 * `fetch` for build scripts that pull source data from GitHub: a timeout per
 * attempt, and a few retries with backoff on a network error, a timeout, a 5xx
 * or a 429. A 4xx other than 429 is a wrong URL and is returned at once.
 *
 * Plain `.mjs` so the apps' `node scripts/*.mjs` steps can import it without a
 * TypeScript loader; the types are in `fetch-retry.d.mts`.
 */
export async function fetchWithRetry(url, options = {}) {
  const { attempts = 4, timeoutMs = 30_000, backoffMs = 1_000, fetchImpl = fetch } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok || (res.status < 500 && res.status !== 429)) return res;
      lastError = new Error(`HTTP ${res.status} fetching ${url}`);
    } catch (err) {
      lastError = new Error(`${err instanceof Error ? err.message : err} fetching ${url}`);
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 1)));
  }
  throw lastError;
}
