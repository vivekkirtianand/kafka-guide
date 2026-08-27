"use client";

import { useState } from "react";

const LOG_END = 12; // log-end offset: 12 records, offsets 0–11
const INITIAL_COMMITTED = 8;

type OffsetStatus = "consumed" | "skipped" | "pending";

function initialStatus(): OffsetStatus[] {
  return Array.from({ length: LOG_END }, (_, i) => (i < INITIAL_COMMITTED ? "consumed" : "pending"));
}

type Reset =
  | { kind: "earliest" }
  | { kind: "latest" }
  | { kind: "to-offset"; value: number }
  | { kind: "shift-by"; value: number };

const RESETS: { label: string; reset: Reset }[] = [
  { label: "--to-earliest", reset: { kind: "earliest" } },
  { label: "--to-latest", reset: { kind: "latest" } },
  { label: "--to-offset 5", reset: { kind: "to-offset", value: 5 } },
  { label: "--shift-by -3", reset: { kind: "shift-by", value: -3 } },
  { label: "--shift-by +2", reset: { kind: "shift-by", value: 2 } },
];

function clamp(n: number) {
  return Math.max(0, Math.min(LOG_END, n));
}

function target(current: number, reset: Reset): number {
  switch (reset.kind) {
    case "earliest":
      return 0;
    case "latest":
      return LOG_END;
    case "to-offset":
      return clamp(reset.value);
    case "shift-by":
      return clamp(current + reset.value);
  }
}

export default function OffsetResetDemo() {
  const [committed, setCommitted] = useState(INITIAL_COMMITTED);
  const [status, setStatus] = useState<OffsetStatus[]>(initialStatus);
  const [log, setLog] = useState<string[]>([
    `committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`,
  ]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function doReset(label: string, reset: Reset) {
    const from = committed;
    const to = target(from, reset);
    setCommitted(to);

    setStatus((prev) => {
      const next = [...prev];
      if (to > from) {
        // Jump forward: records between old and new bookmark that were never consumed are
        // skipped — but only until another reset moves the bookmark back over them.
        for (let i = from; i < to; i++) if (next[i] === "pending") next[i] = "skipped";
      } else if (to < from) {
        // Jump back: everything from the new bookmark up to the old one is re-queued for
        // delivery, whether it was previously consumed or skipped.
        for (let i = to; i < from; i++) next[i] = "pending";
      }
      return next;
    });

    if (to < from) {
      const n = from - to;
      pushLog(`${label}: committed offset ${from} → ${to}. ${n} record${n === 1 ? "" : "s"} (offsets ${to}–${from - 1}) will be redelivered on the next poll.`);
    } else if (to > from) {
      const n = to - from;
      pushLog(`${label}: committed offset ${from} → ${to}. The group jumps past ${n} record${n === 1 ? "" : "s"} (offsets ${from}–${to - 1}) — they won't be delivered unless a later reset moves the bookmark back.`);
    } else {
      pushLog(`${label}: committed offset unchanged at ${to}.`);
    }
  }

  function reset() {
    setCommitted(INITIAL_COMMITTED);
    setStatus(initialStatus());
    setLog([`committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`]);
  }

  const pending = status.filter((x) => x === "pending" || x === "skipped").length;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · resetting offsets and replaying
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — kafka-consumer-groups.sh refuses to reset offsets while any member of the group is
        active, and needs <span className="font-mono">--execute</span> to actually write the change. Assume the group
        is stopped here. What carries over: a reset only moves the committed offset. Moving it back replays records;
        moving it forward makes the group skip them on the next poll — but another reset can always move the bookmark
        back over skipped records to pick them up again.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {RESETS.map((r) => (
          <button
            key={r.label}
            onClick={() => doReset(r.label, r.reset)}
            className="rounded border border-border-soft bg-bg-inset px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-3 font-mono text-[10px] text-text-faint">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-border-soft bg-bg-inset align-middle" />consumed</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-stream/50 bg-stream-soft align-middle" />pending</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-dashed border-accent/60 bg-accent-soft align-middle" />skipped</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="partition-view">
        {status.map((st, offset) => (
          <div
            key={offset}
            data-status={st}
            className={`flex h-8 w-8 items-center justify-center rounded border font-mono text-[10px] ${
              st === "consumed"
                ? "border-border-soft bg-bg-inset text-text-faint"
                : st === "skipped"
                  ? "border-dashed border-accent/60 bg-accent-soft text-accent"
                  : "border-stream/50 bg-stream-soft text-stream"
            }`}
          >
            {offset}
          </div>
        ))}
      </div>

      <div data-testid="committed-offset" className="mb-4 font-mono text-[11px] text-text-faint">
        committed offset: {committed} / {LOG_END} · {pending} record{pending === 1 ? "" : "s"} not yet consumed by this group
      </div>

      <div
        data-testid="reset-log"
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
