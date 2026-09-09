"use client";

import { Capstone } from "@/lib/types";
import { getModule } from "@/lib/data/modules";
import { useProgress } from "@/lib/context/ProgressContext";
import Badge from "./Badge";

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className={className}>
          {renderBold(para)}
        </p>
      ))}
    </>
  );
}

// Minimal **bold** support so the brief can emphasise a name without pulling in a markdown dep.
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") ? (
      <strong key={i} className="font-semibold text-text">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  );
}

function moduleTitle(slug: string): string {
  return getModule(slug)?.title ?? slug;
}

export default function CapstoneBrief({ capstone, slug }: { capstone: Capstone; slug: string }) {
  const { hydrated, stepDone, toggleStep, completedStepCount } = useProgress();
  const ids = capstone.requirements.map((r) => r.id);
  const done = completedStepCount(slug, ids);
  const total = ids.length;

  return (
    <div className="flex flex-col gap-10" data-testid="capstone">
      <section>
        <h2 className="mb-3 font-display text-lg text-text">The brief</h2>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-text-muted">
          <Paragraphs text={capstone.brief} />
        </div>
        <p className="mt-4 rounded-md border border-border bg-bg-elevated px-3 py-2 font-mono text-[12px] leading-relaxed text-text-muted">
          <span className="text-text-faint">Stack: </span>
          {capstone.stack}
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-text">The spec</h2>
          <span
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Capstone requirements complete"
            className="font-mono text-[11px] text-text-faint"
          >
            {done} / {total} done
          </span>
        </div>
        <ol className="flex flex-col gap-3" data-testid="capstone-spec">
          {capstone.requirements.map((r, i) => {
            const on = stepDone(slug, r.id);
            return (
              <li key={r.id} className="rounded-lg border border-border bg-bg-elevated p-4">
                <label className="flex cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!hydrated}
                    onChange={() => toggleStep(slug, r.id)}
                    aria-label={`Mark done: ${r.title}`}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-accent"
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-text">
                      <span className="text-text-faint">{i + 1}.</span> {r.title}
                    </span>
                    <span className="text-sm leading-relaxed text-text-muted">{r.detail}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {r.buildsOn.map((m) => (
                        <Badge key={m} tone="neutral">
                          {moduleTitle(m)}
                        </Badge>
                      ))}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg text-text">How it is scored</h2>
        <p className="mb-4 text-sm leading-relaxed text-text-muted">
          Score your own work against each axis. Anything below <span className="font-semibold text-text">Meets</span>{" "}
          needs a sentence on what is missing.
        </p>
        <div className="flex flex-col gap-4" data-testid="capstone-rubric">
          {capstone.rubric.map((d) => (
            <div key={d.name} className="rounded-lg border border-border bg-bg-elevated p-4">
              <div className="mb-2">
                <span className="text-sm font-semibold text-text">{d.name}</span>
                <span className="ml-2 text-sm text-text-muted">— {d.focus}</span>
              </div>
              <dl className="flex flex-col gap-2">
                {d.levels.map((l) => (
                  <div key={l.label} className="grid grid-cols-[4.5rem_1fr] gap-3">
                    <dt>
                      <Badge tone={l.label === "Meets" ? "success" : l.label === "Partial" ? "accent" : "danger"}>
                        {l.label}
                      </Badge>
                    </dt>
                    <dd className="text-sm leading-relaxed text-text-muted">{l.descriptor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-text">What to hand in</h2>
        <ul className="flex flex-col gap-2">
          {capstone.submission.map((s) => (
            <li key={s} className="flex gap-2 text-sm leading-relaxed text-text-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
