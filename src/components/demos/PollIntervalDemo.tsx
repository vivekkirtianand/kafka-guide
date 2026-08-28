"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// max.poll.interval.ms is 300000 in real Kafka; scaled to 1000ms here so the trade-off
// against batch processing time is visible in a single view.
const BASE_INTERVAL_MS = 1000;
const RAISED_INTERVAL_MS = 5000;

const RECORD_OPTIONS = [2, 5, 10] as const;
const PER_RECORD_OPTIONS = [50, 150, 400] as const;

export default function PollIntervalDemo() {
  const [maxPollRecords, setMaxPollRecords] = useState<number>(5);
  const [perRecordMs, setPerRecordMs] = useState<number>(150);
  const [raisedInterval, setRaisedInterval] = useState(false);

  const intervalMs = raisedInterval ? RAISED_INTERVAL_MS : BASE_INTERVAL_MS;
  const batchMs = maxPollRecords * perRecordMs;
  const exceeds = batchMs > intervalMs;

  function reset() {
    setMaxPollRecords(5);
    setPerRecordMs(150);
    setRaisedInterval(false);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · processing vs. max.poll.interval.ms
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real max.poll.interval.ms is 300000ms and real processing time varies per record.
        What carries over: one poll() must process its whole batch and call poll() again within max.poll.interval.ms,
        or the consumer proactively leaves the group. max.poll.records is the main lever for keeping a batch under
        that budget; raising the interval is the other option when the work genuinely takes longer.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {RECORD_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setMaxPollRecords(n)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                maxPollRecords === n
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              max.poll.records={n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {PER_RECORD_OPTIONS.map((ms) => (
            <button
              key={ms}
              onClick={() => setPerRecordMs(ms)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                perRecordMs === ms
                  ? "border-stream/50 bg-stream-soft text-stream"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
              }`}
            >
              {ms}ms/record
            </button>
          ))}
        </div>
        <button
          onClick={() => setRaisedInterval((v) => !v)}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            raisedInterval
              ? "border-success/50 bg-success-soft text-success"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-success/40"
          }`}
        >
          {raisedInterval ? `max.poll.interval.ms=${RAISED_INTERVAL_MS} ✓` : `raise max.poll.interval.ms to ${RAISED_INTERVAL_MS}`}
        </button>
      </div>

      <div className="mb-3">
        <Badge tone={exceeds ? "danger" : "success"}>
          {exceeds ? "consumer rebalanced out" : "poll loop healthy"}
        </Badge>
      </div>

      <div data-testid="batch-time" className="mb-3 font-mono text-[11px] text-text-faint">
        batch = {maxPollRecords} records × {perRecordMs}ms = {batchMs}ms · budget = {intervalMs}ms max.poll.interval.ms
      </div>

      <div
        data-testid="poll-outcome"
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text"
      >
        {exceeds
          ? `Processing one batch takes ${batchMs}ms, longer than the ${intervalMs}ms budget. The consumer can't call poll() again in time, so it leaves the group; its partitions are rebalanced away, and the delayed commitSync() throws CommitFailedException. The next batch starts the same cycle — a rebalance loop.`
          : `Processing one batch takes ${batchMs}ms, within the ${intervalMs}ms budget. poll() is called again on time, heartbeats stay implicit-in-the-loop honest, and no rebalance is triggered.`}
      </div>
    </div>
  );
}
