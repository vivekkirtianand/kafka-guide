"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

const PARTITION_COUNT = 3;
// consumer group assignment (range-style): partitions don't split evenly across 2 consumers
const CONSUMER_ASSIGNMENT: Record<number, string> = {
  0: "consumer-A",
  1: "consumer-A",
  2: "consumer-B",
};

interface LogEntry {
  offset: number;
  key: string;
}

// Simplified stand-in for Kafka's real default partitioner, which hashes the key with
// murmur2 (not a character sum) and, for unkeyed records, uses sticky batching rather than
// per-record round-robin. What this demo preserves faithfully: the same key always maps to
// the same partition, and unkeyed records spread across partitions.
function hashPartition(key: string, partitions: number): number {
  let hash = 0;
  for (const ch of key) hash += ch.charCodeAt(0);
  return hash % partitions;
}

export default function RecordFlowDemo() {
  const [key, setKey] = useState("user-42");
  const [guess, setGuess] = useState<number | null>(null);
  const [partitions, setPartitions] = useState<LogEntry[][]>([[], [], []]);
  const [roundRobin, setRoundRobin] = useState(0);
  const [lastResult, setLastResult] = useState<{ partition: number; correct: boolean | null; key: string } | null>(
    null,
  );
  const [log, setLog] = useState<string[]>(["waiting to produce a record."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function send() {
    const usesKey = key.trim().length > 0;
    const target = usesKey ? hashPartition(key.trim(), PARTITION_COUNT) : roundRobin % PARTITION_COUNT;

    setPartitions((current) =>
      current.map((p, i) => (i === target ? [...p, { offset: p.length, key: usesKey ? key.trim() : "(none)" }] : p)),
    );

    if (!usesKey) setRoundRobin((r) => r + 1);

    const correct = guess === null ? null : guess === target;
    setLastResult({ partition: target, correct, key: usesKey ? key.trim() : "(none)" });

    const consumer = CONSUMER_ASSIGNMENT[target];
    pushLog(
      `record${usesKey ? ` (key=${key.trim()})` : " (no key, spread across partitions)"} → partition-${target}, replicated to followers, ${consumer} polls it at offset ${partitions[target].length}.`,
    );

    setGuess(null);
  }

  function reset() {
    setKey("user-42");
    setGuess(null);
    setPartitions([[], [], []]);
    setRoundRobin(0);
    setLastResult(null);
    setLog(["waiting to produce a record."]);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · producer → partition → consumer
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real Kafka hashes keys with murmur2 and spreads unkeyed records using sticky
        batching, not the character-sum hash and per-record cycling used here. What carries over: the same key
        always lands on the same partition, and unkeyed records spread across partitions.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-text-faint">record key (blank = spread across partitions)</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. user-42"
            className="rounded border border-border-soft bg-bg-inset px-2 py-1 font-mono text-sm text-text outline-none focus:border-accent/50"
          />
        </label>
      </div>

      <div className="mb-2 font-mono text-[11px] text-text-faint">
        predict which partition this record will land in, then produce it
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[0, 1, 2].map((p) => (
          <button
            key={p}
            onClick={() => setGuess(p)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              guess === p
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            partition-{p}
          </button>
        ))}
        <button
          onClick={send}
          className="w-full rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream sm:ml-auto sm:w-auto"
        >
          produce record →
        </button>
      </div>

      {lastResult && lastResult.correct !== null && (
        <div className="mb-4">
          <Badge tone={lastResult.correct ? "success" : "danger"}>
            {lastResult.correct ? "prediction correct" : "prediction missed"}
          </Badge>
          <span className="ml-2 font-mono text-[11px] text-text-faint">
            key=&quot;{lastResult.key}&quot; hashed to partition-{lastResult.partition}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {partitions.map((entries, i) => (
          <div key={i} data-testid={`partition-column-${i}`} className="rounded-md border border-border-soft bg-bg-inset p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm text-text">partition-{i}</span>
              <span className="font-mono text-[10px] text-text-faint">{CONSUMER_ASSIGNMENT[i]}</span>
            </div>
            <div className="flex min-h-[3rem] flex-col gap-1">
              {entries.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
              {entries.map((e) => (
                <div key={e.offset} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
                  offset {e.offset} · {e.key}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
