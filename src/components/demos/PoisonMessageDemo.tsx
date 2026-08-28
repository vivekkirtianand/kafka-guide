"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// 6 records on the main partition; offset 2 is a poison message the handler can never
// process successfully.
const RECORDS = [0, 1, 2, 3, 4, 5];
const POISON_OFFSET = 2;
const MAX_RETRIES = 3;

type Strategy = "none" | "dlt" | "retry-topics";

const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "none", label: "unbounded retry" },
  { id: "dlt", label: "dead-letter topic" },
  { id: "retry-topics", label: "retry topics" },
];

interface State {
  committed: number; // next offset to process on the main partition
  attempts: number; // retry attempts spent on the current poison record
  dlt: number[]; // offsets routed to the dead-letter topic
  retryTopic: number[]; // offsets routed to a retry topic
  done: boolean;
  log: string[];
}

function initial(): State {
  return { committed: 0, attempts: 0, dlt: [], retryTopic: [], done: false, log: ["consumer subscribed to orders-0. Nothing processed yet."] };
}

export default function PoisonMessageDemo() {
  const [strategy, setStrategy] = useState<Strategy>("none");
  const [s, setS] = useState<State>(initial());

  function push(state: State, line: string): string[] {
    return [line, ...state.log].slice(0, 7);
  }

  function selectStrategy(id: Strategy) {
    setStrategy(id);
    setS(initial());
  }

  function step() {
    setS((prev) => {
      if (prev.done) return prev;
      const offset = prev.committed;

      if (offset >= RECORDS.length) {
        return { ...prev, done: true, log: push(prev, "reached the end of the partition — all records accounted for.") };
      }

      // A healthy record: process and advance.
      if (offset !== POISON_OFFSET) {
        return {
          ...prev,
          committed: offset + 1,
          attempts: 0,
          log: push(prev, `processed record ${offset}, committed offset ${offset + 1}.`),
        };
      }

      // The poison record.
      if (strategy === "none") {
        return {
          ...prev,
          attempts: prev.attempts + 1,
          log: push(
            prev,
            `record ${offset} threw (attempt ${prev.attempts + 1}). The error handler seeks back to offset ${offset} and commits nothing, so the next poll() redelivers the same record. Records 3–5 stay blocked behind it; lag only grows.`,
          ),
        };
      }

      if (prev.attempts < MAX_RETRIES) {
        return {
          ...prev,
          attempts: prev.attempts + 1,
          log: push(prev, `record ${offset} failed — in-place retry ${prev.attempts + 1} of ${MAX_RETRIES}.`),
        };
      }

      if (strategy === "dlt") {
        return {
          ...prev,
          committed: offset + 1,
          attempts: 0,
          dlt: [...prev.dlt, offset],
          log: push(
            prev,
            `record ${offset} exhausted ${MAX_RETRIES} retries — produced to orders.DLT with failure metadata, committed offset ${offset + 1}. Head-of-line blocking cleared.`,
          ),
        };
      }

      // retry-topics
      return {
        ...prev,
        committed: offset + 1,
        attempts: 0,
        retryTopic: [...prev.retryTopic, offset],
        log: push(
          prev,
          `record ${offset} exhausted in-place retries — forwarded to orders.retry.5s, committed offset ${offset + 1} on the main partition. A separate consumer retries it after a delay, escalating to orders.retry.30s then orders.DLT if it keeps failing.`,
        ),
      };
    });
  }

  function reset() {
    setS(initial());
  }

  const blocked = strategy === "none" && s.attempts > 0;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · poison messages and dead-letter topics
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real retry/DLT handling is library code (Spring Kafka, a custom wrapper) and a
        retry-topic chain runs its own consumers. All three strategies here assume a seek-back error handler: the
        raw consumer doesn&apos;t redeliver a failed record on its own (poll() has already advanced its in-memory
        position), so getting the record back takes a seek(), a rebalance, or a restart. &quot;Unbounded retry&quot;
        is the common default — Spring Kafka&apos;s original behavior — where the handler seeks back on every failure
        with no attempt limit and no place to send the record. What carries over: never advance the committed offset
        past a record until it is either processed or deliberately routed somewhere durable, and bound in-place
        retries so one bad record can&apos;t block the whole partition forever.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STRATEGIES.map((opt) => (
          <button
            key={opt.id}
            onClick={() => selectStrategy(opt.id)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              strategy === opt.id
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={step}
          disabled={s.done}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          poll + process next →
        </button>
        {blocked && <Badge tone="danger">partition stuck on offset {POISON_OFFSET}</Badge>}
        {s.done && <Badge tone="success">partition drained</Badge>}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="main-partition">
        {RECORDS.map((offset) => {
          const consumed = offset < s.committed;
          const isPoison = offset === POISON_OFFSET;
          return (
            <div
              key={offset}
              className={`flex h-8 w-8 items-center justify-center rounded border font-mono text-[10px] ${
                consumed
                  ? "border-border-soft bg-bg-inset text-text-faint"
                  : isPoison
                    ? "border-danger/50 bg-danger-soft text-danger"
                    : "border-stream/50 bg-stream-soft text-stream"
              }`}
            >
              {offset}
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div data-testid="dlt" className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] text-text-muted">
          orders.DLT: {s.dlt.length === 0 ? "(empty)" : s.dlt.map((o) => `record ${o}`).join(", ")}
        </div>
        <div data-testid="retry-topic" className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] text-text-muted">
          orders.retry.5s: {s.retryTopic.length === 0 ? "(empty)" : s.retryTopic.map((o) => `record ${o}`).join(", ")}
        </div>
      </div>

      <div
        data-testid="poison-log"
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
      >
        {s.log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
