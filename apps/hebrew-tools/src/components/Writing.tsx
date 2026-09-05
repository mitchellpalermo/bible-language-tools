import { useState } from 'react';
import WordWriting from './WordWriting';
import WritingPractice from './WritingPractice';

/**
 * The `/write` shell: letters or words.
 *
 * One island rather than two, because the choice is client state and Astro
 * islands cannot share it. Each mode still owns its own `ErrorBoundary` — a
 * crash in word mode must not take the letter drills down with it.
 *
 * Both modes are mounted lazily by being rendered conditionally: word mode
 * pulls in the vocabulary, and a student drilling the alphabet should not pay
 * for it.
 */
export type WritingSurface = 'letters' | 'words';

const SURFACES: { id: WritingSurface; label: string; hint: string }[] = [
  { id: 'letters', label: 'Letters', hint: 'The alphabet, final forms and vowel points' },
  { id: 'words', label: 'Words', hint: 'Whole words into a grid of guide boxes' },
];

export default function Writing() {
  const [surface, setSurface] = useState<WritingSurface>('letters');

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Writing practice mode" className="flex flex-wrap gap-2">
        {SURFACES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={surface === s.id}
            title={s.hint}
            onClick={() => setSurface(s.id)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-colors"
            style={
              surface === s.id
                ? {
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderColor: 'var(--color-primary)',
                  }
                : {
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-muted)',
                    borderColor: '#D1FAE5',
                  }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {surface === 'letters' ? <WritingPractice /> : <WordWriting />}
    </div>
  );
}
