"use client";

import { useState } from "react";
import { Exercise } from "@/lib/types";

export default function DesignExercise({ exercises }: { exercises: Exercise[] }) {
  // Self-assessed — the learner ticks the criteria their own answer meets. No score, no
  // persistence; the checklist is the point.
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function reset() {
    setTicked(new Set());
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="design-exercise">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">Design exercise</div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      {exercises.map((ex, exIndex) => (
        <div key={exIndex} className={exIndex > 0 ? "mt-6 border-t border-border-soft pt-6" : ""}>
          <p className="mb-4 text-sm leading-relaxed text-text">{ex.prompt}</p>

          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-text-faint">
            A strong answer meets all of these — tick the ones yours does
          </div>
          <ul className="flex flex-col gap-2" data-testid="de-criteria">
            {ex.successCriteria.map((c, i) => {
              const key = `${exIndex}-${i}`;
              const on = ticked.has(key);
              return (
                <li key={key}>
                  <label className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-text-muted">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(key)}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-accent"
                    />
                    <span className={on ? "text-text" : ""}>{c}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 font-mono text-[11px] text-text-faint" data-testid="de-progress">
            {ex.successCriteria.filter((_, i) => ticked.has(`${exIndex}-${i}`)).length} / {ex.successCriteria.length}{" "}
            self-checked
          </p>
        </div>
      ))}
    </div>
  );
}
