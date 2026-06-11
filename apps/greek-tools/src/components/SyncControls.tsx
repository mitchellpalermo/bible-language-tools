import { useState } from 'react';
import { formatRelativeTime, getLastSyncedAt, pullAndMerge } from '../lib/sync-manager';
import ErrorBoundary from './ErrorBoundary';

type SyncStatus = 'idle' | 'syncing' | 'error';

function lastSyncedLabel(): string {
  const lastSynced = getLastSyncedAt();
  return lastSynced ? `Last synced ${formatRelativeTime(lastSynced)}` : 'Never synced';
}

function SyncControlsInner() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [label, setLabel] = useState(lastSyncedLabel);

  async function handleSync() {
    setStatus('syncing');
    const { ok } = await pullAndMerge();
    setStatus(ok ? 'idle' : 'error');
    setLabel(lastSyncedLabel());
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        Your flashcard progress is saved to this account and available on all your devices.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSync}
          disabled={status === 'syncing'}
          className="bg-blue-600 text-white rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
        <span className="text-sm text-gray-500" aria-live="polite">
          {status === 'error' ? 'Sync failed — try again' : label}
        </span>
      </div>
    </div>
  );
}

export default function SyncControls() {
  return (
    <ErrorBoundary component="SyncControls">
      <SyncControlsInner />
    </ErrorBoundary>
  );
}
