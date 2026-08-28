"use client";

import { useState } from "react";

const LOG_END = 12; // log-end offset: 12 records, offsets 0–11
const INITIAL_COMMITTED = 8;

// Historical fact: which records this group has actually consumed at least once. A reset
// moves the bookmark but never changes this, so a record consumed before a backward reset
// is a *replay*, not a first delivery.
function initialConsumed(): boolean[] {
  return Array.from({ length: LOG_END }, (_, i) => i < INITIAL_COMMITTED);
}

type OffsetStatus = "consumed" | "skipped" | "replay" | "pending";

function statusOf(offset: number, committed: number, everConsumed: boolean[]): OffsetStatus {
  if (offset < committed) return everConsumed[offset] ? "consumed" : "skipped";
  return everConsumed[offset] ? "replay" : "pending";
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
  const [everConsumed] = useState<boolean[]>(initialConsumed);
  const [log, setLog] = useState<string[]>([
    `committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`,
  ]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function countConsumed(lo: number, hi: number) {
    let n = 0;
    for (let i = lo; i < hi; i++) if (everConsumed[i]) n++;
    return n;
  }

  function doReset(label: string, reset: Reset) {
    const from = committed;
    const to = target(from, reset);
    setCommitted(to);

    if (to < from) {
      const replayed = countConsumed(to, from);
      const fresh = from - to - replayed;
      pushLog(
        `${label}: committed offset ${from} → ${to}. Records ${to}–${from - 1} will be redelivered on the next poll — ${replayed} already consumed (a replay), ${fresh} not yet seen.`,
      );
    } else if (to > from) {
      const alreadyConsumed = countConsumed(from, to);
      const skipped = to - from - alreadyConsumed;
      pushLog(
        `${label}: committed offset ${from} → ${to}. The group jumps past records ${from}–${to - 1} — ${skipped} never consumed (skipped), ${alreadyConsumed} already consumed. Another reset can move the bookmark back over them.`,
      );
    } else {
      pushLog(`${label}: committed offset unchanged at ${to}.`);
    }
  }

  function reset() {
    setCommitted(INITIAL_COMMITTED);
    setLog([`committed offset is ${INITIAL_COMMITTED} of ${LOG_END} — the group has consumed records 0–${INITIAL_COMMITTED - 1}.`]);
  }

  const statuses = Array.from({ length: LOG_END }, (_, i) => statusOf(i, committed, everConsumed));
  const replayCount = statuses.filter((s) => s === "replay").length;
  const pendingCount = statuses.filter((s) => s === "pending").length;
  const skippedCount = statuses.filter((s) => s === "skipped").length;

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
        is stopped here. What carries over: a reset only moves the committed offset. Moving it back replays records
        (Kafka redelivers them whether or not this group saw them before); moving it forward makes the group skip
        them on the next poll — but another reset can always move the bookmark back to pick them up again.
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
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-stream/50 bg-stream-soft align-middle" />pending (new)</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-accent/60 bg-accent-soft align-middle" />replay</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-dashed border-danger/60 bg-danger-soft align-middle" />skipped</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" data-testid="partition-view">
        {statuses.map((st, offset) => (
          <div
            key={offset}
            data-status={st}
            className={`flex h-8 w-8 items-center justify-center rounded border font-mono text-[10px] ${
              st === "consumed"
                ? "border-border-soft bg-bg-inset text-text-faint"
                : st === "skipped"
                  ? "border-dashed border-danger/60 bg-danger-soft text-danger"
                  : st === "replay"
                    ? "border-accent/60 bg-accent-soft text-accent"
                    : "border-stream/50 bg-stream-soft text-stream"
            }`}
          >
            {offset}
          </div>
        ))}
      </div>

      <div data-testid="reset-committed" className="mb-4 font-mono text-[11px] text-text-faint">
        committed offset: {committed} / {LOG_END} · next poll delivers {replayCount + pendingCount} record
        {replayCount + pendingCount === 1 ? "" : "s"} ({replayCount} replayed, {pendingCount} new)
        {skippedCount > 0 ? ` · ${skippedCount} skipped without being consumed` : ""}
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
