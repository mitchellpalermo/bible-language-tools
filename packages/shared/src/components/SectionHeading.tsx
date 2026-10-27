/** Section heading with an anchor ID for sidebar links. */
export default function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="text-2xl font-bold mb-6 pb-2 border-b-2 scroll-mt-6"
      style={{ color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }}
    >
      {children}
    </h2>
  );
}
