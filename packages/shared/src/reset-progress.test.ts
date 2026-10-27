import { describe, expect, it, vi } from 'vitest';
import { isResetConfirmed, resetSrsProgress, retryServerReset } from './reset-progress';

describe('isResetConfirmed', () => {
  it('accepts the confirmation word', () => {
    expect(isResetConfirmed('RESET')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    // An iPad capitalises the first letter; autocorrect can leave a space.
    expect(isResetConfirmed('Reset ')).toBe(true);
    expect(isResetConfirmed('  reset')).toBe(true);
  });

  it('rejects anything short of the whole word', () => {
    for (const input of ['', 'RESE', 'RESETS', 'yes', 'RE SET']) {
      expect(isResetConfirmed(input)).toBe(false);
    }
  });
});

describe('resetSrsProgress', () => {
  const deps = (overrides: Partial<Parameters<typeof resetSrsProgress>[0]> = {}) => ({
    clearLocal: vi.fn(),
    signedIn: true,
    clearServer: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  it('clears this browser, then the account copy, when signed in', async () => {
    const order: string[] = [];
    const d = deps({
      clearLocal: vi.fn(() => order.push('local')),
      clearServer: vi.fn(async () => {
        order.push('server');
        return true;
      }),
    });

    expect(await resetSrsProgress(d)).toEqual({ local: 'cleared', server: 'cleared' });
    expect(order).toEqual(['local', 'server']);
  });

  it('never calls the server when signed out', async () => {
    const d = deps({ signedIn: false });

    expect(await resetSrsProgress(d)).toEqual({ local: 'cleared', server: 'skipped' });
    expect(d.clearServer).not.toHaveBeenCalled();
  });

  it('reports a failed server delete without undoing the local reset', async () => {
    const d = deps({ clearServer: vi.fn().mockResolvedValue(false) });

    expect(await resetSrsProgress(d)).toEqual({ local: 'cleared', server: 'failed' });
    expect(d.clearLocal).toHaveBeenCalledOnce();
  });

  it('treats a throwing server binding as a failure, not an error', async () => {
    const d = deps({ clearServer: vi.fn().mockRejectedValue(new Error('offline')) });

    expect(await resetSrsProgress(d)).toEqual({ local: 'cleared', server: 'failed' });
  });

  it('leaves the server alone when the local clear fails', async () => {
    // Deleting the account copy while this browser still holds every card
    // would only have the next push put them back.
    const d = deps({
      clearLocal: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    });

    expect(await resetSrsProgress(d)).toEqual({ local: 'failed', server: 'skipped' });
    expect(d.clearServer).not.toHaveBeenCalled();
  });
});

describe('retryServerReset', () => {
  it('maps the binding result to cleared / failed', async () => {
    expect(await retryServerReset(vi.fn().mockResolvedValue(true))).toBe('cleared');
    expect(await retryServerReset(vi.fn().mockResolvedValue(false))).toBe('failed');
  });
});
