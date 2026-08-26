"use client";

import { useState } from "react";

// A fixed sequence of record arrival times (ms), mixing two tight bursts with a couple of
// isolated stragglers — enough variety that linger.ms and batch size trade off visibly
// against each other rather than always agreeing.
const ARRIVALS = [0, 2, 4, 6, 8, 10, 50, 52, 90, 92];

const LINGER_OPTIONS = [0, 5, 20, 100] as const;
const SIZE_OPTIONS = [
  { label: "small (2 records)", value: 2 },
  { label: "default (5 records)", value: 5 },
  { label: "large (10 records)", value: 10 },
];

interface Batch {
  records: number[];
  flushTime: number;
}

// A batch flushes either when it reaches maxSize records, or when lingerMs has elapsed
// since its first record — whichever happens first. Mirrors real linger.ms/batch.size
// behavior; see the disclaimer below for what's simplified.
function computeBatches(arrivals: number[], lingerMs: number, maxSize: number): Batch[] {
  const batches: Batch[] = [];
  let current: number[] = [];
  let batchStart = 0;

  function flush(flushTime: number) {
    if (current.length > 0) {
      batches.push({ records: current, flushTime });
      current = [];
    }
  }

  for (const t of arrivals) {
    if (current.length === 0) {
      current = [t];
      batchStart = t;
      continue;
    }
    if (t - batchStart > lingerMs) {
      flush(batchStart + lingerMs);
      current = [t];
      batchStart = t;
      continue;
    }
    current.push(t);
    if (current.length >= maxSize) {
      flush(t);
    }
  }
  flush(batchStart + lingerMs);

  return batches;
}

export default function BatchingThroughputDemo() {
  const [lingerMs, setLingerMs] = useState<number>(5);
  const [maxSize, setMaxSize] = useState<number>(5);

  const batches = computeBatches(ARRIVALS, lingerMs, maxSize);
  const totalLatency = batches.reduce((sum, b) => sum + b.records.reduce((s, t) => s + (b.flushTime - t), 0), 0);
  const avgLatency = totalLatency / ARRIVALS.length;

  function reset() {
    setLingerMs(5);
    setMaxSize(5);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · batching and throughput
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real batch.size is measured in bytes, not record count, and real timing depends on
        actual production rate rather than this fixed arrival sequence. What carries over: a batch flushes when
        it&apos;s full or when linger.ms elapses since its first record, whichever happens first.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {LINGER_OPTIONS.map((ms) => (
            <button
              key={ms}
              onClick={() => setLingerMs(ms)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                lingerMs === ms
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              linger.ms={ms}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMaxSize(opt.value)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                maxSize === opt.value
                  ? "border-stream/50 bg-stream-soft text-stream"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
              }`}
            >
              batch.size: {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 font-mono text-[11px] text-text-faint">10 records arrive at these times (ms):</div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ARRIVALS.map((t) => (
          <span key={t} className="rounded bg-bg-inset px-2 py-1 font-mono text-[11px] text-text-muted">
            t={t}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2" data-testid="batch-list">
        {batches.map((b, i) => (
          <div
            key={i}
            data-testid={`batch-${i}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-soft bg-bg-inset p-3"
          >
            <div className="flex flex-wrap gap-1.5">
              {b.records.map((t) => (
                <span key={t} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
                  t={t}
                </span>
              ))}
            </div>
            <span className="font-mono text-[11px] text-text-faint">
              {b.records.length} record{b.records.length === 1 ? "" : "s"} · sent at t={b.flushTime}ms
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text">
        {batches.length} request{batches.length === 1 ? "" : "s"} sent for {ARRIVALS.length} records (vs.{" "}
        {ARRIVALS.length} requests with no batching) · average time from arrival to send: {avgLatency.toFixed(1)}ms
      </div>
    </div>
  );
}
