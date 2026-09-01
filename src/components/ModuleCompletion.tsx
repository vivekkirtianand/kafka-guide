"use client";

import { useEffect } from "react";
import { useProgress } from "@/lib/context/ProgressContext";

export default function ModuleCompletion({
  slug,
  completionCriteria,
}: {
  slug: string;
  completionCriteria?: string[];
}) {
  const { hydrated, isComplete, toggleComplete, markVisited } = useProgress();

  useEffect(() => {
    markVisited(slug);
  }, [slug, markVisited]);

  const done = isComplete(slug);

  return (
    <div className="mt-12 rounded-lg border border-border bg-bg-elevated p-5">
      {completionCriteria && completionCriteria.length > 0 && (
        <>
          <h2 className="mb-2 font-display text-sm text-text">You&apos;re done when</h2>
          <ul className="mb-4 flex flex-col gap-1.5">
            {completionCriteria.map((c) => (
              <li key={c} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stream" />
                {c}
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        onClick={() => toggleComplete(slug)}
        disabled={!hydrated}
        aria-pressed={done}
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          done
            ? "border-success/40 bg-success-soft text-success"
            : "border-border text-text hover:border-accent/50 hover:text-accent"
        }`}
      >
        {done ? (
          <>
            <span aria-hidden>✓</span> Completed — mark incomplete
          </>
        ) : (
          "Mark module complete"
        )}
      </button>
    </div>
  );
}
