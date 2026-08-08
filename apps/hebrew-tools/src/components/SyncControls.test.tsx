import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), captureException: vi.fn() },
}));

vi.mock('../lib/sync-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sync-manager')>();
  return { ...actual, pullAndMerge: vi.fn() };
});

import { pullAndMerge, setLastSyncedAt } from '../lib/sync-manager';
import SyncControls from './SyncControls';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SyncControls', () => {
  it('shows "Never synced" before the first sync', () => {
    render(<SyncControls />);

    expect(screen.getByText('Never synced')).toBeInTheDocument();
  });

  it('shows how long ago the last sync was', () => {
    setLastSyncedAt(new Date(Date.now() - 5 * 60_000).toISOString());

    render(<SyncControls />);

    expect(screen.getByText(/Last synced 5 minutes ago/)).toBeInTheDocument();
  });

  it('syncs on click and refreshes the label', async () => {
    const user = userEvent.setup();
    vi.mocked(pullAndMerge).mockImplementation(async () => {
      setLastSyncedAt(new Date().toISOString());
      return { hadServerData: true, ok: true };
    });

    render(<SyncControls />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(pullAndMerge).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Last synced just now/)).toBeInTheDocument();
  });

  it('surfaces a failed sync', async () => {
    const user = userEvent.setup();
    vi.mocked(pullAndMerge).mockResolvedValue({ hadServerData: false, ok: false });

    render(<SyncControls />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(await screen.findByText('Sync failed — try again')).toBeInTheDocument();
  });

  it('disables the button while syncing', async () => {
    const user = userEvent.setup();
    let release: (v: { hadServerData: boolean; ok: boolean }) => void = () => {};
    vi.mocked(pullAndMerge).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<SyncControls />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    const button = screen.getByRole('button', { name: 'Syncing…' });
    expect(button).toBeDisabled();

    release({ hadServerData: true, ok: true });
    expect(await screen.findByRole('button', { name: 'Sync now' })).toBeEnabled();
  });

  it('announces status changes to screen readers', () => {
    render(<SyncControls />);

    expect(screen.getByText('Never synced')).toHaveAttribute('aria-live', 'polite');
  });
});
