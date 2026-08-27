"use client";

import { useState } from "react";

const LOG_START = 0;
const LOG_END = 12; // log-end offset: 12 records, offsets 0–11
const INITIAL_COMMITTED = 8;

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
  return Math.max(LOG_START, Math.min(LOG_END, n));
}

function applyReset(current: number, reset: Reset): number {
  switch (reset.kind) {
    case "earliest":
      return LOG_START;
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
  const [log, setLog] = useState<string[]>([
    `committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`,
  ]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function doReset(label: string, reset: Reset) {
    const from = committed;
    const to = applyReset(from, reset);
    setCommitted(to);
    const delta = to - from;
    if (delta < 0) {
      pushLog(`${label}: committed offset ${from} → ${to}. ${-delta} record${-delta === 1 ? "" : "s"} (offsets ${to}–${from - 1}) will be replayed on the next poll.`);
    } else if (delta > 0) {
      pushLog(`${label}: committed offset ${from} → ${to}. ${delta} record${delta === 1 ? "" : "s"} (offsets ${from}–${to - 1}) are skipped — never delivered to this group.`);
    } else {
      pushLog(`${label}: committed offset unchanged at ${to}.`);
    }
  }

  function reset() {
    setCommitted(INITIAL_COMMITTED);
    setLog([`committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`]);
  }

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
        is stopped here. What carries over: a reset only moves the committed offset; moving it back replays records,
        moving it forward skips them permanently for this group.
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

      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="partition-view">
        {Array.from({ length: LOG_END }).map((_, offset) => {
          const consumed = offset < committed;
          return (
            <div
              key={offset}
              className={`flex h-8 w-8 items-center justify-center rounded border font-mono text-[10px] ${
                consumed
                  ? "border-border-soft bg-bg-inset text-text-faint"
                  : "border-stream/50 bg-stream-soft text-stream"
              }`}
            >
              {offset}
            </div>
          );
        })}
      </div>

      <div data-testid="committed-offset" className="mb-4 font-mono text-[11px] text-text-faint">
        committed offset: {committed} / {LOG_END} · {LOG_END - committed} record{LOG_END - committed === 1 ? "" : "s"} pending
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
