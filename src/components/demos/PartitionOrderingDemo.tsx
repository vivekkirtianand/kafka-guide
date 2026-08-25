"use client";

import { useState } from "react";

interface Event {
  key: string;
  label: string;
}

const SEQUENCE: Event[] = [
  { key: "order-A", label: "A1" },
  { key: "order-B", label: "B1" },
  { key: "order-A", label: "A2" },
  { key: "order-A", label: "A3" },
  { key: "order-B", label: "B2" },
  { key: "order-B", label: "B3" },
];

const KEYS = Array.from(new Set(SEQUENCE.map((e) => e.key)));
const MAX_PARTITIONS = 4;

function hashPartition(key: string, partitions: number): number {
  let hash = 0;
  for (const ch of key) hash += ch.charCodeAt(0);
  return hash % partitions;
}

export default function PartitionOrderingDemo() {
  const [partitionCount, setPartitionCount] = useState(1);
  const [sentIndex, setSentIndex] = useState(0);

  const partitions: Event[][] = Array.from({ length: partitionCount }, () => []);
  for (let i = 0; i < sentIndex; i++) {
    const e = SEQUENCE[i];
    partitions[hashPartition(e.key, partitionCount)].push(e);
  }

  function setCount(n: number) {
    setPartitionCount(n);
    setSentIndex(0);
  }

  function sendNext() {
    setSentIndex((i) => Math.min(i + 1, SEQUENCE.length));
  }

  function reset() {
    setSentIndex(0);
  }

  const done = sentIndex >= SEQUENCE.length;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · partition count &amp; ordering
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-text-faint">partitions</span>
          {Array.from({ length: MAX_PARTITIONS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                partitionCount === n
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={sendNext}
          disabled={done}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          {done ? "all records sent" : `send next record (${SEQUENCE[sentIndex]?.label}) →`}
        </button>
      </div>

      <div
        className="grid grid-cols-1 gap-3"
        style={{ gridTemplateColumns: `repeat(${partitionCount}, minmax(0, 1fr))` }}
      >
        {partitions.map((entries, i) => (
          <div key={i} data-testid={`partition-column-${i}`} className="rounded-md border border-border-soft bg-bg-inset p-3">
            <div className="mb-2 font-mono text-sm text-text">partition-{i}</div>
            <div className="flex min-h-[3rem] flex-col gap-1">
              {entries.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
              {entries.map((e, idx) => (
                <div
                  key={idx}
                  className={`rounded px-2 py-1 font-mono text-[11px] ${
                    e.key === "order-A" ? "bg-accent-soft text-accent" : "bg-stream-soft text-stream"
                  }`}
                >
                  {e.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-4 text-sm leading-relaxed text-text-muted">
        {partitionCount === 1 ? (
          <p>
            One partition: every record lands in send order. A consumer reading partition-0 sees the exact global
            order the producer sent them in — <span className="text-text">A1, B1, A2, A3, B2, B3</span>.
          </p>
        ) : (
          <p>
            {KEYS.map((k, idx) => (
              <span key={k}>
                <span className={k === "order-A" ? "text-accent" : "text-stream"}>{k}</span> always hashes to
                partition-{hashPartition(k, partitionCount)}
                {idx < KEYS.length - 1 ? "; " : ". "}
              </span>
            ))}
            Each partition still preserves the send order for the keys that land in it, but with {partitionCount}{" "}
            partitions there&apos;s no single log a consumer can read to recover the original global order across
            keys — ordering is only guaranteed <span className="text-text">within</span> a partition.
          </p>
        )}
      </div>
    </div>
  );
}
