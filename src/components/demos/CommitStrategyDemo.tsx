"use client";

import { useState } from "react";

const TOTAL = 10;
const BATCH = 2;
// Real default is 5000ms; kept the same here. Auto-commit is driven by this interval, not
// by a batch count — with fast polls it can fall several batches behind, with slow polls it
// fires almost every poll.
const AUTO_COMMIT_INTERVAL_MS = 5000;

const PROCESSING_OPTIONS = [1000, 2000, 6000] as const;

type Mode = "auto" | "manual";

interface S {
  read: number; // in-memory position: offset of the next record poll() will return
  committed: number; // durable bookmark in __consumer_offsets
  clockMs: number; // wall time since the loop started
  lastCommitMs: number; // when auto-commit last ran
  polls: number;
  log: string[];
}

function initial(): S {
  return { read: 0, committed: 0, clockMs: 0, lastCommitMs: 0, polls: 0, log: ["subscribed — nothing polled yet."] };
}

export default function CommitStrategyDemo() {
  const [mode, setMode] = useState<Mode>("auto");
  const [processingMs, setProcessingMs] = useState<number>(2000);
  const [s, setS] = useState<S>(initial());

  function push(state: S, line: string): string[] {
    return [line, ...state.log].slice(0, 6);
  }

  function selectMode(m: Mode) {
    setMode(m);
    setS(initial());
  }

  function poll() {
    setS((prev) => {
      const atEnd = prev.read >= TOTAL;
      // Manual mode is finished once the partition is drained (commitSync handles the rest).
      // Auto mode still needs the empty poll() calls that let auto-commit catch up to the
      // final position.
      if (atEnd && (mode !== "auto" || prev.committed >= prev.read)) return prev;

      const t0 = prev.clockMs;
      const from = prev.read;
      const to = Math.min(prev.read + BATCH, TOTAL);
      const nextPolls = prev.polls + 1;

      // Auto-commit runs inside poll(): if the interval has elapsed, it commits the current
      // position — everything returned by earlier polls, assumed processed by now.
      let committed = prev.committed;
      let lastCommitMs = prev.lastCommitMs;
      let committedLine = "";
      if (mode === "auto" && from > 0 && t0 - lastCommitMs >= AUTO_COMMIT_INTERVAL_MS && committed < from) {
        committed = from;
        lastCommitMs = t0;
        committedLine = ` auto-commit fired at ${t0}ms — committed offset advanced to ${from} (records up to ${from - 1} assumed processed).`;
      }

      const returnedLine = atEnd
        ? `poll ${nextPolls} at ${t0}ms: no new records — end of partition.`
        : `poll ${nextPolls} at ${t0}ms: returned records ${from}–${to - 1}.`;
      const trailing =
        mode === "auto"
          ? committedLine || ` No auto-commit this poll — only ${t0 - prev.lastCommitMs}ms since the last one (interval is ${AUTO_COMMIT_INTERVAL_MS}ms).`
          : ` Committed offset stays at ${committed} until you call commitSync().`;

      return {
        read: atEnd ? prev.read : to,
        committed,
        clockMs: t0 + processingMs,
        lastCommitMs,
        polls: nextPolls,
        log: push(prev, returnedLine + trailing),
      };
    });
  }

  function commitSync() {
    setS((prev) => {
      if (mode !== "manual" || prev.committed === prev.read) return prev;
      return {
        ...prev,
        committed: prev.read,
        log: push(prev, `commitSync(): committed offset ${prev.committed} → ${prev.read}, right after processing records ${prev.committed}–${prev.read - 1}.`),
      };
    });
  }

  function reset() {
    setS(initial());
  }

  const redelivered = s.read - s.committed;

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
        Simplified for teaching — a real batch is up to max.poll.records and processing time varies per record. What
        carries over: auto-commit fires on the auto.commit.interval.ms clock, not per batch, so it can trail the read
        position by several polls when polls are fast and catch up to one batch when they are slow — and the final
        position only commits on a later poll() (keep clicking poll() past the end of the partition to see it land).
        A manual commitSync() after processing advances the offset exactly when the work is done. The gap between the
        read position and the committed offset is what a new owner would be handed again after a crash — mostly
        records that were already processed (duplicates), plus any near the boundary that weren&apos;t.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(["auto", "manual"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => selectMode(m)}
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
        {mode === "auto" && (
          <div className="flex flex-wrap gap-2">
            {PROCESSING_OPTIONS.map((ms) => (
              <button
                key={ms}
                onClick={() => {
                  setProcessingMs(ms);
                  setS(initial());
                }}
                className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                  processingMs === ms
                    ? "border-stream/50 bg-stream-soft text-stream"
                    : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
                }`}
              >
                {ms}ms/poll
              </button>
            ))}
          </div>
        )}
        <button
          onClick={poll}
          disabled={s.read >= TOTAL && (mode === "manual" || s.committed >= s.read)}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          poll() →
        </button>
        {mode === "manual" && (
          <button
            onClick={commitSync}
            disabled={s.committed === s.read}
            className="rounded border border-success/50 bg-success-soft px-3 py-1.5 font-mono text-[11px] text-success hover:border-success disabled:cursor-default disabled:opacity-40"
          >
            commitSync() →
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">read position</div>
          <div data-testid="read-position" className="font-mono text-lg text-text">{s.read}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">committed offset</div>
          <div data-testid="committed-position" className="font-mono text-lg text-text">{s.committed}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">redelivered on crash now</div>
          <div data-testid="redelivered-gap" className="font-mono text-lg text-text">
            {redelivered} record{redelivered === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {mode === "auto" && (
        <div data-testid="clock" className="mb-4 font-mono text-[11px] text-text-faint">
          loop clock: {s.clockMs}ms · last auto-commit: {s.lastCommitMs === 0 ? "never" : `${s.lastCommitMs}ms`} · interval: {AUTO_COMMIT_INTERVAL_MS}ms
        </div>
      )}

      <div
        data-testid="commit-log"
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
