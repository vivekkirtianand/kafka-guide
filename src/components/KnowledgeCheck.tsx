"use client";

import { useState } from "react";
import { KnowledgeCheck as Check } from "@/lib/types";
import Badge from "./Badge";

export default function KnowledgeCheck({ checks }: { checks: Check[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  const check = checks[index];
  const done = answered === checks.length && picked === null;

  function pick(option: number) {
    if (picked !== null) return;
    setPicked(option);
    setAnswered((a) => a + 1);
    if (option === check.answerIndex) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => (i + 1) % checks.length);
  }

  function reset() {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setAnswered(0);
  }

  const correct = picked === check.answerIndex;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="knowledge-check">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">Knowledge check</div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      {done ? (
        <div className="rounded-md border border-border-soft bg-bg-inset p-4" data-testid="kc-summary">
          <Badge tone={score === checks.length ? "success" : score >= Math.ceil(checks.length * 0.7) ? "accent" : "danger"}>
            {score} / {checks.length} correct
          </Badge>
          <p className="mt-3 text-sm text-text-muted">
            {score === checks.length
              ? "Full marks — you have the mental model this module is for."
              : score >= Math.ceil(checks.length * 0.7)
                ? "Solid. Re-skim any topic whose question you missed before moving on."
                : "Worth another pass through the topics above before the next module."}
          </p>
          <button
            onClick={reset}
            className="mt-3 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
          >
            start over
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 font-mono text-[11px] text-text-faint">
            question {index + 1} of {checks.length}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-text" data-testid="kc-question">
            {check.question}
          </p>

          <div className="mb-4 flex flex-col gap-2">
            {check.options.map((opt, i) => {
              const isAnswer = i === check.answerIndex;
              const isPicked = i === picked;
              const tone =
                picked === null
                  ? "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
                  : isAnswer
                    ? "border-success/50 bg-success-soft text-success"
                    : isPicked
                      ? "border-danger/50 bg-danger-soft text-danger"
                      : "border-border-soft bg-bg-inset text-text-faint";
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={picked !== null}
                  className={`rounded border px-3 py-2 text-left text-sm transition-colors ${tone}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div className="rounded-md border border-border-soft bg-bg-inset p-4" data-testid="kc-verdict">
              <Badge tone={correct ? "success" : "danger"}>{correct ? "correct" : "not quite"}</Badge>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{check.explanation}</p>
              <button
                onClick={next}
                className="mt-3 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
              >
                {answered === checks.length ? "see score →" : "next question →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
