/**
 * A reading preference that turns on and off — Cantillation, Studied words,
 * Glosses. Shared by the reader and Daily Verse, which read the same
 * preferences and should present them the same way.
 *
 * `aria-pressed` on a button rather than `ToggleSwitch`'s `role="switch"`: these
 * sit in a toolbar beside the reader's book and chapter controls, as a row of
 * pressed-or-not pills, and changed together they read as one set.
 */
export default function PrefToggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
        on
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-primary/10 text-text-muted hover:border-primary/40'
      }`}
    >
      {children}
    </button>
  );
}
