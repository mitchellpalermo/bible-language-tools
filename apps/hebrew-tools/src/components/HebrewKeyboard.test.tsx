import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HebrewKeyboard from './HebrewKeyboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTextarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

function typeKey(textarea: HTMLTextAreaElement, key: string): void {
  fireEvent.keyDown(textarea, { key });
}

async function typeViaBeforeInput(textarea: HTMLTextAreaElement, data: string): Promise<void> {
  const event = new Event('beforeinput', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'inputType', { value: 'insertText' });
  Object.defineProperty(event, 'data', { value: data });
  await act(async () => {
    fireEvent(textarea, event);
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('HebrewKeyboard', () => {
  beforeEach(() => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  it('renders the textarea', () => {
    render(<HebrewKeyboard />);
    expect(getTextarea()).toBeInTheDocument();
  });

  it('textarea has dir="rtl"', () => {
    render(<HebrewKeyboard />);
    expect(getTextarea()).toHaveAttribute('dir', 'rtl');
  });

  it('renders Copy to Clipboard button', () => {
    render(<HebrewKeyboard />);
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it('renders Clear button', () => {
    render(<HebrewKeyboard />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Consonant key mappings
  // ---------------------------------------------------------------------------

  describe('consonant key mappings', () => {
    it.each([
      ["'", 'א'],
      ['b', 'ב'],
      ['g', 'ג'],
      ['d', 'ד'],
      ['h', 'ה'],
      ['w', 'ו'],
      ['v', 'ו'],
      ['z', 'ז'],
      ['c', 'ח'],
      ['t', 'ט'],
      ['y', 'י'],
      ['l', 'ל'],
      ['s', 'ס'],
      ['`', 'ע'],
      ['q', 'ק'],
      ['r', 'ר'],
      ['T', 'ת'],
    ] as [string, string][])('key %s produces %s', (key, expected) => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), key);
      expect(getTextarea().value).toContain(expected);
    });

    // Letters with final forms: type two consonants so the first is mid-word
    it.each([
      ['k', 'l', 'כ'],   // kaf + lamed: kaf is mid-word, stays כ
      ['m', 'l', 'מ'],   // mem + lamed: mem is mid-word, stays מ
      ['n', 'l', 'נ'],   // nun + lamed: nun is mid-word, stays נ
      ['p', 'l', 'פ'],   // pe  + lamed: pe  is mid-word, stays פ
      ['x', 'l', 'צ'],   // tsade + lamed: tsade is mid-word, stays צ
    ] as [string, string, string][])('key %s mid-word produces %s (not final form)', (key, follow, expected) => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, key);
      typeKey(ta, follow);
      expect(ta.value).toContain(expected);
    });

    it('key S produces shin with shin dot (שׁ)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'S');
      expect(getTextarea().value).toContain('שׁ');
    });

    it('key # produces shin with shin dot (שׁ)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), '#');
      expect(getTextarea().value).toContain('שׁ');
    });

    it('key $ produces shin with sin dot (שׂ)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), '$');
      expect(getTextarea().value).toContain('שׂ');
    });
  });

  // ---------------------------------------------------------------------------
  // Nikud key mappings
  // ---------------------------------------------------------------------------

  describe('nikud key mappings', () => {
    it.each([
      ['a', 'ַ'],  // patah
      ['A', 'ָ'],  // qamets
      ['e', 'ֶ'],  // segol
      ['E', 'ֵ'],  // tsere
      ['i', 'ִ'],  // hireq
      ['o', 'ֹ'],  // holem
      ['u', 'ֻ'],  // qibbuts
    ] as [string, string][])('key %s produces %s', (key, expected) => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), key);
      expect(getTextarea().value).toContain(expected);
    });

    it('key O produces holem waw (וֹ)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'O');
      expect(getTextarea().value).toContain('וֹ');
    });

    it('key U produces shureq (וּ)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'U');
      expect(getTextarea().value).toContain('וּ');
    });
  });

  // ---------------------------------------------------------------------------
  // Sheva and hateph sequences
  // ---------------------------------------------------------------------------

  describe('sheva and hateph sequences', () => {
    it('key : produces sheva', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), ':');
      expect(getTextarea().value).toContain('ְ');
    });

    it(':a sequence produces hateph patah (replaces sheva)', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, ':');
      typeKey(ta, 'a');
      // Should contain hateph patah, not sheva
      expect(ta.value).toContain('ֲ');  // hateph patah
      expect(ta.value).not.toContain('ְ');  // no sheva
    });

    it(':e sequence produces hateph segol (replaces sheva)', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, ':');
      typeKey(ta, 'e');
      expect(ta.value).toContain('ֱ');  // hateph segol
      expect(ta.value).not.toContain('ְ');
    });

    it(':A sequence produces hateph qamets (replaces sheva)', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, ':');
      typeKey(ta, 'A');
      expect(ta.value).toContain('ֳ');  // hateph qamets
      expect(ta.value).not.toContain('ְ');
    });

    it(': followed by non-hateph key keeps sheva and types the key', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, ':');
      typeKey(ta, 'b');
      // Sheva should still be present, and bet should be appended
      expect(ta.value).toContain('ְ');  // sheva
      expect(ta.value).toContain('ב');
    });
  });

  // ---------------------------------------------------------------------------
  // Dagesh
  // ---------------------------------------------------------------------------

  describe('dagesh', () => {
    it('key . produces dagesh (U+05BC)', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), '.');
      expect(getTextarea().value).toContain('ּ');
    });

    it('key * produces dagesh', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), '*');
      expect(getTextarea().value).toContain('ּ');
    });
  });

  // ---------------------------------------------------------------------------
  // Final letter forms
  // ---------------------------------------------------------------------------

  describe('final letter forms', () => {
    it('converts כ to ך at end of word', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'k');
      // kaf at end of input should display as final kaf
      expect(getTextarea().value).toContain('ך');
    });

    it('keeps כ as כ in the middle of a word', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, 'k');
      typeKey(ta, 'l');
      // kaf followed by lamed — not final
      expect(ta.value).toContain('כ');
      expect(ta.value).not.toContain('ך');
    });

    it('converts מ to ם at end of word', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'm');
      expect(getTextarea().value).toContain('ם');
    });

    it('converts נ to ן at end of word', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'n');
      expect(getTextarea().value).toContain('ן');
    });

    it('converts פ to ף at end of word', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'p');
      expect(getTextarea().value).toContain('ף');
    });

    it('converts צ to ץ at end of word', () => {
      render(<HebrewKeyboard />);
      typeKey(getTextarea(), 'x');
      expect(getTextarea().value).toContain('ץ');
    });
  });

  // ---------------------------------------------------------------------------
  // Ctrl/Meta passthrough
  // ---------------------------------------------------------------------------

  describe('ctrl/meta passthrough', () => {
    it('does not intercept ctrl+a (select all)', () => {
      render(<HebrewKeyboard />);
      fireEvent.keyDown(getTextarea(), { key: 'a', ctrlKey: true });
      expect(getTextarea().value).toBe('');
    });

    it('does not intercept cmd+c (copy)', () => {
      render(<HebrewKeyboard />);
      fireEvent.keyDown(getTextarea(), { key: 'c', metaKey: true });
      expect(getTextarea().value).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Android soft keyboard (beforeinput path)
  // ---------------------------------------------------------------------------

  describe('Android soft keyboard (beforeinput path)', () => {
    it('maps a consonant key via beforeinput', async () => {
      render(<HebrewKeyboard />);
      await typeViaBeforeInput(getTextarea(), 'b');
      expect(getTextarea().value).toContain('ב');
    });

    it('maps a nikud key via beforeinput', async () => {
      render(<HebrewKeyboard />);
      await typeViaBeforeInput(getTextarea(), 'a');
      expect(getTextarea().value).toContain('ַ');
    });

    it('handles :a hateph sequence via beforeinput', async () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      await typeViaBeforeInput(ta, ':');
      await typeViaBeforeInput(ta, 'a');
      expect(ta.value).toContain('ֲ');
      expect(ta.value).not.toContain('ְ');
    });

    it('does not double-insert when keydown and beforeinput both fire (iOS guard)', async () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      fireEvent.keyDown(ta, { key: 'b' });
      await typeViaBeforeInput(ta, 'b');
      // Should be ב once — raw state has 'ב', display via applyFinalForms may vary
      expect([...ta.value].filter((c) => c === 'ב').length).toBe(1);
    });

    it('ignores beforeinput events that are not insertText', async () => {
      render(<HebrewKeyboard />);
      const event = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'inputType', { value: 'deleteContentBackward' });
      Object.defineProperty(event, 'data', { value: null });
      await act(async () => { fireEvent(getTextarea(), event); });
      expect(getTextarea().value).toBe('');
    });

    it('ignores beforeinput insertText with null data', async () => {
      render(<HebrewKeyboard />);
      const event = new Event('beforeinput', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'inputType', { value: 'insertText' });
      Object.defineProperty(event, 'data', { value: null });
      await act(async () => { fireEvent(getTextarea(), event); });
      expect(getTextarea().value).toBe('');
    });

    it('translates a multi-char beforeinput data string (Android IME word commit)', async () => {
      render(<HebrewKeyboard />);
      await typeViaBeforeInput(getTextarea(), 'mlk');
      expect(getTextarea().value).toContain('מ');
      expect(getTextarea().value).toContain('ל');
    });
  });

  // ---------------------------------------------------------------------------
  // Android onChange fallback
  // ---------------------------------------------------------------------------

  describe('Android onChange fallback', () => {
    it('translates Latin text committed via onChange to Hebrew', () => {
      render(<HebrewKeyboard />);
      fireEvent.change(getTextarea(), { target: { value: 'mlk' } });
      expect(getTextarea().value).toContain('מ');
    });

    it('does not mangle Hebrew characters that pass through onChange', () => {
      render(<HebrewKeyboard />);
      fireEvent.change(getTextarea(), { target: { value: 'מֶלֶך' } });
      expect(getTextarea().value).toContain('מ');
      expect(getTextarea().value).toContain('ל');
    });

    it('does not double the word when onChange echoes what beforeinput already built', async () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      for (const ch of 'mlk') await typeViaBeforeInput(ta, ch);
      const afterBeforeInput = ta.value;
      fireEvent.change(ta, { target: { value: afterBeforeInput } });
      // Should not be doubled
      expect([...ta.value].filter((c) => c === 'מ').length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Clear button
  // ---------------------------------------------------------------------------

  describe('Clear button', () => {
    it('clears text from the textarea', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, 'b');
      expect(ta.value).not.toBe('');
      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
      expect(ta.value).toBe('');
    });

    it('resets pending hateph state on clear', () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, ':');  // pending hateph
      fireEvent.click(screen.getByRole('button', { name: /clear/i }));
      // Typing 'a' after clear should produce patah, not hateph patah
      typeKey(ta, 'a');
      expect(ta.value).toContain('ַ');  // patah
      expect(ta.value).not.toContain('ֲ');  // not hateph patah
    });
  });

  // ---------------------------------------------------------------------------
  // Copy to Clipboard button
  // ---------------------------------------------------------------------------

  describe('Copy to Clipboard button', () => {
    it('calls navigator.clipboard.writeText with current text', async () => {
      render(<HebrewKeyboard />);
      const ta = getTextarea();
      typeKey(ta, 'b');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('ב'));
    });

    it('shows "✓ Copied!" feedback after click', async () => {
      render(<HebrewKeyboard />);
      fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
      expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Key mapping reference chart
  // ---------------------------------------------------------------------------

  describe('key mapping reference', () => {
    it('renders a collapsible key mappings section', () => {
      render(<HebrewKeyboard />);
      expect(screen.getByText(/key mappings reference/i)).toBeInTheDocument();
    });
  });
});
