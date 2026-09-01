"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { glossary, getGlossaryTerm } from "@/lib/data/glossary";
import { getModule } from "@/lib/data/modules";

const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));

export default function Glossary() {
  const [query, setQuery] = useState("");

  // Support landing on /glossary#<slug> — open nothing special, just make sure the row is
  // scrolled into view once rendered (Next's client nav doesn't always honor the hash).
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: "center" });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.definition.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the glossary"
        placeholder="Search a term or definition — e.g. 'offset', 'ISR', 'compaction'…"
        className="mb-6 w-full max-w-md rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent/60"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted">No term matches “{query}”.</p>
      ) : (
        <dl className="flex flex-col divide-y divide-border-soft">
          {filtered.map((t) => {
            const seeAlso = (t.seeAlso ?? [])
              .map((s) => getGlossaryTerm(s))
              .filter((x): x is NonNullable<typeof x> => Boolean(x));
            const mods = (t.modules ?? []).map((s) => getModule(s)).filter((m) => m);

            return (
              <div key={t.slug} id={t.slug} className="scroll-mt-24 py-4">
                <dt className="font-display text-base text-text">{t.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-text-muted">{t.definition}</dd>

                {(seeAlso.length > 0 || mods.length > 0) && (
                  <div className="mt-2 flex flex-col gap-1 font-mono text-[11px] text-text-faint">
                    {seeAlso.length > 0 && (
                      <div>
                        See also:{" "}
                        {seeAlso.map((s, i) => (
                          <span key={s.slug}>
                            {i > 0 && ", "}
                            <a href={`#${s.slug}`} className="text-accent hover:underline">
                              {s.term}
                            </a>
                          </span>
                        ))}
                      </div>
                    )}
                    {mods.length > 0 && (
                      <div>
                        Appears in:{" "}
                        {mods.map((m, i) => (
                          <span key={m!.slug}>
                            {i > 0 && ", "}
                            <Link href={`/modules/${m!.slug}`} className="text-accent hover:underline">
                              {m!.title}
                            </Link>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
