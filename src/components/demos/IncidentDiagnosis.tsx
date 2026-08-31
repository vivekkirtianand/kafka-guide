"use client";

import { useState } from "react";
import Badge from "@/components/Badge";
import { IncidentClue, IncidentDiagnosisOption } from "@/lib/types";

export default function IncidentDiagnosis({
  clues,
  options,
}: {
  clues: IncidentClue[];
  options: IncidentDiagnosisOption[];
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<IncidentDiagnosisOption | null>(null);
  const [checksBeforeDiagnosis, setChecksBeforeDiagnosis] = useState(0);

  function reveal(label: string) {
    setRevealed((r) => new Set(r).add(label));
  }

  function pick(option: IncidentDiagnosisOption) {
    setChecksBeforeDiagnosis(revealed.size);
    setPicked(option);
  }

  function reset() {
    setRevealed(new Set());
    setPicked(null);
    setChecksBeforeDiagnosis(0);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">Investigate</div>
        {picked && (
          <button
            onClick={reset}
            className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
          >
            reset
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-2">
        {clues.map((c) => (
          <div key={c.label} className="rounded-md border border-border-soft bg-bg-inset p-3">
            {revealed.has(c.label) ? (
              <>
                <div className="font-mono text-[11px] text-accent">{c.label}</div>
                <div className="mt-1 text-sm text-text-muted">{c.evidence}</div>
              </>
            ) : (
              <button
                onClick={() => reveal(c.label)}
                className="font-mono text-[11px] text-text-muted hover:text-accent"
              >
                check {c.label} →
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mb-3 font-mono text-xs uppercase tracking-wide text-text-faint">
        What&apos;s the root cause?
      </div>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const isPicked = picked?.label === o.label;
          return (
            <button
              key={o.label}
              disabled={!!picked}
              onClick={() => pick(o)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${
                isPicked
                  ? o.correct
                    ? "border-success/50 bg-success-soft text-text"
                    : "border-danger/50 bg-danger-soft text-text"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4 rounded-md border border-border-soft bg-bg-inset p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={picked.correct ? "success" : "danger"}>
              {picked.correct ? "correct diagnosis" : "not quite"}
            </Badge>
            <span className="font-mono text-[11px] text-text-faint">
              {checksBeforeDiagnosis} of {clues.length} clues checked before deciding
            </span>
          </div>
          <p className="text-sm leading-relaxed text-text-muted">{picked.feedback}</p>
        </div>
      )}
    </div>
  );
}
