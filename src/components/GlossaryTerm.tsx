import { Fragment, ReactNode } from "react";
import Link from "next/link";
import { getGlossaryTerm } from "@/lib/data/glossary";

// An inline link to a glossary entry. `slug` must match a `GlossaryTerm.slug`; if it doesn't,
// the child text renders unlinked rather than pointing at a dead anchor.
export default function GlossaryTerm({ slug, children }: { slug: string; children?: ReactNode }) {
  const entry = getGlossaryTerm(slug);
  const label = children ?? entry?.term ?? slug;
  if (!entry) return <>{label}</>;

  return (
    <Link
      href={`/glossary#${slug}`}
      className="underline decoration-dotted decoration-text-faint underline-offset-2 hover:decoration-accent hover:text-accent"
      title={entry.definition}
    >
      {label}
    </Link>
  );
}

const TOKEN = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

// Renders text that may contain `[[slug]]` or `[[slug|display text]]` tokens, turning each
// into a <GlossaryTerm>. Returns the plain string untouched when there are no tokens.
export function renderGlossaryText(text: string): ReactNode {
  if (!text.includes("[[")) return text;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, slug, display] = m;
    out.push(
      <GlossaryTerm key={`${slug}-${m.index}`} slug={slug}>
        {display ?? undefined}
      </GlossaryTerm>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));

  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}
