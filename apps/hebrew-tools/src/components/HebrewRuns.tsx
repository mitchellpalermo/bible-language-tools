// Hebrew inside English chrome — shared by the Grammar Reference and the
// paradigm quiz, which both label tables with strings like "III-ה (בנה)".

/** A Hebrew run inside the page's English chrome. */
export function Hebrew({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span
      dir="rtl"
      lang="he"
      className={`text-hebrew ${className}`}
      style={{ fontFamily: 'var(--font-hebrew)' }}
    >
      {children}
    </span>
  );
}

const HEBREW_RUN = /([֐-׿]+(?:\s+[֐-׿]+)*)/;

/**
 * English prose that mentions Hebrew.
 *
 * The notes in `grammar.ts` are plain strings — "ר is not a guttural" — and a
 * Hebrew run dropped raw into an English sentence is ordered by the bidi
 * algorithm against whatever punctuation happens to sit beside it, in the UI
 * font. Splitting the runs out gives each its own direction and the Hebrew face.
 */
export function Prose({ children }: { children: string }) {
  return children.split(HEBREW_RUN).map((part, i) =>
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one string are positional
    i % 2 === 1 ? <Hebrew key={i}>{part}</Hebrew> : part,
  );
}
