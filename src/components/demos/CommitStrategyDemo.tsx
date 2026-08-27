"use client";

import { useState } from "react";

const TOTAL = 8;
const BATCH = 2;

type Mode = "auto" | "manual";

export default function CommitStrategyDemo() {
  const [mode, setMode] = useState<Mode>("auto");
  const [read, setRead] = useState(0); // in-memory position: next record to return
  const [committed, setCommitted] = useState(0); // durable bookmark in __consumer_offsets
  const [polls, setPolls] = useState(0);
  const [log, setLog] = useState<string[]>(["subscribed — nothing polled yet."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function setModeAndReset(m: Mode) {
    setMode(m);
    setRead(0);
    setCommitted(0);
    setPolls(0);
    setLog([m === "auto" ? "enable.auto.commit=true — offsets commit inside poll()." : "enable.auto.commit=false — you call commitSync() yourself."]);
  }

  function poll() {
    if (read >= TOTAL) return;
    const from = read;
    const to = Math.min(read + BATCH, TOTAL);
    const nextPolls = polls + 1;

    if (mode === "auto" && polls >= 1) {
      // Auto-commit runs at the start of poll(), committing the position reached by the
      // PREVIOUS poll's records — on the assumption they were processed before this call.
      setCommitted(from);
      setRead(to);
      setPolls(nextPolls);
      pushLog(
        `poll ${nextPolls}: auto-commit first advanced the committed offset to ${from} (records ${from - BATCH}–${from - 1} assumed done), then returned records ${from}–${to - 1}.`,
      );
      return;
    }

    setRead(to);
    setPolls(nextPolls);
    if (mode === "auto") {
      pushLog(`poll ${nextPolls}: returned records ${from}–${to - 1}. Nothing to auto-commit yet — this is the first batch.`);
    } else {
      pushLog(`poll ${nextPolls}: returned records ${from}–${to - 1}. Committed offset unchanged at ${committed} until you call commitSync().`);
    }
  }

  function commitSync() {
    if (mode !== "manual" || committed === read) return;
    const prev = committed;
    setCommitted(read);
    pushLog(`commitSync(): committed offset ${prev} → ${read}, right after processing records ${prev}–${read - 1}.`);
  }

  function reset() {
    setModeAndReset(mode);
  }

  const uncommitted = read - committed;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · automatic vs. manual commits
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real auto-commit only fires once auto.commit.interval.ms has elapsed, and a real
        batch is up to max.poll.records. What carries over: auto-commit advances the bookmark on poll() timing (one
        batch behind your processing), while a manual commitSync() after processing advances it exactly when the
        work is done. The gap between the read position and the committed offset is what gets reprocessed after a
        crash.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(["auto", "manual"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setModeAndReset(m)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                mode === m
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              {m === "auto" ? "enable.auto.commit=true" : "enable.auto.commit=false"}
            </button>
          ))}
        </div>
        <button
          onClick={poll}
          disabled={read >= TOTAL}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          poll() →
        </button>
        {mode === "manual" && (
          <button
            onClick={commitSync}
            disabled={committed === read}
            className="rounded border border-success/50 bg-success-soft px-3 py-1.5 font-mono text-[11px] text-success hover:border-success disabled:cursor-default disabled:opacity-40"
          >
            commitSync() →
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">read position</div>
          <div data-testid="read-position" className="font-mono text-lg text-text">{read}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">committed offset</div>
          <div data-testid="committed-position" className="font-mono text-lg text-text">{committed}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">reprocessed on crash now</div>
          <div data-testid="uncommitted-gap" className="font-mono text-lg text-text">
            {uncommitted} record{uncommitted === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div
        data-testid="commit-log"
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
      >
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
