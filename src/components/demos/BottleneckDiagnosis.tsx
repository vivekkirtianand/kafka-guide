"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Cause = "producer" | "broker" | "consumer" | "disk" | "network" | "downstream";

const CAUSE_LABEL: Record<Cause, string> = {
  producer: "Producer application",
  broker: "Broker (CPU / threads)",
  consumer: "Consumer application",
  disk: "Broker disk",
  network: "Network",
  downstream: "Downstream processing",
};

const CAUSES: Cause[] = ["producer", "broker", "consumer", "disk", "network", "downstream"];

// The signature each cause leaves on the dashboard — shown when a guess misses, so a
// wrong answer still teaches what that cause actually looks like.
const SIGNATURE: Record<Cause, string> = {
  producer:
    "buffer-available near zero and throughput well under target while the broker acks fast and sits mostly idle",
  broker:
    "a deep request queue and request-handler threads near 0% idle, with disk await and network both clean",
  consumer:
    "rising lag with a healthy broker and a fast downstream call, and poll processing time at or past max.poll.interval.ms",
  disk: "disk await time and LocalTimeMs climbing together on one broker, often with free space getting tight",
  network: "the NIC near line rate with retransmits climbing, dragging RemoteTimeMs up with it",
  downstream:
    "rising lag with every Kafka-side signal healthy and the sink or API call latency several times its baseline",
};

interface Panel {
  label: string;
  value: string;
  elevated: boolean;
}

interface Scenario {
  brief: string;
  panels: Panel[];
  cause: Cause;
  explain: string;
}

// Nine signals, same order in every scenario. Only the values and which ones are
// flagged change.
function panels(
  p99: [string, boolean],
  buffer: [string, boolean],
  lag: [string, boolean],
  poll: [string, boolean],
  queue: [string, boolean],
  times: [string, boolean],
  disk: [string, boolean],
  net: [string, boolean],
  down: [string, boolean],
): Panel[] {
  return [
    { label: "produce p99 latency", value: p99[0], elevated: p99[1] },
    { label: "producer buffer-available / retry-rate", value: buffer[0], elevated: buffer[1] },
    { label: "consumer group lag", value: lag[0], elevated: lag[1] },
    { label: "consumer poll processing / max.poll.interval.ms", value: poll[0], elevated: poll[1] },
    { label: "broker request-queue depth / handler-idle", value: queue[0], elevated: queue[1] },
    { label: "broker LocalTimeMs / RemoteTimeMs", value: times[0], elevated: times[1] },
    { label: "broker disk await / free space", value: disk[0], elevated: disk[1] },
    { label: "network throughput vs line rate / retransmits", value: net[0], elevated: net[1] },
    { label: "downstream sink call latency", value: down[0], elevated: down[1] },
  ];
}

const N = false;
const HI = true;

const SCENARIOS: Scenario[] = [
  {
    brief: "Page: produce p99 latency breached its SLA on one broker. Nothing was deployed.",
    panels: panels(
      ["140 ms (SLA 50 ms)", HI],
      ["55% / 8 per s", HI],
      ["flat", N],
      ["180 ms / 300000 ms", N],
      ["6 / 40% idle", N],
      ["95 ms / 12 ms", HI],
      ["45 ms await / 12% free", HI],
      ["45% of line rate / 0", N],
      ["20 ms", N],
    ),
    cause: "disk",
    explain:
      "Disk await (45 ms) and LocalTimeMs (95 ms) rose together on the same broker, and free space is down to 12%. Everything else — the elevated produce p99 and the producer's retry-rate and shrinking buffer — is downstream of the leader taking too long to append. Fix the disk (or move the load off it); the producer-side numbers clear on their own.",
  },
  {
    brief: "Page: produce p99 up across the whole cluster. A replica finished backfilling after a restart an hour ago.",
    panels: panels(
      ["90 ms (SLA 50 ms)", HI],
      ["60% / 5 per s", HI],
      ["slowly rising", HI],
      ["190 ms / 300000 ms", N],
      ["4 / 55% idle", N],
      ["4 ms / 70 ms", HI],
      ["5 ms await / 58% free", N],
      ["94% of line rate / retransmits climbing", HI],
      ["20 ms", N],
    ),
    cause: "network",
    explain:
      "The NIC is at 94% of line rate with retransmits climbing. RemoteTimeMs is high because replication fetches are stuck on the wire — LocalTimeMs and disk await are both clean, so the leader itself is fine. Consumer lag drifts up because client fetches share the same saturated link. The backfilling replica is the extra load that pushed it over.",
  },
  {
    brief: "Page: produce p99 up on one broker during a traffic peak.",
    panels: panels(
      ["110 ms (SLA 50 ms)", HI],
      ["70% / 3 per s", N],
      ["flat", N],
      ["185 ms / 300000 ms", N],
      ["28 / 3% idle", HI],
      ["5 ms / 7 ms", N],
      ["4 ms await / 55% free", N],
      ["48% of line rate / 0", N],
      ["20 ms", N],
    ),
    cause: "broker",
    explain:
      "The request queue is 28 deep and request-handler threads are 3% idle, while disk await, network, and RemoteTimeMs are all normal. The broker is accepting requests faster than its I/O threads can serve them — RequestQueueTimeMs owns the produce latency. The lever is num.io.threads (and, longer term, more brokers or fewer partitions per broker).",
  },
  {
    brief: "Ticket: the pipeline isn't hitting its target throughput. No errors anywhere.",
    panels: panels(
      ["14 ms · 60k/s of 200k/s target", HI],
      ["4% / 0.2 per s", HI],
      ["flat", N],
      ["180 ms / 300000 ms", N],
      ["2 / 82% idle", N],
      ["3 ms / 6 ms", N],
      ["4 ms await / 60% free", N],
      ["31% of line rate / 0", N],
      ["20 ms", N],
    ),
    cause: "producer",
    explain:
      "The broker acks in 14 ms and sits 82% idle, disk and network have plenty of headroom, and there are no errors — the cluster is barely working. Yet buffer-available is at 4% and throughput is a third of target. The bottleneck is the producer handing records off: synchronous send().get() per record, too few producer instances, or a single-threaded caller. Batch more, or produce from more threads.",
  },
  {
    brief: "Page: consumer group lag has been climbing for 20 minutes.",
    panels: panels(
      ["12 ms (SLA 50 ms)", N],
      ["90% / 0.1 per s", N],
      ["rising fast", HI],
      ["380000 ms / 300000 ms", HI],
      ["3 / 75% idle", N],
      ["3 ms / 6 ms", N],
      ["4 ms await / 60% free", N],
      ["42% of line rate / 0", N],
      ["25 ms", N],
    ),
    cause: "consumer",
    explain:
      "Lag is climbing while the broker, network, disk, and the downstream call (25 ms) are all healthy. Poll processing time (380 s) has crossed max.poll.interval.ms (300 s), so the group rebalances every cycle and barely makes progress. This is the consumer's own loop — too much work per poll, or fewer consumers than partitions. Raise the interval, cut max.poll.records, or add consumers.",
  },
  {
    brief: "Page: consumer group lag climbing. The owning team says the consumers look fine.",
    panels: panels(
      ["12 ms (SLA 50 ms)", N],
      ["90% / 0.1 per s", N],
      ["rising", HI],
      ["280000 ms / 300000 ms", HI],
      ["3 / 76% idle", N],
      ["3 ms / 6 ms", N],
      ["4 ms await / 61% free", N],
      ["40% of line rate / 0", N],
      ["220 ms (baseline 20 ms)", HI],
    ),
    cause: "downstream",
    explain:
      "Every Kafka-side signal is healthy — broker, disk, network, produce latency all normal. The sink call is at 220 ms, more than 10x its baseline, and that call sits inside the poll loop, which is why poll processing time is high and creeping toward the interval. The consumers really are fine; their downstream dependency (a database, an API) is the bottleneck. Fix or scale that, or buffer against it.",
  },
];

export default function BottleneckDiagnosis() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Cause | null>(null);

  const sc = SCENARIOS[idx];
  const correct = picked === sc.cause;

  function pick(c: Cause) {
    if (picked) return;
    setPicked(c);
  }

  function go(next: number) {
    setIdx(next);
    setPicked(null);
  }

  function reset() {
    go(0);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · read the dashboard, name the bottleneck
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — a still snapshot of nine signals, not a live cluster, and the SLA breach is already
        marked for you. What carries over: the paging symptom (produce p99, or rising lag) is rarely the cause; you
        find the bottleneck by asking which independent signals moved <em>together</em> and which stayed flat, and by
        separating the consumer&apos;s own loop from the dependency it calls.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SCENARIOS.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              i === idx
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            dashboard {i + 1}
          </button>
        ))}
      </div>

      <div
        data-testid="bd-brief"
        className="mb-4 rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] text-text-muted"
      >
        {sc.brief}
      </div>

      <div data-testid="bd-panels" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {sc.panels.map((p) => (
          <div
            key={p.label}
            className={`rounded-md border p-3 ${
              p.elevated ? "border-danger/40 bg-danger-soft" : "border-border-soft bg-bg-inset"
            }`}
          >
            <div className="font-mono text-[10px] uppercase leading-tight tracking-wide text-text-faint">
              {p.label}
            </div>
            <div className={`mt-1 font-mono text-sm ${p.elevated ? "text-danger" : "text-text"}`}>{p.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 font-mono text-xs uppercase tracking-wide text-text-faint">Where is the bottleneck?</div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CAUSES.map((c) => {
          const isPicked = picked === c;
          const isAnswer = picked && c === sc.cause;
          return (
            <button
              key={c}
              disabled={!!picked}
              onClick={() => pick(c)}
              className={`rounded-md border px-3 py-2 text-left font-mono text-[11px] transition-colors disabled:cursor-default ${
                isAnswer
                  ? "border-success/50 bg-success-soft text-text"
                  : isPicked
                    ? "border-danger/50 bg-danger-soft text-text"
                    : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              {CAUSE_LABEL[c]}
            </button>
          );
        })}
      </div>

      {picked && (
        <div data-testid="bd-feedback" className="rounded-md border border-border-soft bg-bg-inset p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={correct ? "success" : "danger"}>{correct ? "correct" : "not the bottleneck"}</Badge>
            <span className="font-mono text-[11px] text-text-faint">
              answer: {CAUSE_LABEL[sc.cause]}
            </span>
          </div>
          {!correct && (
            <p className="mb-2 text-sm leading-relaxed text-text-muted">
              A {CAUSE_LABEL[picked].toLowerCase()} bottleneck would show {SIGNATURE[picked]} — not the pattern on this
              dashboard.
            </p>
          )}
          <p className="text-sm leading-relaxed text-text-muted">{sc.explain}</p>
        </div>
      )}
    </div>
  );
}
