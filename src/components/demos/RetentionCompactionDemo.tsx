"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Policy = "delete" | "compact";

interface Entry {
  offset: number;
  key: string;
  value: string | null; // null = tombstone
  // set on a compacted tombstone that survived one pass and goes on the next
  expiring?: boolean;
}

const KEYS = ["a", "b", "c"] as const;
const SEGMENT_SIZE = 4; // offsets per segment

const INITIAL: Entry[] = [
  { offset: 0, key: "a", value: "a0" },
  { offset: 1, key: "b", value: "b1" },
  { offset: 2, key: "a", value: "a2" },
  { offset: 3, key: "c", value: "c3" },
  { offset: 4, key: "b", value: "b4" },
];

function segmentOf(offset: number): number {
  return Math.floor(offset / SEGMENT_SIZE);
}

// What a consumer reading the whole partition from the beginning would see.
function replay(entries: Entry[]): string {
  const live = entries.filter((e) => e.value !== null).map((e) => `${e.key}=${e.value}`);
  return live.length > 0 ? live.join(", ") : "(nothing)";
}

export default function RetentionCompactionDemo() {
  const [policy, setPolicy] = useState<Policy>("delete");
  const [entries, setEntries] = useState<Entry[]>(INITIAL);
  const [nextOffset, setNextOffset] = useState(5);
  const [key, setKey] = useState<(typeof KEYS)[number]>("a");
  const [log, setLog] = useState<string[]>([
    "cleanup.policy=delete · 5 records across keys a, b, c",
  ]);

  function push(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  const activeSegment = segmentOf(nextOffset);

  function produce(tombstone: boolean) {
    setEntries((e) => [
      ...e,
      { offset: nextOffset, key, value: tombstone ? null : `${key}${nextOffset}` },
    ]);
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

  function ageOutSegment() {
    // Remove the lowest closed segment that still holds records.
    const closedSegs = [...new Set(entries.map((e) => segmentOf(e.offset)))]
      .filter((seg) => seg < activeSegment)
      .sort((a, b) => a - b);
    if (closedSegs.length === 0) {
      push(
        `nothing to age out — every record is still in the active segment (offsets ${activeSegment * SEGMENT_SIZE}+), which is never deleted.`,
      );
      return;
    }
    const seg = closedSegs[0];
    const lo = seg * SEGMENT_SIZE;
    const hi = lo + SEGMENT_SIZE - 1;
    const removed = entries.filter((e) => segmentOf(e.offset) === seg);
    setEntries((e) => e.filter((x) => segmentOf(x.offset) !== seg));
    push(
      `retention elapsed for segment ${seg} (offsets ${lo}–${hi}) — dropped ${removed.length} record(s) whole, regardless of key. Newer values for those keys still remain.`,
    );
  }

  function compact() {
    // Keep only the highest-offset entry per key. Offsets are preserved (gaps appear).
    const latestByKey = new Map<string, Entry>();
    for (const e of entries) latestByKey.set(e.key, e);

    let removedTombstones = 0;
    const next: Entry[] = [];
    for (const e of entries) {
      if (latestByKey.get(e.key) !== e) continue; // superseded value
      if (e.value === null) {
        if (e.expiring) {
          removedTombstones++;
          continue; // second pass — tombstone finally dropped
        }
        next.push({ ...e, expiring: true });
      } else {
        next.push({ ...e, expiring: false });
      }
    }

    const collapsed = entries.length - next.length - removedTombstones;
    setEntries(next);
    const parts = [];
    if (collapsed > 0) parts.push(`removed ${collapsed} superseded value(s)`);
    if (removedTombstones > 0) parts.push(`dropped ${removedTombstones} expired tombstone(s)`);
    const marked = next.filter((e) => e.expiring).length;
    if (marked > 0) parts.push(`${marked} tombstone(s) kept for one more pass, then deleted`);
    push(
      parts.length > 0
        ? `compaction pass — ${parts.join("; ")}. Latest value per key survives.`
        : "compaction pass — nothing to do; already one value per key.",
    );
  }

  function reset() {
    setPolicy("delete");
    setEntries(INITIAL);
    setNextOffset(5);
    setKey("a");
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
        Simplified for teaching — segments here are a fixed {SEGMENT_SIZE} offsets wide and cleanup runs on a button
        press. What carries over: delete drops whole closed segments by age or size and never looks at keys; compact
        keeps the latest value per key indefinitely, and a tombstone (null value) is how a delete reaches consumers
        before it, too, is removed.
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
        {policy === "delete" ? (
          <button
            onClick={ageOutSegment}
            className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent sm:ml-auto"
          >
            retention elapsed →
          </button>
        ) : (
          <button
            onClick={compact}
            className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent sm:ml-auto"
          >
            run compaction →
          </button>
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
          {entries.map((e) => (
            <span
              key={e.offset}
              data-testid={`entry-${e.offset}`}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                e.value === null
                  ? "border-danger/40 bg-danger-soft text-danger"
                  : segmentOf(e.offset) < activeSegment
                    ? "border-border-soft bg-bg-elevated text-text-muted"
                    : "border-accent/30 bg-accent-soft text-text"
              }`}
            >
              <span className="text-text-faint">{e.offset}</span>
              {e.key}={e.value === null ? "∅" : e.value}
              {e.expiring && <span className="text-text-faint">·exp</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-3">
        <Badge tone="stream">full replay reads</Badge>
        <span data-testid="replay" className="font-mono text-[11px] text-text-muted">
          {replay(entries)}
        </span>
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
