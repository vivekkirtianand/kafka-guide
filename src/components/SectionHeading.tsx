export default function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-3xl">
      {eyebrow && (
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{eyebrow}</div>
      )}
      <h1 className="font-display text-3xl leading-tight text-text sm:text-4xl">{title}</h1>
      {description && <p className="mt-3 text-[15px] leading-relaxed text-text-muted">{description}</p>}
    </div>
  );
}
