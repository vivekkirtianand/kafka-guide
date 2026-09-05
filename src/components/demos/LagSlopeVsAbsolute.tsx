"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// Three partitions in one consumer group, one consumer per partition. Lag is
// log-end-offset minus committed offset, per partition. The demo steps a fixed
// clock and recomputes each partition's lag from a produce rate and a fixed
// per-partition consume ceiling. Time lag is shown as a constant-rate estimate
// (lag ÷ produce rate), so the produce rate is locked once the clock starts.

const PARTITIONS: number[] = [0, 1, 2];
const STEP_SECONDS = 10;
const MAX_STEPS = 8;
const CONSUME_CAP = 120; // records/s the one consumer on a partition can clear
const RETENTION_RECORDS = 6000; // oldest unread record falls off the log past this
const TIME_LAG_SLA_SECONDS = 15;
const INITIAL_LAG: Record<number, number> = { 0: 0, 1: 0, 2: 2000 };

interface Snapshot {
  step: number;
  lag: Record<number, number>;
}

const START: Snapshot = { step: 0, lag: { ...INITIAL_LAG } };

function nextLag(lag: number, produce: number, stuck: boolean): number {
  const consume = stuck ? 0 : Math.min(produce, CONSUME_CAP);
  return Math.max(0, lag + (produce - consume) * STEP_SECONDS);
}

export default function LagSlopeVsAbsolute() {
  const [produce, setProduce] = useState(100);
  const [stuck, setStuck] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([START]);

  const now = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const started = now.step > 0;

  function advance() {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (last.step >= MAX_STEPS) return h;
      const lag: Record<number, number> = {};
      for (const p of PARTITIONS) lag[p] = nextLag(last.lag[p], produce, stuck && p === 0);
      return [...h, { step: last.step + 1, lag }];
    });
  }

  function reset() {
    setProduce(100);
    setStuck(false);
    setHistory([START]);
  }

  const totalNow = PARTITIONS.reduce((s, p) => s + now.lag[p], 0);
  const totalPrev = prev ? PARTITIONS.reduce((s, p) => s + prev.lag[p], 0) : null;

  function trend(cur: number, before: number | null): "rising" | "flat" | "falling" {
    if (before === null || cur === before) return "flat";
    return cur > before ? "rising" : "falling";
  }

  const totalTrend = trend(totalNow, totalPrev);
  const overCap = produce > CONSUME_CAP;
  const anyRunaway = PARTITIONS.some((p) => trend(now.lag[p], prev ? prev.lag[p] : null) === "rising");
  const pastRetention = PARTITIONS.filter((p) => now.lag[p] > RETENTION_RECORDS);
  const slaBreached = PARTITIONS.filter((p) => now.lag[p] / produce > TIME_LAG_SLA_SECONDS);

  let verdict: string;
  let tone: "success" | "accent" | "danger" = "success";
  if (pastRetention.length > 0) {
    tone = "danger";
    verdict = `Partition ${pastRetention.join(", ")} is past the ~${RETENTION_RECORDS}-record retention window — the oldest unread records were deleted before the consumer reached them. That data is gone for good. Consumption still resumes: auto.offset.reset moves the group to earliest or latest on its own (or throws, with none), or you reset it forward by hand — but the skipped records aren't coming back.`;
  } else if (now.step === 0) {
    if (slaBreached.length > 0) {
      tone = "accent";
      verdict = `Nothing has moved yet, but partition ${slaBreached.join(", ")} already holds a steady backlog whose oldest record is roughly ${TIME_LAG_SLA_SECONDS}s+ old at this produce rate — past the latency SLA. A flat line at a high absolute value is still a problem. Step the clock to watch the slope.`;
    } else {
      verdict = "Step the clock to watch how each partition's lag moves — the slope, not just the number.";
    }
  } else if (stuck && overCap) {
    tone = "danger";
    verdict = `Two independent problems, two different slopes. Partition 0 is stuck — it climbs at the full ${produce} records/s produce rate. Partitions 1 and 2 climb more slowly, by produce minus the ${CONSUME_CAP} records/s ceiling, because production alone outpaces consumption. Fixing the stuck consumer does nothing for the under-provisioned partitions, and vice versa — treat them separately.`;
  } else if (stuck) {
    tone = "danger";
    verdict =
      "The group total is rising, but the rise is entirely partition 0 — one consumer stuck retrying a bad record forever makes no progress there while the healthy partitions sit flat. A dashboard showing only group-total lag would still look like a slow, uniform slope. Always break lag down per partition.";
  } else if (overCap) {
    tone = "danger";
    verdict = `Every partition is climbing at the same slope — consumption can't keep pace anywhere. Each partition already has its own consumer pinned at the ${CONSUME_CAP} records/s ceiling, so adding consumers won't help: you can't split a partition. Raise per-partition throughput (faster processing, batched or async writes), or add partitions and consumers together.`;
  } else if (slaBreached.length > 0) {
    tone = "accent";
    verdict = `Lag is flat — the slope is fine — but partition ${slaBreached.join(", ")} holds a steady backlog whose oldest record is well past the ${TIME_LAG_SLA_SECONDS}s latency SLA. Flat is not automatically healthy: check the time lag and the distance to retention too.`;
  } else {
    verdict = "Consumption is keeping up on every partition and no backlog breaches the latency SLA. Lag is stable.";
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · lag slope vs. absolute value
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — three partitions, one consumer each clearing up to {CONSUME_CAP} records/s, a clock
        you step by hand, and time lag shown as a constant-rate estimate (lag ÷ produce rate) so the rate locks once
        the clock starts. &ldquo;Stuck&rdquo; models a consumer whose error handler seeks back and retries the same bad
        record forever (or crash-loops on it). An uncaught exception doesn&rsquo;t move past the record either — it
        stops the loop outright, and a naive restart lands right back on it; only catching it and letting the loop
        poll again, Module 7&rsquo;s skip policy, actually gets past it. What carries over: a rising slope pages you
        regardless of the starting value; a flat line still has to clear the latency SLA and stay inside retention;
        and a healthy-looking group total can hide one partition running away, so the per-partition breakdown is the
        one that matters.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex flex-col gap-1.5 font-mono text-[11px] text-text-faint">
          produce rate (per partition): <span className="text-text-muted">{produce} records/s</span>
          <input
            aria-label="produce rate per partition"
            type="range"
            min={40}
            max={200}
            step={20}
            value={produce}
            disabled={started}
            onChange={(e) => setProduce(Number(e.target.value))}
            className="w-full max-w-xs accent-accent disabled:opacity-40"
          />
          {started && <span className="text-text-faint">locked while the clock runs — reset to change</span>}
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
          <input
            type="checkbox"
            aria-label="partition 0 stuck retrying a bad record"
            checked={stuck}
            onChange={(e) => setStuck(e.target.checked)}
            className="accent-accent"
          />
          partition 0 stuck (unbounded retry on a bad record)
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={advance}
          disabled={now.step >= MAX_STEPS}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40"
        >
          advance {STEP_SECONDS}s →
        </button>
        <span data-testid="lag-clock" className="font-mono text-[11px] text-text-faint">
          t = {now.step * STEP_SECONDS}s
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border-soft bg-bg-inset p-3">
        <span data-testid="lag-total" className="font-mono text-[11px] text-text-muted">
          group total lag: {totalNow.toLocaleString()}
        </span>
        <Badge tone={totalTrend === "rising" ? "danger" : totalTrend === "falling" ? "success" : "neutral"}>
          {totalTrend === "rising" ? "slope ↑" : totalTrend === "falling" ? "slope ↓" : "slope flat"}
        </Badge>
        {totalTrend === "rising" && !anyRunaway && (
          <span className="font-mono text-[11px] text-text-faint">— but see per-partition below</span>
        )}
      </div>

      <div data-testid="lag-partitions" className="mb-4 flex flex-col gap-2">
        {PARTITIONS.map((p) => {
          const lag = now.lag[p];
          const t = trend(lag, prev ? prev.lag[p] : null);
          const timeLag = lag / produce;
          const past = lag > RETENTION_RECORDS;
          const sla = !past && timeLag > TIME_LAG_SLA_SECONDS;
          const width = Math.min(100, (lag / (RETENTION_RECORDS * 1.5)) * 100);
          return (
            <div
              key={p}
              data-testid={`lag-p${p}`}
              className={`rounded-md border p-3 ${
                past
                  ? "border-danger/40 bg-danger-soft"
                  : sla || t === "rising"
                    ? "border-accent/40 bg-accent-soft"
                    : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-text">partition {p}</span>
                <span className="text-text-muted">
                  lag {lag.toLocaleString()} · ~{timeLag.toFixed(1)}s old ·{" "}
                  {t === "rising" ? "climbing" : t === "falling" ? "draining" : "flat"}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-border/40">
                <div
                  className={`h-full ${past ? "bg-danger/60" : sla ? "bg-accent/50" : "bg-stream/40"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
              {past && (
                <div className="mt-1.5 font-mono text-[10px] text-danger">past retention — records deleted unread</div>
              )}
              {sla && (
                <div className="mt-1.5 font-mono text-[10px] text-accent">
                  time lag &gt; {TIME_LAG_SLA_SECONDS}s SLA (slope is flat)
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 text-sm leading-relaxed text-text-muted">
        <Badge tone={tone}>
          {tone === "danger" ? "act now" : tone === "accent" ? "not off the hook" : "stable"}
        </Badge>
        <p data-testid="lag-verdict" className="mt-2">
          {verdict}
        </p>
      </div>
    </div>
  );
}
