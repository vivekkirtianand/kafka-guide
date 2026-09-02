"use client";

import { useState } from "react";
import { Walkthrough } from "@/lib/types";
import { useProgress } from "@/lib/context/ProgressContext";
import Badge from "./Badge";

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!navigator.clipboard) return; // insecure context / old browser — text is still selectable
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // permission denied — leave the button unchanged rather than claim success
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded border border-border bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted hover:border-accent/50 hover:text-accent ${className}`}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[12px] leading-relaxed text-text">
        <code>{command}</code>
      </pre>
      <CopyButton text={command} className="absolute right-2 top-2" />
    </div>
  );
}

function SnippetBlock({ file, code }: { file: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border-soft">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-bg-elevated px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-text-faint">{file}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto bg-bg-inset p-3 font-mono text-[12px] leading-relaxed text-text">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function WalkthroughBody({ walkthrough }: { walkthrough: Walkthrough }) {
  const { hydrated, stepDone, toggleStep, completedStepCount } = useProgress();
  const lessonIds = walkthrough.lessons.map((l) => l.id);
  const done = completedStepCount(walkthrough.slug, lessonIds);
  const total = walkthrough.lessons.length;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <p className="text-sm leading-relaxed text-text-muted">{walkthrough.summary}</p>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-4">
        <h3 className="mb-1.5 font-display text-sm text-text">Get the code in front of you</h3>
        <p className="text-[13px] leading-relaxed text-text-muted">{walkthrough.cloneNote}</p>
        <p className="mt-2 font-mono text-[11px] text-text-faint">{walkthrough.repoPath}/</p>
      </div>

      <div className="mt-6" data-testid="walkthrough-progress">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-text-faint">
          <span>
            {done} / {total} lessons read
          </span>
          {hydrated && done === total && <Badge tone="success">walkthrough complete</Badge>}
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${walkthrough.title} progress`}
        >
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="mt-6 flex flex-col gap-6">
        {walkthrough.lessons.map((lesson, i) => {
          const checked = stepDone(walkthrough.slug, lesson.id);
          return (
            <li
              key={lesson.id}
              data-testid="walkthrough-lesson"
              className="rounded-md border border-border-soft bg-bg-inset p-4"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-base text-text">{lesson.title}</h3>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{lesson.intro}</p>

              <div className="mt-3">
                <SnippetBlock file={lesson.file} code={lesson.code} />
              </div>

              <dl className="mt-3 flex flex-col gap-2">
                {lesson.points.map((p) => (
                  <div key={p.term} className="flex flex-col gap-0.5">
                    <dt className="font-mono text-[12px] text-accent">{p.term}</dt>
                    <dd className="text-[13px] leading-relaxed text-text-muted">{p.detail}</dd>
                  </div>
                ))}
              </dl>

              {lesson.run && (
                <div className="mt-3 rounded-md border-l-2 border-stream bg-stream-soft px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-stream">Try it</span>
                  <div className="mt-1.5">
                    <CommandBlock command={lesson.run} />
                  </div>
                </div>
              )}

              {lesson.watchOut && (
                <div className="mt-3 rounded-md border-l-2 border-danger bg-danger-soft px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-danger">Watch out</span>
                  <p className="mt-1 text-[13px] leading-relaxed text-text">{lesson.watchOut}</p>
                </div>
              )}

              <label className="mt-3 flex items-center gap-2 text-[13px] text-text-muted">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!hydrated}
                  onChange={() => toggleStep(walkthrough.slug, lesson.id)}
                  aria-label={`Mark read: ${lesson.title}`}
                  className="h-4 w-4 rounded border-border accent-success disabled:opacity-50"
                />
                I read this and looked at the file
              </label>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export default function CodeWalkthrough({ walkthrough }: { walkthrough: Walkthrough }) {
  return (
    <section
      className="rounded-lg border border-border bg-bg-elevated p-5 sm:p-6"
      data-testid="code-walkthrough"
      aria-labelledby="code-walkthrough-heading"
    >
      <div className="mb-1 font-mono text-xs uppercase tracking-wide text-text-faint">Code walkthrough</div>
      <h2 id="code-walkthrough-heading" className="font-display text-xl text-text">
        {walkthrough.title}
      </h2>
      <div className="mt-2">
        <WalkthroughBody walkthrough={walkthrough} />
      </div>
    </section>
  );
}
