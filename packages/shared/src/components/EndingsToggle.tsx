/** Toggle button for switching between full forms and endings only. */
export default function EndingsToggle({
  showEndings,
  onToggle,
}: {
  showEndings: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="text-xs px-2.5 py-1 rounded-full border font-medium transition-colors"
      style={
        showEndings
          ? {
              background: 'var(--color-primary)',
              color: '#fff',
              borderColor: 'var(--color-primary)',
            }
          : {
              background: 'transparent',
              color: 'var(--color-text-muted)',
              borderColor: 'var(--color-text-muted)',
            }
      }
    >
      {showEndings ? 'Endings only' : 'Full forms'}
    </button>
  );
}
