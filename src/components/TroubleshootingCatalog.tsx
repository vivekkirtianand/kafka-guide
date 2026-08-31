"use client";

import { useMemo, useState } from "react";
import { troubleshooting } from "@/lib/data/troubleshooting";

export default function TroubleshootingCatalog() {
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(troubleshooting[0]?.slug ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return troubleshooting;
    return troubleshooting.filter(
      (t) =>
        t.symptom.toLowerCase().includes(q) ||
        t.overview.toLowerCase().includes(q) ||
        t.causes.some((c) => c.cause.toLowerCase().includes(q) || c.evidence.toLowerCase().includes(q)) ||
        t.resolutionFlow.some((r) => r.toLowerCase().includes(q)) ||
        (t.keyConfigs ?? []).some((k) => k.toLowerCase().includes(q)) ||
        (t.watchOut ?? "").toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div data-testid="troubleshooting-catalog">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a symptom, cause, or config — e.g. 'rebalance', 'disk', 'advertised.listeners'…"
        className="mb-6 w-full max-w-md rounded border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent/60"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((t) => {
          const open = openSlug === t.slug;
          return (
            <div key={t.slug} data-testid={`entry-${t.slug}`} className="rounded-lg border border-border bg-bg-elevated">
              <button
                onClick={() => setOpenSlug(open ? null : t.slug)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-display text-base text-text">{t.symptom}</span>
                <span className="font-mono text-[11px] text-text-faint">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="border-t border-border-soft px-4 py-4">
                  <p className="mb-5 text-sm leading-relaxed text-text-muted">{t.overview}</p>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                        Cause → evidence
                      </div>
                      <ul className="flex flex-col gap-3">
                        {t.causes.map((c) => (
                          <li key={c.cause} className="flex gap-2 text-sm">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-danger" />
                            <span>
                              <span className="text-text">{c.cause}</span>
                              <span className="mt-0.5 block text-[13px] leading-relaxed text-text-muted">
                                {c.evidence}
                              </span>
                            </span>
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

                  {t.keyConfigs && t.keyConfigs.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                        Key configs
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.keyConfigs.map((k) => (
                          <span
                            key={k}
                            className="rounded border border-border-soft bg-bg-inset px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {t.watchOut && (
                    <div className="mt-5 rounded-md border border-border-soft border-l-2 border-l-danger bg-danger-soft px-3 py-2">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-danger">Watch out</span>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">{t.watchOut}</p>
                    </div>
                  )}
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
