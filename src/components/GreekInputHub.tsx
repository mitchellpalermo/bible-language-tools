import { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';
import GreekKeyboard from './GreekKeyboard';
import Transliteration from './Transliteration';

type Tab = 'keyboard' | 'transliteration';

function GreekInputHubInner() {
  const [activeTab, setActiveTab] = useState<Tab>('keyboard');

  return (
    <div>
      <div
        className="inline-flex rounded-xl p-1 gap-1 mb-6"
        style={{ background: 'var(--color-bg)' }}
        role="tablist"
        aria-label="Greek input mode"
      >
        {(
          [
            { id: 'keyboard', label: 'Keyboard', icon: '⌨' },
            { id: 'transliteration', label: 'Transliteration', icon: 'Aa' },
          ] as const
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={
              activeTab === id
                ? { background: 'var(--color-primary)', color: '#fff' }
                : { background: 'transparent', color: 'var(--color-text-muted)' }
            }
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'keyboard' ? (
          <GreekKeyboard key="keyboard" />
        ) : (
          <Transliteration key="transliteration" />
        )}
      </div>
    </div>
  );
}

export default function GreekInputHub() {
  return (
    <ErrorBoundary component="GreekInputHub">
      <GreekInputHubInner />
    </ErrorBoundary>
  );
}
