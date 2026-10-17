/**
 * HebrewKeypad — on-screen Hebrew letters and points, for typing without the
 * phonetic mapping.
 *
 * It exists for the iPad. Pointed Hebrew through the system keyboard means a
 * layer switch for every `:` and `.` and a shift for every qamets, so a single
 * verb form costs a dozen of them. The keypad puts every letter and point one
 * tap away instead, and drives the field through `useHebrewInput`'s `insert`
 * and `backspace`; a hardware keyboard keeps working alongside it.
 *
 * Two things it depends on:
 *
 * - **Keys never take focus.** Every key cancels its own `pointerdown`, so
 *   tapping one leaves the caret in the field it was in. Without that the field
 *   blurs on every tap, and the next key has nowhere to go.
 * - **There are no final-form keys.** Final forms are applied at the end of a
 *   word automatically, as they are by the mapping, so ך on a key would be a
 *   second way to type the same thing.
 *
 * Points are labelled on a dotted circle (U+25CC), the convention for showing a
 * combining mark on its own; under a real letter it would read as that letter.
 */

import type { ReactNode, SyntheticEvent } from 'react';

export interface KeypadKey {
  /** What the key inserts. */
  text: string;
  /** What the key shows. */
  label: string;
  /** Spoken name, and the caption under a point. */
  name: string;
}

const DOTTED_CIRCLE = '◌';

/** The 22 letters in alphabetical order, with shin and sin as separate keys. */
export const KEYPAD_LETTERS: KeypadKey[] = [
  ['א', 'alef'],
  ['ב', 'bet'],
  ['ג', 'gimel'],
  ['ד', 'dalet'],
  ['ה', 'he'],
  ['ו', 'vav'],
  ['ז', 'zayin'],
  ['ח', 'het'],
  ['ט', 'tet'],
  ['י', 'yod'],
  ['כ', 'kaf'],
  ['ל', 'lamed'],
  ['מ', 'mem'],
  ['נ', 'nun'],
  ['ס', 'samek'],
  ['ע', 'ayin'],
  ['פ', 'pe'],
  ['צ', 'tsade'],
  ['ק', 'qof'],
  ['ר', 'resh'],
  ['שׂ', 'sin'],
  ['שׁ', 'shin'],
  ['ת', 'tav'],
].map(([text, name]) => ({ text, label: text, name }));

/**
 * Points, roughly in the order they are learned: dagesh and sheva first, then
 * the hateph vowels that sheva turns into, then the full vowels from front to
 * back. Holem waw and shureq insert a whole vav, as `O` and `U` do in the
 * mapping, because that is what they are.
 */
export const KEYPAD_POINTS: KeypadKey[] = [
  { text: 'ּ', label: `${DOTTED_CIRCLE}ּ`, name: 'dagesh' },
  { text: 'ְ', label: `${DOTTED_CIRCLE}ְ`, name: 'sheva' },
  { text: 'ֲ', label: `${DOTTED_CIRCLE}ֲ`, name: 'hateph patah' },
  { text: 'ֱ', label: `${DOTTED_CIRCLE}ֱ`, name: 'hateph segol' },
  { text: 'ֳ', label: `${DOTTED_CIRCLE}ֳ`, name: 'hateph qamets' },
  { text: 'ִ', label: `${DOTTED_CIRCLE}ִ`, name: 'hireq' },
  { text: 'ֵ', label: `${DOTTED_CIRCLE}ֵ`, name: 'tsere' },
  { text: 'ֶ', label: `${DOTTED_CIRCLE}ֶ`, name: 'segol' },
  { text: 'ַ', label: `${DOTTED_CIRCLE}ַ`, name: 'patah' },
  { text: 'ָ', label: `${DOTTED_CIRCLE}ָ`, name: 'qamets' },
  { text: 'ֹ', label: `${DOTTED_CIRCLE}ֹ`, name: 'holem' },
  { text: 'ֻ', label: `${DOTTED_CIRCLE}ֻ`, name: 'qibbuts' },
  { text: 'וֹ', label: 'וֹ', name: 'holem waw' },
  { text: 'וּ', label: 'וּ', name: 'shureq' },
];

/** Keep the caret where it is: a key that takes focus blurs the field it types into. */
function keepFocus(e: SyntheticEvent) {
  e.preventDefault();
}

function Key({
  onPress,
  ariaLabel,
  caption,
  children,
  wide = false,
}: {
  onPress: () => void;
  ariaLabel: string;
  caption?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      onClick={onPress}
      className={`flex flex-col items-center justify-center rounded-lg border border-primary/15 bg-bg-card shadow-sm active:bg-primary/10 transition-colors min-h-11 px-1 ${
        wide ? 'col-span-2' : ''
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
      {caption && (
        <span className="text-[0.625rem] leading-none text-text-muted mt-0.5" dir="ltr">
          {caption}
        </span>
      )}
    </button>
  );
}

const GRID = 'grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(2.75rem,1fr))]';

export interface HebrewKeypadProps {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  /** Move to the next blank — the iPad has no Tab key. Omit to hide the key. */
  onNext?: () => void;
}

export default function HebrewKeypad({ onInsert, onBackspace, onNext }: HebrewKeypadProps) {
  return (
    <section aria-label="Hebrew keypad" className="space-y-1.5">
      <div className={GRID} dir="rtl">
        {KEYPAD_LETTERS.map((key) => (
          <Key key={key.text} ariaLabel={key.name} onPress={() => onInsert(key.text)}>
            <span
              lang="he"
              className="text-xl text-hebrew"
              style={{ fontFamily: 'var(--font-hebrew)' }}
            >
              {key.label}
            </span>
          </Key>
        ))}
      </div>
      <div className={GRID} dir="rtl">
        {KEYPAD_POINTS.map((key) => (
          <Key
            key={key.name}
            ariaLabel={key.name}
            caption={key.name.replace('hateph ', 'h. ')}
            onPress={() => onInsert(key.text)}
          >
            <span
              lang="he"
              className="text-xl leading-tight text-hebrew"
              style={{ fontFamily: 'var(--font-hebrew)' }}
            >
              {key.label}
            </span>
          </Key>
        ))}
        <Key ariaLabel="Backspace" onPress={onBackspace} wide>
          <span className="text-lg text-text-muted">⌫</span>
        </Key>
        {onNext && (
          <Key ariaLabel="Next blank" onPress={onNext} wide>
            <span className="text-sm font-semibold text-primary" dir="ltr">
              Next ↵
            </span>
          </Key>
        )}
      </div>
    </section>
  );
}
