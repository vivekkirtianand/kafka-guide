"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Tech = "Kafka" | "Message queue" | "Relational database" | "Object storage" | "Direct API call";

const OPTIONS: Tech[] = ["Kafka", "Message queue", "Relational database", "Object storage", "Direct API call"];

interface Scenario {
  prompt: string;
  answer: Tech;
  rationale: string;
}

const SCENARIOS: Scenario[] = [
  {
    prompt:
      "Checkout must notify billing, email, the warehouse, and analytics when an order is placed — and a new loyalty service is coming next quarter.",
    answer: "Kafka",
    rationale:
      "Many independent consumers of the same events, and you want to add the loyalty service later without touching checkout. That is the retained log with multiple readers.",
  },
  {
    prompt:
      "A profile page needs the user's current email and shipping address, looked up by user id on every request.",
    answer: "Relational database",
    rationale:
      "This is a keyed lookup of current state. Kafka has no queries — put the state in a database and read it there.",
  },
  {
    prompt: "A nightly batch job writes a 6 GB report that a partner downloads once the next morning.",
    answer: "Object storage",
    rationale:
      "One large file, written once, read occasionally. Object storage is cheap and built for it; Kafka is a moving pipe, not a file store.",
  },
  {
    prompt:
      "Users upload photos; a pool of workers resizes each one, with per-job retries and a dead-letter for repeated failures.",
    answer: "Message queue",
    rationale:
      "One worker per job, plus per-message retry and dead-letter semantics. A dedicated queue does this natively; Kafka does not.",
  },
  {
    prompt: "A mobile app submits a form and must show the server's validation result on the very next screen.",
    answer: "Direct API call",
    rationale: "The caller needs an answer back, synchronously. That is request/response, not an event.",
  },
];

export default function TechnologyChoiceDemo() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Tech | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  const scenario = SCENARIOS[index];
  const done = answered === SCENARIOS.length && picked === null;

  function pick(tech: Tech) {
    if (picked) return;
    setPicked(tech);
    setAnswered((a) => a + 1);
    if (tech === scenario.answer) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setIndex((i) => (i + 1) % SCENARIOS.length);
  }

  function reset() {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setAnswered(0);
  }

  const correct = picked === scenario.answer;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="wk-tech-demo">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · pick the right tool
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real decisions weigh cost, team skills, and existing infrastructure too, and
        several tools can often be made to work. What carries over: match the tool to the access pattern —
        many readers and replay, one worker per message, keyed lookups, big files, or a synchronous answer.
      </p>

      {done ? (
        <div className="rounded-md border border-border-soft bg-bg-inset p-4" data-testid="wk-tech-summary">
          <Badge tone={score === SCENARIOS.length ? "success" : "accent"}>
            {score} / {SCENARIOS.length} correct
          </Badge>
          <p className="mt-3 text-sm text-text-muted">
            The through-line: Kafka earns its place when many systems need the same stream of events and the
            history is worth keeping. Otherwise a simpler tool usually wins.
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
            scenario {index + 1} of {SCENARIOS.length}
          </div>
          <p className="mb-4 text-sm leading-relaxed text-text" data-testid="wk-tech-prompt">
            {scenario.prompt}
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {OPTIONS.map((opt) => {
              const isAnswer = opt === scenario.answer;
              const isPicked = opt === picked;
              const tone = !picked
                ? "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
                : isAnswer
                  ? "border-success/50 bg-success-soft text-success"
                  : isPicked
                    ? "border-danger/50 bg-danger-soft text-danger"
                    : "border-border-soft bg-bg-inset text-text-faint";
              return (
                <button
                  key={opt}
                  onClick={() => pick(opt)}
                  disabled={!!picked}
                  className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${tone}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="rounded-md border border-border-soft bg-bg-inset p-4" data-testid="wk-tech-verdict">
              <Badge tone={correct ? "success" : "danger"}>{correct ? "good call" : "not the best fit"}</Badge>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                <span className="text-text">{scenario.answer}.</span> {scenario.rationale}
              </p>
              <button
                onClick={next}
                className="mt-3 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
              >
                {answered === SCENARIOS.length ? "see summary →" : "next scenario →"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
