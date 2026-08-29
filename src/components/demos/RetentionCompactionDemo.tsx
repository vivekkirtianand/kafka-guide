"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Policy = "delete" | "compact";

interface Entry {
  offset: number;
  key: string;
  value: string | null; // null = tombstone
  // The clock tick at which compaction first retained this tombstone as the latest
  // value for its key. Its delete.retention.ms window runs from here.
  heldSince?: number;
}

const KEYS = ["a", "b", "c"] as const;
const SEGMENT_SIZE = 4; // offsets per segment
const DELETE_RETENTION_TICKS = 2; // stand-in for delete.retention.ms

const INITIAL: Entry[] = [
  { offset: 0, key: "a", value: "a0" },
  { offset: 1, key: "b", value: "b1" },
  { offset: 2, key: "a", value: "a2" },
  { offset: 3, key: "c", value: "c3" },
  { offset: 4, key: "b", value: "b4" },
];

const segmentOf = (offset: number) => Math.floor(offset / SEGMENT_SIZE);

// What a raw consumer reading the whole partition sees — tombstones included.
function rawReplay(entries: Entry[]): string {
  if (entries.length === 0) return "(empty)";
  return entries.map((e) => `${e.key}=${e.value === null ? "∅" : e.value}`).join(", ");
}

// What you get after applying the log key by key — the latest non-null value per key.
function materialized(entries: Entry[]): string {
  const latest = new Map<string, Entry>();
  for (const e of entries) latest.set(e.key, e);
  const live = [...latest.values()].filter((e) => e.value !== null).map((e) => `${e.key}=${e.value}`);
  return live.length > 0 ? live.join(", ") : "(nothing)";
}

export default function RetentionCompactionDemo() {
  const [policy, setPolicy] = useState<Policy>("delete");
  const [entries, setEntries] = useState<Entry[]>(INITIAL);
  const [nextOffset, setNextOffset] = useState(5);
  const [key, setKey] = useState<(typeof KEYS)[number]>("a");
  const [clock, setClock] = useState(0);
  const [log, setLog] = useState<string[]>([
    "cleanup.policy=delete · 5 records across keys a, b, c",
  ]);

  const push = (line: string) => setLog((l) => [line, ...l].slice(0, 6));
  const activeSegment = segmentOf(nextOffset);

  function produce(tombstone: boolean) {
    setEntries((e) => [...e, { offset: nextOffset, key, value: tombstone ? null : `${key}${nextOffset}` }]);
    setNextOffset((n) => n + 1);
    push(
      tombstone
        ? `produced tombstone for key ${key} at offset ${nextOffset} (value = null).`
        : `produced ${key}=${key}${nextOffset} at offset ${nextOffset}.`,
    );
  }

  function switchPolicy(p: Policy) {
    setPolicy(p);
    push(`cleanup.policy=${p}.`);
  }

  function advanceTime() {
    setClock((c) => c + 1);
    push(`time advances — delete.retention.ms window is now ${clock + 1} tick(s) wide.`);
  }

  function ageOutSegment() {
    const closedSegs = [...new Set(entries.map((e) => segmentOf(e.offset)))]
      .filter((seg) => seg < activeSegment)
      .sort((a, b) => a - b);
    if (closedSegs.length === 0) {
      push(`nothing to age out — every record is still in the active segment (offsets ${activeSegment * SEGMENT_SIZE}+), which is never deleted.`);
      return;
    }
    const seg = closedSegs[0];
    const lo = seg * SEGMENT_SIZE;
    const removed = entries.filter((e) => segmentOf(e.offset) === seg);
    setEntries((e) => e.filter((x) => segmentOf(x.offset) !== seg));
    push(
      `retention elapsed for segment ${seg} (offsets ${lo}–${lo + SEGMENT_SIZE - 1}) — dropped ${removed.length} record(s) whole, regardless of key. Newer values for those keys remain.`,
    );
  }

  function compact() {
    // The cleaner only ever touches closed segments; the active segment is left alone.
    const latestByKey = new Map<string, Entry>();
    for (const e of entries) latestByKey.set(e.key, e);

    let superseded = 0;
    let tombstonesDropped = 0;
    const next: Entry[] = [];

    for (const e of entries) {
      const inActiveSegment = segmentOf(e.offset) >= activeSegment;
      if (inActiveSegment) {
        next.push(e); // untouched
        continue;
      }
      if (latestByKey.get(e.key) !== e) {
        superseded++; // an older value the cleaner collapses
        continue;
      }
      if (e.value === null) {
        const heldSince = e.heldSince ?? clock;
        if (clock - heldSince >= DELETE_RETENTION_TICKS) {
          tombstonesDropped++;
          continue;
        }
        next.push({ ...e, heldSince });
      } else {
        next.push({ ...e, heldSince: undefined });
      }
    }

    setEntries(next);
    const parts: string[] = [];
    if (superseded > 0) parts.push(`collapsed ${superseded} superseded record(s)`);
    if (tombstonesDropped > 0) parts.push(`removed ${tombstonesDropped} tombstone(s) past delete.retention.ms`);
    const held = next.filter((e) => e.value === null && e.heldSince !== undefined).length;
    if (held > 0) parts.push(`${held} tombstone(s) retained until delete.retention.ms elapses`);
    push(
      parts.length > 0
        ? `compaction pass over the closed segments — ${parts.join("; ")}.`
        : "compaction pass — nothing to collapse in the closed segments.",
    );
  }

  function reset() {
    setPolicy("delete");
    setEntries(INITIAL);
    setNextOffset(5);
    setKey("a");
    setClock(0);
    setLog(["cleanup.policy=delete · 5 records across keys a, b, c"]);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · retention vs. compaction
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — segments are a fixed {SEGMENT_SIZE} offsets wide, cleanup runs on a button, and
        delete.retention.ms is measured in clock ticks. What carries over: cleanup only touches closed segments (never
        the active one); delete drops whole segments by age or size, blind to keys; compact keeps the latest value per
        key, and a tombstone lingers for delete.retention.ms — so lagging consumers still see the delete — before it
        too is removed.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-text-faint">cleanup.policy</span>
        {(["delete", "compact"] as const).map((p) => (
          <button
            key={p}
            onClick={() => switchPolicy(p)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              policy === p
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-text-faint">key</span>
        {KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              key === k
                ? "border-stream/50 bg-stream-soft text-stream"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
            }`}
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => produce(false)}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
        >
          produce {key}=… →
        </button>
        <button
          onClick={() => produce(true)}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
        >
          produce tombstone →
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {policy === "delete" ? (
          <button
            onClick={ageOutSegment}
            className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
          >
            retention elapsed →
          </button>
        ) : (
          <>
            <button
              onClick={compact}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
            >
              run compaction →
            </button>
            <button
              onClick={advanceTime}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
            >
              time advances →
            </button>
            <span className="font-mono text-[11px] text-text-faint">
              clock {clock} · delete.retention.ms = {DELETE_RETENTION_TICKS} ticks
            </span>
          </>
        )}
      </div>

      <div data-testid="partition-log" className="mb-4 rounded-md border border-border-soft bg-bg-inset p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-sm text-text">partition-0</span>
          <span className="font-mono text-[11px] text-text-faint">
            active segment {activeSegment} · offsets {activeSegment * SEGMENT_SIZE}+
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entries.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
          {entries.map((e) => {
            const inActive = segmentOf(e.offset) >= activeSegment;
            return (
              <span
                key={e.offset}
                data-testid={`entry-${e.offset}`}
                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                  e.value === null
                    ? "border-danger/40 bg-danger-soft text-danger"
                    : inActive
                      ? "border-accent/30 bg-accent-soft text-text"
                      : "border-border-soft bg-bg-elevated text-text-muted"
                }`}
              >
                <span className="text-text-faint">{e.offset}</span>
                {e.key}={e.value === null ? "∅" : e.value}
                {e.value === null && e.heldSince !== undefined && (
                  <span className="text-text-faint">·held {Math.min(clock - e.heldSince, DELETE_RETENTION_TICKS)}/{DELETE_RETENTION_TICKS}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-md border border-border-soft bg-bg-inset p-3">
          <Badge tone="neutral">raw replay (consumer)</Badge>
          <span data-testid="raw-replay" className="font-mono text-[11px] text-text-muted">
            {rawReplay(entries)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border-soft bg-bg-inset p-3">
          <Badge tone="stream">materialized state</Badge>
          <span data-testid="materialized" className="font-mono text-[11px] text-text-muted">
            {materialized(entries)}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
