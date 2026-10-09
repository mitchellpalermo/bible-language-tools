// The Hebrew typing behaviour, as a hook: English keys in, pointed Hebrew out.
//
// `/keyboard` had this inline. The paradigm quiz needs the identical behaviour
// in every cell of a table, so it lives here and both use it.
//
// It takes input by two routes, and both are first-class:
//
// **A hardware keyboard**, through the phonetic mapping in `hebrew-input.ts`
// (`T` `i` `.` for תִּ). This is the laptop.
//
// **`insert` and `backspace`, called directly.** An on-screen keypad of Hebrew
// letters and points drives a field through these. This is the iPad: the system
// keyboard hides `:` and `.` on a second layer and qamets behind shift, so a
// single pointed verb form costs a dozen layer switches through the mapping.
//
// The value is *raw*: a word's last letter is stored in its ordinary form and
// only `display` shows the final one, which is what lets כ become ך and turn
// back into כ as the next letter is typed. Compare against `display`, or
// finalize first — `gradeCell` does.

import { type ChangeEvent, type KeyboardEvent, type RefObject, useEffect, useRef } from 'react';
import {
  applyFinalForms,
  HATEPH_MAP,
  processHebrewInput,
  processHebrewKey,
  SHEVA,
  translateHebrewInput,
} from './hebrew-input';

type HebrewField = HTMLInputElement | HTMLTextAreaElement;

export interface HebrewInputOptions {
  /** The raw value — see the note on final forms above. */
  value: string;
  onChange: (raw: string) => void;
}

export interface HebrewInput<T extends HebrewField> {
  /** Attach to the field; the Android `beforeinput` path listens on it. */
  ref: RefObject<T | null>;
  /** The value to render: `value` with final forms applied. */
  display: string;
  onKeyDown: (e: KeyboardEvent<T>) => void;
  onChange: (e: ChangeEvent<T>) => void;
  /** Append Hebrew text as-is, bypassing the key mapping. */
  insert: (text: string) => void;
  /** Remove the last code point — one vowel point, or one bare consonant. */
  backspace: () => void;
  clear: () => void;
}

export function useHebrewInput<T extends HebrewField = HTMLInputElement>({
  value,
  onChange,
}: HebrewInputOptions): HebrewInput<T> {
  const ref = useRef<T>(null);

  // The latest value and callback, readable from handlers that outlive a render
  // — two keys can arrive before React has re-rendered with the first.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Set when keyDown has already handled the key — prevents beforeinput from
  // double-inserting on iOS Safari, which fires both events after keydown.
  const keyHandledRef = useRef(false);

  // Tracks the display value we last built via beforeinput/keydown, so the
  // onChange handler can detect and skip IME echo-backs (Android double-word bug).
  const lastHandledRef = useRef('');

  // Set after the user types ':' (sheva). The next key a/e/A upgrades the sheva
  // to a hateph vowel by replacing the last character of raw state.
  const pendingHatephRef = useRef(false);

  // Stable across renders: everything it touches is a ref.
  const actions = useRef({
    update(next: (prev: string) => string) {
      const raw = next(valueRef.current);
      valueRef.current = raw;
      lastHandledRef.current = applyFinalForms(raw);
      onChangeRef.current(raw);
    },

    /** Apply one mapped key. Returns whether the event should be suppressed. */
    key(key: string): boolean {
      // Hateph sequence continuation: user typed ':' then immediately a/e/A
      if (pendingHatephRef.current) {
        pendingHatephRef.current = false;
        const hateph = HATEPH_MAP[key];
        if (hateph !== undefined) {
          // Replace the last code point (which is a SHEVA) with the hateph mark
          actions.update((prev) => [...prev].slice(0, -1).join('') + hateph);
          return true;
        }
        // Not a hateph key — let the sheva stand, fall through to normal processing
      }

      const { preventDefault, append } = processHebrewInput(key);
      if (!preventDefault) return false;
      if (append) {
        actions.update((prev) => prev + append);
        if (append === SHEVA) pendingHatephRef.current = true;
      }
      return true;
    },

    insert(text: string) {
      pendingHatephRef.current = false;
      actions.update((prev) => prev + text);
    },

    backspace() {
      pendingHatephRef.current = false;
      actions.update((prev) => [...prev].slice(0, -1).join(''));
    },

    clear() {
      pendingHatephRef.current = false;
      actions.update(() => '');
      lastHandledRef.current = '';
    },
  }).current;

  // Android soft keyboards fire keydown with key='Unidentified'. The native
  // beforeinput event carries the actual character in InputEvent.data on all
  // platforms. We use a native listener (not React's synthetic onBeforeInput)
  // so it fires correctly on Android.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: Event) => {
      if (keyHandledRef.current) {
        keyHandledRef.current = false;
        return;
      }
      const { inputType, data } = e as unknown as InputEvent;
      if (inputType !== 'insertText' || !data) return;

      // Multi-char data = Android IME word commit (e.g. "shalom" → "שׁלום")
      if (data.length > 1) {
        e.preventDefault();
        actions.update((prev) => prev + translateHebrewInput(data));
        return;
      }

      if (actions.key(data)) e.preventDefault();
    };

    el.addEventListener('beforeinput', handler);
    return () => el.removeEventListener('beforeinput', handler);
  }, [actions]);

  return {
    ref,
    display: applyFinalForms(value),
    onKeyDown(e) {
      keyHandledRef.current = false;
      if (processHebrewKey(e.key, e.ctrlKey || e.metaKey).preventDefault === false) {
        // Unmapped, or a shortcut — but a pending sheva still ends here, so
        // that `:` then Backspace then `a` types a patah, not a hateph.
        if (!(e.ctrlKey || e.metaKey)) pendingHatephRef.current = false;
        return;
      }
      e.preventDefault();
      actions.key(e.key);
      keyHandledRef.current = true;
    },
    onChange(e) {
      // Skip if this is the browser echoing a value we already built via
      // beforeinput/keydown — prevents the Android IME double-word bug.
      if (e.target.value === lastHandledRef.current) return;
      const raw = translateHebrewInput(e.target.value);
      valueRef.current = raw;
      onChangeRef.current(raw);
    },
    insert: actions.insert,
    backspace: actions.backspace,
    clear: actions.clear,
  };
}
