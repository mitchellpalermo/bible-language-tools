export interface FetchRetryOptions {
  /** Total tries, first included. Default 4. */
  attempts?: number;
  /** Per-attempt timeout. Default 30 000. */
  timeoutMs?: number;
  /** Delay before the second try; doubles each time. Default 1 000. */
  backoffMs?: number;
  fetchImpl?: typeof fetch;
}

export function fetchWithRetry(url: string, options?: FetchRetryOptions): Promise<Response>;
