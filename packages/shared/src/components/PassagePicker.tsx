// Choose a passage: a book, then where it starts and where it ends. Shared by
// both apps; the books and how many verses a chapter has are passed in.
//
// STYLED INLINE ON FALLBACK-BEARING TOKENS, never Tailwind utilities, for the
// reasons at the top of GradeButtons.tsx: neither app scans packages/shared, so
// a utility class here emits no CSS.
//
// The picker is controlled and loads nothing. The app fetches a book's text and
// hands over `verseCounts` (null while it loads), so the verse menus are never
// longer than the chapter: a passage that names a verse that is not there is
// not a thing this picker can produce.

import { type CSSProperties, useId } from 'react';
import type { PassageRange } from '../focus-passages';

export interface PickerBook {
  code: string;
  name: string;
  chapters: number;
}

export interface PassagePickerProps {
  books: readonly PickerBook[];
  value: PassageRange;
  onChange: (range: PassageRange) => void;
  /** Last verse of each chapter of `value.book`, or null while the book loads. */
  verseCounts: Record<number, number> | null;
}

export type RangeEdit =
  | { field: 'book'; value: string }
  | { field: 'startChapter' | 'startVerse' | 'endChapter' | 'endVerse'; value: number };

/**
 * The range after one menu changed. Moving the start past the end drags the end
 * along with it, and a new end chapter ends at its last verse, which is the
 * common reason to change it. Pure, so the rules are tested without a DOM.
 */
export function editRange(
  range: PassageRange,
  edit: RangeEdit,
  verseCounts: Record<number, number> | null,
): PassageRange {
  const lastVerse = (chapter: number) => verseCounts?.[chapter] ?? 1;
  switch (edit.field) {
    case 'book':
      return { book: edit.value, startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 1 };
    case 'startChapter': {
      const endChapter = Math.max(range.endChapter, edit.value);
      const moved = edit.value > range.endChapter;
      return {
        ...range,
        startChapter: edit.value,
        startVerse: 1,
        endChapter,
        endVerse: moved ? lastVerse(edit.value) : range.endVerse,
      };
    }
    case 'startVerse':
      return {
        ...range,
        startVerse: edit.value,
        endVerse:
          range.startChapter === range.endChapter
            ? Math.max(range.endVerse, edit.value)
            : range.endVerse,
      };
    case 'endChapter':
      return { ...range, endChapter: edit.value, endVerse: lastVerse(edit.value) };
    case 'endVerse':
      return { ...range, endVerse: edit.value };
  }
}

const FALLBACK = {
  text: 'var(--color-text, #1F2937)',
  muted: 'var(--color-text-muted, #6B7280)',
  card: 'var(--color-bg-card, #FFFFFF)',
  border: '#9CA3AF',
};

const label: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: FALLBACK.muted,
};

const select: CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '8px 12px',
  fontSize: 16,
  color: FALLBACK.text,
  background: FALLBACK.card,
  border: `1px solid ${FALLBACK.border}`,
  borderRadius: 8,
};

const row: CSSProperties = { display: 'flex', gap: 12 };
const half: CSSProperties = { flex: 1, minWidth: 0 };

const numbers = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

export default function PassagePicker({ books, value, onChange, verseCounts }: PassagePickerProps) {
  const id = useId();
  const book = books.find((b) => b.code === value.book);
  const chapterCount = Math.max(book?.chapters ?? 1, value.endChapter);
  // `chosen` keeps the current value in the menu while a book's size is unknown.
  const verses = (chapter: number, floor: number, chosen: number) =>
    numbers(floor, Math.max(verseCounts?.[chapter] ?? 1, floor, chosen));

  const edit = (e: RangeEdit) => onChange(editRange(value, e, verseCounts));
  const num = (field: Exclude<RangeEdit['field'], 'book'>) => (e: { target: { value: string } }) =>
    edit({ field, value: Number(e.target.value) });

  const sameChapter = value.startChapter === value.endChapter;
  const endVerseFloor = sameChapter ? value.startVerse : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor={`${id}-book`} style={label}>
          Book
        </label>
        <select
          id={`${id}-book`}
          value={value.book}
          onChange={(e) => edit({ field: 'book', value: e.target.value })}
          style={select}
        >
          {books.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ ...label, padding: 0 }}>From</legend>
        <div style={row}>
          <div style={half}>
            <label htmlFor={`${id}-sc`} style={label}>
              Start chapter
            </label>
            <select
              id={`${id}-sc`}
              value={value.startChapter}
              onChange={num('startChapter')}
              style={select}
            >
              {numbers(1, chapterCount).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div style={half}>
            <label htmlFor={`${id}-sv`} style={label}>
              Start verse
            </label>
            <select
              id={`${id}-sv`}
              value={value.startVerse}
              onChange={num('startVerse')}
              style={select}
            >
              {verses(value.startChapter, 1, value.startVerse).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ ...label, padding: 0 }}>To</legend>
        <div style={row}>
          <div style={half}>
            <label htmlFor={`${id}-ec`} style={label}>
              End chapter
            </label>
            <select
              id={`${id}-ec`}
              value={value.endChapter}
              onChange={num('endChapter')}
              style={select}
            >
              {numbers(value.startChapter, chapterCount).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div style={half}>
            <label htmlFor={`${id}-ev`} style={label}>
              End verse
            </label>
            <select
              id={`${id}-ev`}
              value={value.endVerse}
              onChange={num('endVerse')}
              style={select}
            >
              {verses(value.endChapter, endVerseFloor, value.endVerse).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
