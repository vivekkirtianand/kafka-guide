"use client";

import { useState } from "react";
import { Lab, LabCommand } from "@/lib/types";
import { useProgress } from "@/lib/context/ProgressContext";
import Badge from "./Badge";

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the command is still selectable.
    }
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[12px] leading-relaxed text-text">
        <code>{command}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-border bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted hover:border-accent/50 hover:text-accent"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

function CommandList({ commands }: { commands: LabCommand[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {commands.map((c) => (
        <li key={c.command} className="flex flex-col gap-1.5">
          <CommandBlock command={c.command} />
          <p className="text-[13px] leading-relaxed text-text-muted">{c.note}</p>
        </li>
      ))}
    </ol>
  );
}

export default function LabWalkthrough({ lab }: { lab: Lab }) {
  const { hydrated, stepDone, toggleStep, completedStepCount } = useProgress();
  const stepIds = lab.steps.map((s) => s.id);
  const done = completedStepCount(lab.slug, stepIds);
  const total = lab.steps.length;
  const pct = Math.round((done / total) * 100);

  return (
    <section
      className="rounded-lg border border-border bg-bg-elevated p-5 sm:p-6"
      data-testid="lab-walkthrough"
      aria-labelledby="lab-walkthrough-heading"
    >
      <div className="mb-1 font-mono text-xs uppercase tracking-wide text-text-faint">Hands-on lab</div>
      <h2 id="lab-walkthrough-heading" className="font-display text-xl text-text">
        {lab.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{lab.summary}</p>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-4">
        <h3 className="mb-2 font-display text-sm text-text">Before you start</h3>
        <ul className="flex flex-col gap-1.5">
          {lab.prerequisites.map((p) => (
            <li key={p} className="flex gap-2 text-[13px] leading-relaxed text-text-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stream" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 font-display text-sm text-text">Start the broker</h3>
        <CommandList commands={lab.setup} />
      </div>

      <div className="mt-6" data-testid="lab-progress">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-text-faint">
          <span>
            {done} / {total} steps done
          </span>
          {hydrated && done === total && <Badge tone="success">lab complete</Badge>}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${lab.title} progress`}
        >
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="mt-6 flex flex-col gap-6">
        {lab.steps.map((step, i) => {
          const checked = stepDone(lab.slug, step.id);
          return (
            <li
              key={step.id}
              data-testid="lab-step"
              className="rounded-md border border-border-soft bg-bg-inset p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-base text-text">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{step.intro}</p>

              <div className="mt-3 flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Run</span>
                <CommandBlock command={step.command} />
              </div>

              <div className="mt-3 flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
                  Expected output
                </span>
                <pre className="overflow-x-auto rounded-md border border-border-soft bg-bg-elevated p-3 font-mono text-[12px] leading-relaxed text-text-muted">
                  <code>{step.expected}</code>
                </pre>
              </div>

              <div className="mt-3 rounded-md border-l-2 border-stream bg-stream-soft px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-stream">
                  What did you observe?
                </span>
                <p className="mt-1 text-[13px] leading-relaxed text-text">{step.observe}</p>
              </div>

              {step.commonError && (
                <details className="mt-3 rounded-md border border-border-soft bg-bg-elevated px-3 py-2">
                  <summary className="cursor-pointer font-mono text-[11px] text-text-muted">
                    Something went wrong?
                  </summary>
                  <dl className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed">
                    <div>
                      <dt className="font-medium text-text">You see</dt>
                      <dd className="text-text-muted">{step.commonError.symptom}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-text">Why</dt>
                      <dd className="text-text-muted">{step.commonError.cause}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-text">Recover</dt>
                      <dd className="text-text-muted">{step.commonError.recovery}</dd>
                    </div>
                  </dl>
                </details>
              )}

              <label className="mt-3 flex items-center gap-2 text-[13px] text-text-muted">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!hydrated}
                  onChange={() => toggleStep(lab.slug, step.id)}
                  aria-label={`Mark done: ${step.title}`}
                  className="h-4 w-4 rounded border-border accent-success disabled:opacity-50"
                />
                I ran this and saw the expected result
              </label>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <h3 className="mb-2 font-display text-sm text-text">Clean up</h3>
        <CommandList commands={lab.teardown} />
        <div
          className="mt-3 rounded-md border-l-2 border-danger bg-danger-soft px-3 py-2"
          data-testid="lab-teardown-warning"
        >
          <span className="font-mono text-[10px] uppercase tracking-wide text-danger">Before you delete anything</span>
          <p className="mt-1 text-[13px] leading-relaxed text-text">{lab.teardownWarning}</p>
        </div>
      </div>
    </section>
  );
}
