/**
 * Description bar displayed below paradigm tables.
 * Shows the active cell's grammatical description on hover/tap.
 */
export default function DescriptionBar({ text }: { text: string | null }) {
  return (
    <div
      className="mt-2 px-3 py-1.5 rounded text-xs min-h-[28px] transition-opacity"
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text-muted)',
        border: '1px solid #e5e7eb',
        opacity: text ? 1 : 0.4,
      }}
    >
      {text ?? 'Hover over a cell to see its grammatical description'}
    </div>
  );
}
