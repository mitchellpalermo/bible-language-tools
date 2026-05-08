import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GreekKeyboard from './GreekKeyboard';

// ─── helpers ───────────────────────────────────────────────────────────────

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

function typeKey(textarea: HTMLTextAreaElement, key: string): void {
  fireEvent.keyDown(textarea, { key });
}

async function typeViaBeforeInput(textarea: HTMLTextAreaElement, data: string): Promise<void> {
  // JSDOM's InputEvent constructor doesn't reliably initialize data/inputType
  // from the init dict, so we create a plain Event and manually define them.
  // We use act() because the handler is a native DOM listener (not a React
  // synthetic event handler), so React state updates need explicit flushing.
  const event = new Event('beforeinput', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'inputType', { value: 'insertText' });
  Object.defineProperty(event, 'data', { value: data });
  await act(async () => {
    fireEvent(textarea, event);
  });
}

// ─── rendering ─────────────────────────────────────────────────────────────

describe('GreekKeyboard', () => {
  beforeEach(() => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  it('renders the textarea with a placeholder', () => {
    render(<GreekKeyboard />);
    const textarea = getTextarea();
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('typing'));
  });

  it('renders Copy to Clipboard button', () => {
    render(<GreekKeyboard />);
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it('renders Clear button', () => {
    render(<GreekKeyboard />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  // ─── letter mapping ──────────────────────────────────────────────────────

  describe('letter key mappings', () => {
    it.each([
      // 's' is excluded: sigma at end-of-input becomes ς via final sigma.
      // That behavior is covered in the "final sigma conversion" section.
      ['a', 'α'],
      ['b', 'β'],
      ['g', 'γ'],
      ['d', 'δ'],
      ['e', 'ε'],
      ['z', 'ζ'],
      ['h', 'η'],
      ['q', 'θ'],
      ['i', 'ι'],
      ['k', 'κ'],
      ['l', 'λ'],
      ['m', 'μ'],
      ['n', 'ν'],
      ['c', 'ξ'],
      ['o', 'ο'],
      ['p', 'π'],
      ['r', 'ρ'],
      ['w', 'ω'],
      ['t', 'τ'],
      ['u', 'υ'],
      ['f', 'φ'],
      ['x', 'χ'],
      ['y', 'ψ'],
    ])('key %s produces %s', (key, expected) => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, key);
      expect(textarea.value).toContain(expected);
    });

    it.each([
      ['A', 'Α'],
      ['B', 'Β'],
      ['G', 'Γ'],
      ['D', 'Δ'],
      ['E', 'Ε'],
      ['K', 'Κ'],
      ['L', 'Λ'],
      ['M', 'Μ'],
      ['N', 'Ν'],
      ['P', 'Π'],
      ['T', 'Τ'],
      ['S', 'Σ'],
    ])('uppercase key %s produces %s', (key, expected) => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), key);
      expect(getTextarea().value).toContain(expected);
    });
  });

  // ─── diacritical marks ───────────────────────────────────────────────────

  describe('diacritical key mappings', () => {
    it('key ) appends smooth breathing', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), ')');
      expect(getTextarea().value).toContain('\u0313');
    });

    it('key ( appends rough breathing', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '(');
      expect(getTextarea().value).toContain('\u0314');
    });

    it('key / appends acute accent', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '/');
      expect(getTextarea().value).toContain('\u0301');
    });

    it('key \\ appends grave accent', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '\\');
      expect(getTextarea().value).toContain('\u0300');
    });

    it('key = appends circumflex', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '=');
      expect(getTextarea().value).toContain('\u0342');
    });

    it('key | appends iota subscript', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '|');
      expect(getTextarea().value).toContain('\u0345');
    });
  });

  // ─── punctuation ─────────────────────────────────────────────────────────

  describe('punctuation key mappings', () => {
    it('key : produces ano teleia (·)', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), ':');
      expect(getTextarea().value).toContain('·');
    });

    it('key ? produces Greek question mark (;)', () => {
      render(<GreekKeyboard />);
      typeKey(getTextarea(), '?');
      expect(getTextarea().value).toContain(';');
    });
  });

  // ─── ctrl/cmd passthrough ─────────────────────────────────────────────────

  describe('ctrl/cmd passthrough', () => {
    it('does not intercept ctrl+a (select all)', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // ctrl+a should not produce 'α'
      fireEvent.keyDown(textarea, { key: 'a', ctrlKey: true });
      expect(textarea.value).toBe('');
    });

    it('does not intercept cmd+c (copy)', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      fireEvent.keyDown(textarea, { key: 'c', metaKey: true });
      expect(textarea.value).toBe('');
    });
  });

  // ─── final sigma ──────────────────────────────────────────────────────────

  describe('final sigma conversion', () => {
    it('converts σ to ς at end of input', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, 's');
      // At end of string, σ should become ς
      expect(textarea.value).toBe('ς');
    });

    it('keeps σ as σ in the middle of a word', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, 's');
      typeKey(textarea, 'a');
      // 'sa' → 'σα', σ is mid-word so stays σ
      expect(textarea.value).toContain('σ');
      expect(textarea.value).not.toMatch(/^ς/);
    });

    it('converts σ to ς before a space', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, 's');
      // Simulate a space being typed via onChange (space isn't intercepted)
      fireEvent.change(textarea, { target: { value: 'σ ' } });
      expect(textarea.value).toBe('ς ');
    });
  });

  // ─── Android / beforeinput path ──────────────────────────────────────────
  //
  // On Android, onKeyDown fires with key='Unidentified'. The onBeforeInput
  // handler reads InputEvent.data instead to perform the Greek mapping.
  // We simulate this by firing a beforeinput event directly (no keydown).

  describe('Android soft keyboard (beforeinput path)', () => {
    function fireBeforeInput(element: HTMLElement, data: string): void {
      fireEvent(
        element,
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }

    it('maps a Latin character to Greek via beforeinput', () => {
      render(<GreekKeyboard />);
      fireBeforeInput(getTextarea(), 'l');
      expect(getTextarea().value).toContain('λ');
    });

    it('maps a diacritic key via beforeinput', () => {
      render(<GreekKeyboard />);
      fireBeforeInput(getTextarea(), '/');
      expect(getTextarea().value).toContain('\u0301'); // acute
    });

    it('maps : to ano teleia via beforeinput', () => {
      render(<GreekKeyboard />);
      fireBeforeInput(getTextarea(), ':');
      expect(getTextarea().value).toContain('·');
    });

    it('maps ? to Greek question mark via beforeinput', () => {
      render(<GreekKeyboard />);
      fireBeforeInput(getTextarea(), '?');
      expect(getTextarea().value).toContain(';');
    });

    it('passes through unmapped characters via beforeinput', () => {
      render(<GreekKeyboard />);
      // Space is not in GREEK_MAP; beforeinput should not prevent default
      // and the onChange handler (fired by the subsequent input event) handles it.
      // Verify the handler does not append anything for space.
      const textarea = getTextarea();
      const before = textarea.value;
      fireBeforeInput(textarea, ' ');
      // Unmapped → no append; value unchanged until browser inserts it
      expect(textarea.value).toBe(before);
    });

    it('produces the correct sequence for a full word (logos)', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      for (const ch of 'logos') fireBeforeInput(textarea, ch);
      expect(textarea.value).toContain('λ');
      expect(textarea.value).toContain('ο');
      expect(textarea.value).toContain('γ');
    });
  });

  // ─── clear button ─────────────────────────────────────────────────────────

  describe('Clear button', () => {
    it('clears text from the textarea', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, 'a');
      expect(textarea.value).not.toBe('');

      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
      expect(textarea.value).toBe('');
    });
  });

  // ─── Android soft keyboard (onBeforeInput) ───────────────────────────────

  describe('Android soft keyboard (onBeforeInput)', () => {
    it('produces Greek character from beforeinput insertText event', async () => {
      render(<GreekKeyboard />);
      await typeViaBeforeInput(getTextarea(), 'a');
      expect(getTextarea().value).toContain('α');
    });

    it('produces diacritic character from beforeinput insertText event', async () => {
      render(<GreekKeyboard />);
      await typeViaBeforeInput(getTextarea(), '/');
      expect(getTextarea().value).toContain('\u0301');
    });

    it('ignores beforeinput events that are not insertText', async () => {
      render(<GreekKeyboard />);
      const event = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'inputType', { value: 'deleteContentBackward' });
      Object.defineProperty(event, 'data', { value: null });
      await act(async () => {
        fireEvent(getTextarea(), event);
      });
      expect(getTextarea().value).toBe('');
    });

    it('ignores beforeinput insertText with null data', async () => {
      render(<GreekKeyboard />);
      const event = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'inputType', { value: 'insertText' });
      Object.defineProperty(event, 'data', { value: null });
      await act(async () => {
        fireEvent(getTextarea(), event);
      });
      expect(getTextarea().value).toBe('');
    });

    it('does not double-insert when keydown and beforeinput both fire (iOS Safari guard)', async () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // Simulate iOS Safari: keydown fires first (handled by onKeyDown), then
      // beforeinput fires anyway. The guard ref should suppress the second insert.
      fireEvent.keyDown(textarea, { key: 'a' });
      await typeViaBeforeInput(textarea, 'a');
      // Should be 'α' once, not 'αα'
      expect(textarea.value).toBe('α');
    });

    it('accumulates multiple characters typed via beforeinput', async () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      await typeViaBeforeInput(textarea, 'l');
      await typeViaBeforeInput(textarea, 'o');
      await typeViaBeforeInput(textarea, 'g');
      await typeViaBeforeInput(textarea, 'o');
      await typeViaBeforeInput(textarea, 's');
      // λόγος without accents; final sigma applied by display
      expect(getTextarea().value).toContain('λ');
      expect(getTextarea().value).toContain('ο');
      expect(getTextarea().value).toContain('γ');
    });

    it('translates a multi-char beforeinput data string (Android IME word commit)', async () => {
      render(<GreekKeyboard />);
      // Some Android keyboards commit the whole composed word in one beforeinput
      // event instead of one per character.
      await typeViaBeforeInput(getTextarea(), 'logos');
      expect(getTextarea().value).toContain('λ');
      expect(getTextarea().value).toContain('ο');
      expect(getTextarea().value).toContain('γ');
    });
  });

  // ─── Android onChange fallback ───────────────────────────────────────────
  //
  // When Android's IME commits a composed word via onChange (bypassing
  // beforeinput), the handler must translate Latin text to Greek rather than
  // writing the raw Latin into state.

  describe('Android onChange fallback', () => {
    it('translates Latin text committed via onChange to Greek', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // Simulate the Android IME pushing "logos" into the DOM value
      fireEvent.change(textarea, { target: { value: 'logos' } });
      expect(textarea.value).toBe('λογος');
    });

    it('preserves Greek already in the textarea when onChange fires', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // Type a word first via keydown (Greek state built up correctly)
      typeKey(textarea, 'o');
      typeKey(textarea, 'l');
      // Simulate Android pushing Latin on top — state should stay Greek
      fireEvent.change(textarea, { target: { value: 'ol' } });
      expect(textarea.value).toBe('ολ');
    });

    it('handles a space appended by the IME after a Latin commit', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      fireEvent.change(textarea, { target: { value: 'logos ' } });
      // Space is not translated, Latin letters are
      expect(textarea.value).toBe('λογος ');
    });

    it('does not mangle Greek characters that pass through onChange', () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // Simulate paste of genuine Greek text
      fireEvent.change(textarea, { target: { value: 'λόγος' } });
      expect(textarea.value).toBe('λόγος');
    });

    it('does not double the word when onChange echoes what beforeinput already built', async () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      // beforeinput builds "λογος" in state one char at a time
      for (const ch of 'logos') await typeViaBeforeInput(textarea, ch);
      // The display value at this point is "λογος" (final sigma via applyFinalSigma)
      const afterBeforeInput = textarea.value;
      expect(afterBeforeInput).toBe('λογος');
      // Android IME then fires onChange with the same display string as an echo
      fireEvent.change(textarea, { target: { value: afterBeforeInput } });
      // Should still be "λογος", not "λογοσλογος" or "λογοσλογος"
      expect(textarea.value).toBe('λογος');
    });

    it('does accept new text when onChange value differs from last handled', async () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      await typeViaBeforeInput(textarea, 'o');
      // onChange fires with a genuinely different value (e.g. user pasted more)
      fireEvent.change(textarea, { target: { value: 'ο logos' } });
      expect(textarea.value).toBe('ο λογος');
    });
  });

  // ─── copy button ──────────────────────────────────────────────────────────

  describe('Copy to Clipboard button', () => {
    it('calls navigator.clipboard.writeText with current text', async () => {
      render(<GreekKeyboard />);
      const textarea = getTextarea();
      typeKey(textarea, 'a');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('α'));
    });

    it('shows "✓ Copied!" feedback after click', async () => {
      render(<GreekKeyboard />);
      fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
      expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
  });
});
