"use client";

import { useMemo, useState } from "react";
import { troubleshooting } from "@/lib/data/troubleshooting";

export default function TroubleshootingCatalog() {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(troubleshooting[0]?.slug ?? null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return troubleshooting;
    return troubleshooting.filter(
      (t) => t.symptom.toLowerCase().includes(q) || t.causes.some((c) => c.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a symptom, e.g. 'rebalance', 'disk', 'timeout'…"
        className="mb-6 w-full max-w-md rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent/60"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((t) => {
          const open = openSlug === t.slug;
          return (
            <div key={t.slug} className="rounded-lg border border-border bg-bg-elevated">
              <button
                onClick={() => setOpenSlug(open ? null : t.slug)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-display text-base text-text">{t.symptom}</span>
                <span className="font-mono text-[11px] text-text-faint">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="grid grid-cols-1 gap-6 border-t border-border-soft px-4 py-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                      Possible causes
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {t.causes.map((c) => (
                        <li key={c} className="flex gap-2 text-sm text-text-muted">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-danger" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                      Resolution flow
                    </div>
                    <ol className="flex flex-col gap-1.5">
                      {t.resolutionFlow.map((r, i) => (
                        <li key={r} className="flex gap-2 text-sm text-text-muted">
                          <span className="font-mono text-[11px] text-accent">{i + 1}.</span>
                          {r}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-faint">
            No matching symptoms.
          </div>
        )}
      </div>
    </div>
  );
}
