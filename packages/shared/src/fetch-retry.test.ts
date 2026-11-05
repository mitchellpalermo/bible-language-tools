import { describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from './fetch-retry.mjs';

const res = (status: number) => new Response('', { status });
const fast = { backoffMs: 0 };

describe('fetchWithRetry', () => {
  it('returns the first good response without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200));
    expect((await fetchWithRetry('u', { ...fast, fetchImpl })).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a network error and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue(res(200));
    expect((await fetchWithRetry('u', { ...fast, fetchImpl })).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a 5xx and a 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(429))
      .mockResolvedValue(res(200));
    expect((await fetchWithRetry('u', { ...fast, fetchImpl })).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('returns a 404 at once, for the caller to report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404));
    expect((await fetchWithRetry('u', { ...fast, fetchImpl })).status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws the last failure, naming the URL, when every attempt fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(502));
    await expect(
      fetchWithRetry('https://x/y', { ...fast, attempts: 3, fetchImpl }),
    ).rejects.toThrow('HTTP 502 fetching https://x/y');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('passes a timeout signal to every attempt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200));
    await fetchWithRetry('u', { ...fast, fetchImpl });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
