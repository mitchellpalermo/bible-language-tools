/** Smaller heading within a section (e.g. for individual paradigm names). */
export default function ParadigmHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-semibold uppercase tracking-wider mb-3"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {children}
    </h3>
  );
}
