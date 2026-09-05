import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyFinalForms,
  CONSONANT_MAP,
  HATEPH_MAP,
  processHebrewInput,
  processHebrewKey,
  SHEVA,
  translateHebrewInput,
} from '../lib/hebrew-input';
import ErrorBoundary from './ErrorBoundary';

function HebrewKeyboardInner() {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set when keyDown has already handled the key — prevents beforeinput from
  // double-inserting on iOS Safari, which fires both events after keydown.
  const keyHandledRef = useRef(false);

  // Tracks the display value we last built via beforeinput/keydown, so the
  // onChange handler can detect and skip IME echo-backs (Android double-word bug).
  const lastHandledRef = useRef('');

  // Set after the user types ':' (sheva). The next key a/e/A upgrades the sheva
  // to a hateph vowel by replacing the last character of raw state.
  const pendingHatephRef = useRef(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    keyHandledRef.current = false;

    if (e.ctrlKey || e.metaKey) return;

    // Hateph sequence continuation: user typed ':' then immediately types a/e/A
    if (pendingHatephRef.current) {
      const hateph = HATEPH_MAP[e.key];
      if (hateph !== undefined) {
        e.preventDefault();
        setText((prev) => {
          // Replace the last code point (which is a SHEVA) with the hateph mark
          const pts = [...prev];
          const next = pts.slice(0, -1).join('') + hateph;
          lastHandledRef.current = applyFinalForms(next);
          return next;
        });
        pendingHatephRef.current = false;
        keyHandledRef.current = true;
        return;
      }
      // Not a hateph key — let the sheva stand, fall through to normal processing
      pendingHatephRef.current = false;
    }

    const { preventDefault, append } = processHebrewKey(e.key, false);
    if (preventDefault) {
      e.preventDefault();
      if (append) {
        setText((prev) => {
          const next = prev + append;
          lastHandledRef.current = applyFinalForms(next);
          return next;
        });
        if (append === SHEVA) pendingHatephRef.current = true;
      }
      keyHandledRef.current = true;
    }
  }, []);

  // Android soft keyboards fire keydown with key='Unidentified'. The native
  // beforeinput event carries the actual character in InputEvent.data on all
  // platforms. We use a native listener (not React's synthetic onBeforeInput)
  // so it fires correctly on Android.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const handler = (e: Event) => {
      if (keyHandledRef.current) {
        keyHandledRef.current = false;
        return;
      }
      const ie = e as unknown as InputEvent;
      if (ie.inputType !== 'insertText' || !ie.data) return;

      // Multi-char data = Android IME word commit (e.g. "shalom" → "שׁלום")
      if (ie.data.length > 1) {
        e.preventDefault();
        setText((prev) => {
          const next = prev + translateHebrewInput(ie.data!);
          lastHandledRef.current = applyFinalForms(next);
          return next;
        });
        return;
      }

      // Hateph continuation via beforeinput path
      if (pendingHatephRef.current) {
        const hateph = HATEPH_MAP[ie.data];
        if (hateph !== undefined) {
          e.preventDefault();
          setText((prev) => {
            const pts = [...prev];
            const next = pts.slice(0, -1).join('') + hateph;
            lastHandledRef.current = applyFinalForms(next);
            return next;
          });
          pendingHatephRef.current = false;
          return;
        }
        pendingHatephRef.current = false;
      }

      const { preventDefault: pd, append } = processHebrewInput(ie.data);
      if (pd) {
        e.preventDefault();
        if (append) {
          setText((prev) => {
            const next = prev + append;
            lastHandledRef.current = applyFinalForms(next);
            return next;
          });
          if (append === SHEVA) pendingHatephRef.current = true;
        }
      }
    };

    el.addEventListener('beforeinput', handler);
    return () => el.removeEventListener('beforeinput', handler);
  }, []);

  const displayText = applyFinalForms(text);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setText('');
    pendingHatephRef.current = false;
    lastHandledRef.current = '';
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <textarea
        ref={textareaRef}
        value={displayText}
        dir="rtl"
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          // Skip if this is the browser echoing a value we already built via
          // beforeinput/keydown — prevents the Android IME double-word bug.
          if (e.target.value === lastHandledRef.current) return;
          setText(translateHebrewInput(e.target.value));
        }}
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
