import { useState } from 'react';
import { CONSONANT_MAP } from '../lib/hebrew-input';
import { useHebrewInput } from '../lib/use-hebrew-input';
import ErrorBoundary from './ErrorBoundary';

function HebrewKeyboardInner() {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  // The typing behaviour itself — key mapping, hateph sequences, the Android
  // and iOS input paths — lives in the hook, which the paradigm quiz shares.
  const input = useHebrewInput<HTMLTextAreaElement>({ value: text, onChange: setText });
  const displayText = input.display;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    input.clear();
    input.ref.current?.focus();
  };

  return (
    <div className="space-y-4">
      <textarea
        ref={input.ref}
        value={displayText}
        dir="rtl"
        onKeyDown={input.onKeyDown}
        onChange={input.onChange}
        placeholder="...הקלד עברית"
        className="w-full h-48 p-4 text-2xl rounded-xl border-2 focus:outline-none resize-y bg-bg-card shadow-sm"
        style={{
          color: 'var(--color-hebrew)',
          fontFamily: 'var(--font-hebrew)',
          borderColor: '#D1FAE5',
        }}
        spellCheck={false}
      />

      <div className="flex gap-3">
        <button
          onClick={handleCopy}
          className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors font-semibold shadow-sm"
        >
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>
        <button
          onClick={handleClear}
          className="px-5 py-2 bg-bg-card text-text-muted border border-gray-200 rounded-lg hover:border-gray-300 hover:text-text transition-colors font-medium"
        >
          Clear
        </button>
      </div>

      <details
        className="bg-bg-card rounded-xl border p-4 shadow-sm"
        style={{ borderColor: '#D1FAE5' }}
      >
        <summary className="font-semibold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
          Key Mappings Reference
        </summary>

        <div className="mt-3 space-y-4 text-sm">
          {/* Consonants */}
          <div>
            <p className="font-bold mb-2 text-text-muted uppercase tracking-wide text-xs">
              Consonants
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
              {Object.entries(CONSONANT_MAP)
                .filter(([k], _, arr) => {
                  // Deduplicate: skip 'v' (same as 'w') and '#' (same as 'S')
                  if (k === 'v') return false;
                  if (k === '#') return false;
                  return true;
                })
                .map(([ascii, hebrew]) => (
                  <div key={ascii} className="flex gap-2 items-center">
                    <kbd
                      className="bg-green-50 border border-green-100 px-1.5 py-0.5 rounded text-xs font-mono"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {ascii}
                    </kbd>
                    <span className="text-text-muted">→</span>
                    <span
                      className="text-lg"
                      dir="rtl"
                      style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
                    >
                      {hebrew}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Nikud */}
          <div>
            <p className="font-bold mb-2 text-text-muted uppercase tracking-wide text-xs">
              Nikud (vowel points — type after the consonant)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
              {(
                [
                  ['a', 'patah', 'בַ'],
                  ['A', 'qamets', 'בָ'],
                  ['e', 'segol', 'בֶ'],
                  ['E', 'tsere', 'בֵ'],
                  ['i', 'hireq', 'בִ'],
                  ['o', 'holem', 'בֹ'],
                  ['O', 'holem waw', 'וֹ'],
                  ['u', 'qibbuts', 'בֻ'],
                  ['U', 'shureq', 'וּ'],
                ] as [string, string, string][]
              ).map(([key, name, example]) => (
                <div key={key} className="flex gap-2 items-center">
                  <kbd
                    className="bg-green-50 border border-green-100 px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {key}
                  </kbd>
                  <span className="text-text-muted text-xs">{name}</span>
                  <span
                    dir="rtl"
                    style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
                  >
                    {example}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sheva & hateph */}
          <div>
            <p className="font-bold mb-2 text-text-muted uppercase tracking-wide text-xs">
              Sheva &amp; Hateph Vowels
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
              {(
                [
                  [':', 'sheva', 'בְ'],
                  [':a', 'hateph patah', 'בֲ'],
                  [':e', 'hateph segol', 'בֱ'],
                  [':A', 'hateph qamets', 'בֳ'],
                ] as [string, string, string][]
              ).map(([key, name, example]) => (
                <div key={key} className="flex gap-2 items-center">
                  <kbd
                    className="bg-green-50 border border-green-100 px-1.5 py-0.5 rounded text-xs font-mono"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {key}
                  </kbd>
                  <span className="text-text-muted text-xs">{name}</span>
                  <span
                    dir="rtl"
                    style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
                  >
                    {example}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dagesh */}
          <div>
            <p className="font-bold mb-2 text-text-muted uppercase tracking-wide text-xs">Other</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
              <div className="flex gap-2 items-center">
                <kbd
                  className="bg-green-50 border border-green-100 px-1.5 py-0.5 rounded text-xs font-mono"
                  style={{ color: 'var(--color-primary)' }}
                >
                  . or *
                </kbd>
                <span className="text-text-muted text-xs">dagesh</span>
                <span
                  dir="rtl"
                  style={{ color: 'var(--color-hebrew)', fontFamily: 'var(--font-hebrew)' }}
                >
                  בּ
                </span>
              </div>
            </div>
            <p className="mt-2 text-text-muted italic text-xs">
              Final letter forms (ך ם ן ף ץ) are applied automatically at word boundaries.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function HebrewKeyboard() {
  return (
    <ErrorBoundary component="HebrewKeyboard">
      <HebrewKeyboardInner />
    </ErrorBoundary>
  );
}
