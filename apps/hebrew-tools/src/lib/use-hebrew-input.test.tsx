import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type HebrewInput, useHebrewInput } from './use-hebrew-input';

// The keyboard-mapping paths — every key, the hateph sequences, the Android and
// iOS event orderings — are covered through `HebrewKeyboard.test.tsx`, which
// drives this hook via the real page. These tests cover what that page does not
// use: a single-line field, and the direct calls an on-screen keypad makes.

let api: HebrewInput<HTMLInputElement>;

function Field({ onRaw }: { onRaw?: (raw: string) => void }) {
  const [value, setValue] = useState('');
  api = useHebrewInput({
    value,
    onChange: (raw) => {
      setValue(raw);
      onRaw?.(raw);
    },
  });
  return (
    <input ref={api.ref} value={api.display} onKeyDown={api.onKeyDown} onChange={api.onChange} />
  );
}

function field(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('useHebrewInput', () => {
  it('maps hardware keys into a single-line input', () => {
    render(<Field />);

    for (const key of ['T', 'i', '.', 'q', ':', 't', 'o', 'l']) {
      fireEvent.keyDown(field(), { key });
    }

    expect(field().value.normalize('NFC')).toBe('תִּקְטֹל');
  });

  it('reports the raw value and displays the final form', () => {
    const onRaw = vi.fn();
    render(<Field onRaw={onRaw} />);

    for (const key of ['b', 'n']) fireEvent.keyDown(field(), { key });

    // Stored with an ordinary nun so a following letter can still attach.
    expect(onRaw).toHaveBeenLastCalledWith('בנ');
    expect(field().value).toBe('בן');
  });

  it('composes two keys that arrive before a re-render', () => {
    render(<Field />);

    // One act, two events: the second must build on the first, not on the
    // value the last render happened to capture.
    act(() => {
      api.insert('ק');
      api.insert('ָ');
    });

    expect(field().value).toBe('קָ');
  });

  describe('driven directly, as an on-screen keypad does', () => {
    it('inserts Hebrew as given, without passing it through the key mapping', () => {
      render(<Field />);

      act(() => api.insert('שׁ'));
      act(() => api.insert('ָ'));

      // Shin dot and qamets in tap order; NFC is what decides they are equal.
      expect(field().value.normalize('NFC')).toBe('שָׁ'.normalize('NFC'));
    });

    it('backspaces one mark at a time, leaving the consonant', () => {
      render(<Field />);
      act(() => api.insert('בְּ'));

      act(() => api.backspace());
      expect([...field().value]).toHaveLength(2);

      act(() => api.backspace());
      expect(field().value).toBe('ב');

      act(() => api.backspace());
      act(() => api.backspace());
      expect(field().value).toBe('');
    });

    it('clears the field', () => {
      render(<Field />);
      act(() => api.insert('קטל'));

      act(() => api.clear());

      expect(field().value).toBe('');
    });

    it('does not turn a key typed after a keypad sheva into a hateph', () => {
      // The `:` then `a` sequence belongs to the hardware mapping. A sheva
      // tapped on the keypad is a finished sheva.
      render(<Field />);
      fireEvent.keyDown(field(), { key: "'" });
      fireEvent.keyDown(field(), { key: ':' });
      act(() => api.backspace());
      act(() => api.insert('ְ'));

      fireEvent.keyDown(field(), { key: 'a' });

      expect(field().value).toBe('אְַ');
    });
  });

  it('ends a pending hateph when an unmapped key intervenes', () => {
    render(<Field />);
    fireEvent.keyDown(field(), { key: "'" });
    fireEvent.keyDown(field(), { key: ':' });

    fireEvent.keyDown(field(), { key: 'ArrowLeft' });
    fireEvent.keyDown(field(), { key: 'a' });

    // Sheva kept, patah added — not the two merged into a hateph patah.
    expect(field().value).toBe('אְַ');
  });

  it('takes a native edit, such as the system backspace, through onChange', () => {
    const onRaw = vi.fn();
    render(<Field onRaw={onRaw} />);
    act(() => api.insert('קטל'));

    fireEvent.change(field(), { target: { value: 'קט' } });

    expect(onRaw).toHaveBeenLastCalledWith('קט');
    expect(field().value).toBe('קט');
  });
});
