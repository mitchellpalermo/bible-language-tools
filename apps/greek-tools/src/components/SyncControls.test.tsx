import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SyncControls from './SyncControls';

vi.mock('../lib/sync-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sync-manager')>();
  return { ...actual, pullAndMerge: vi.fn() };
});

import { pullAndMerge } from '../lib/sync-manager';

const pullAndMergeMock = vi.mocked(pullAndMerge);

describe('SyncControls', () => {
  beforeEach(() => {
    localStorage.clear();
    pullAndMergeMock.mockReset();
  });

  it('shows "Never synced" before any sync', () => {
    render(<SyncControls />);
    expect(screen.getByText('Never synced')).toBeInTheDocument();
  });

  it('shows relative last-synced time when a sync is recorded', () => {
    localStorage.setItem(
      'greek-tools-last-synced',
      new Date(Date.now() - 3 * 60_000).toISOString(),
    );
    render(<SyncControls />);
    expect(screen.getByText('Last synced 3 minutes ago')).toBeInTheDocument();
  });

  it('enters a loading state and resolves to last-synced on success', async () => {
    const user = userEvent.setup();
    let resolveSync: (result: { hadServerData: boolean; ok: boolean }) => void = () => {};
    pullAndMergeMock.mockImplementation(
      () =>
        new Promise<{ hadServerData: boolean; ok: boolean }>((resolve) => {
          resolveSync = (result) => {
            if (result.ok) localStorage.setItem('greek-tools-last-synced', new Date().toISOString());
            resolve(result);
          };
        }),
    );

    render(<SyncControls />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled();

    resolveSync({ hadServerData: true, ok: true });
    await waitFor(() => {
      expect(screen.getByText('Last synced just now')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled();
  });

  it('shows an error message when sync fails', async () => {
    const user = userEvent.setup();
    pullAndMergeMock.mockResolvedValue({ hadServerData: false, ok: false });

    render(<SyncControls />);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => {
      expect(screen.getByText('Sync failed — try again')).toBeInTheDocument();
    });
  });
});
