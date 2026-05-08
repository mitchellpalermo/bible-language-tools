import type { NumKey } from '../../data/grammar';

const LABELS: Record<NumKey, string> = { sg: 'Sg', pl: 'Pl' };
const NUMBERS: NumKey[] = ['sg', 'pl'];

/** Singular / Plural pill toggle. Only visible on mobile (< md). */
export default function NumberToggle({
  activeNumber,
  onToggle,
}: {
  activeNumber: NumKey;
  onToggle: (num: NumKey) => void;
}) {
  return (
    <span
      className="md:hidden inline-flex rounded-full border overflow-hidden"
      style={{ borderColor: 'var(--color-text-muted)' }}
    >
      {NUMBERS.map((num) => (
        <button
          key={num}
          onClick={() => onToggle(num)}
          aria-pressed={activeNumber === num}
          className="text-xs px-2.5 py-1 font-medium transition-colors"
          style={
            activeNumber === num
              ? { background: 'var(--color-primary)', color: '#fff' }
              : { background: 'transparent', color: 'var(--color-text-muted)' }
          }
        >
          {LABELS[num]}
        </button>
      ))}
    </span>
  );
}
