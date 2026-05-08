# Bug: Greek Keyboard Non-Functional on Android

## Summary

The Greek keyboard input tool (`/keyboard`) does not produce Greek characters when used on an Android phone. Typing produces either nothing, the raw Latin characters, or garbled output.

---

## Affected Pages / Components

- `/keyboard` — `GreekKeyboard.tsx`
- `/paradigms` — `ParadigmQuiz` cell inputs (share the same `processGreekKey` from `src/lib/greek-input.ts`)

---

## Root Cause

`GreekKeyboard` and the paradigm quiz inputs rely entirely on `onKeyDown` events to intercept keystrokes and map them to Greek characters via `processGreekKey`. On Android, the software keyboard does not fire standard `KeyboardEvent` values — instead, it fires:

- `keydown` events where `event.key === "Unidentified"` (Chrome/WebView on Android)
- Composition events (`compositionstart` / `compositionupdate` / `compositionend`) rather than discrete key events

Because `GREEK_MAP` and `DIACRITIC_MAP` both look up by `event.key`, every keystroke on Android results in a no-op. The `onChange` handler on the textarea then writes the raw Latin character through to state, producing untranslated output.

```typescript
// greek-input.ts — processGreekKey is only called from onKeyDown
// Android fires key: "Unidentified" → neither GREEK_MAP nor DIACRITIC_MAP match
export function processGreekKey(key: string, ctrlOrMeta: boolean) {
  const diacritic = DIACRITIC_MAP[key]; // miss
  const greek = GREEK_MAP[key];         // miss
  return { preventDefault: false, append: null }; // no-op → raw char leaks through
}
```

---

## Reproduction Steps

1. Open `https://greek.tools/keyboard` (or `/paradigms`) on an Android phone in Chrome.
2. Tap the textarea.
3. Type any letter using the on-screen keyboard (e.g., "a").
4. Observe: the letter "a" appears rather than "α".

---

## Expected Behavior

Typing "a" should produce "α", consistent with the desktop experience.

---

## Proposed Fix

Replace the `onKeyDown`-only approach with an `onInput` / `beforeinput` handler that intercepts the incoming characters from the `InputEvent` rather than the `KeyboardEvent`. The `InputEvent.data` property contains the actual character being inserted on all platforms, including Android.

**High-level approach:**

1. Replace the current `onKeyDown` + `onChange` pair with a single `onBeforeInput` handler (or `onInput` with manual cursor management).
2. In the handler, read `event.data` (the character about to be inserted), look it up in `GREEK_MAP` / `DIACRITIC_MAP`, and replace it with the Greek equivalent before it reaches the DOM — or `preventDefault` and append to React state manually, same as the current approach.
3. Update `processGreekKey` (or add a parallel `processGreekInput(data: string)`) to accept a raw character string rather than a `KeyboardEvent.key` value, so the lookup logic is shared between desktop and mobile paths.

**Alternative (simpler, lower fidelity):** Add a visible on-screen Greek character grid below the textarea — a set of buttons, one per Greek letter — that appends characters to state on click. This sidesteps the keyboard event issue entirely and works on all platforms, but sacrifices the "type in English" ergonomics.

---

## Acceptance Criteria

- Typing Latin characters on an Android soft keyboard produces the correct Greek output in the textarea at `/keyboard`
- Typing in paradigm quiz cell inputs on Android produces Greek characters
- Existing desktop behavior (including diacritics via `(`, `)`, `/`, `\`, `=`, `|`) is unchanged
- Final sigma auto-conversion still applies

---

## Priority

**Medium.** The tool is usable on desktop and iOS (which fires standard `KeyboardEvent.key` values). Android users are blocked entirely.
