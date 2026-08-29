"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// Milliseconds per phase of a broker-side produce request. TotalTimeMs is the sum;
// the interesting question in an incident is always which phase owns the total.
interface Phases {
  queue: number; // RequestQueueTimeMs — waiting for a request-handler (I/O) thread
  local: number; // LocalTimeMs — leader appends to its own log
  remote: number; // RemoteTimeMs — waiting on followers to satisfy acks=all
  respQueue: number; // ResponseQueueTimeMs
  respSend: number; // ResponseSendTimeMs
}

const BASE: Phases = { queue: 1, local: 2, remote: 0, respQueue: 0.5, respSend: 0.5 };

interface Toggles {
  acksAll: boolean;
  slowDisk: boolean;
  slowFollower: boolean;
  ioThreadStarvation: boolean;
}

const INITIAL: Toggles = {
  acksAll: true,
  slowDisk: false,
  slowFollower: false,
  ioThreadStarvation: false,
};

function phases(t: Toggles): Phases {
  const p: Phases = { ...BASE };
  if (t.acksAll) p.remote = 6;
  if (t.slowFollower && t.acksAll) p.remote += 45;
  if (t.slowDisk) p.local += 32;
  if (t.ioThreadStarvation) p.queue += 28;
  return p;
}

const PHASE_LABEL: Record<keyof Phases, string> = {
  queue: "RequestQueueTimeMs",
  local: "LocalTimeMs",
  remote: "RemoteTimeMs",
  respQueue: "ResponseQueueTimeMs",
  respSend: "ResponseSendTimeMs",
};

const PHASE_ORDER: (keyof Phases)[] = ["queue", "local", "remote", "respQueue", "respSend"];

function total(p: Phases): number {
  return PHASE_ORDER.reduce((sum, k) => sum + p[k], 0);
}

function dominant(p: Phases): keyof Phases | null {
  const t = total(p);
  let max: keyof Phases = "queue";
  for (const k of PHASE_ORDER) if (p[k] > p[max]) max = k;
  return p[max] >= t * 0.5 && p[max] >= 8 ? max : null;
}

const DIAGNOSIS: Record<keyof Phases, string> = {
  queue:
    "RequestQueueTimeMs owns the total: requests are waiting for a request-handler thread. Too few I/O threads (num.io.threads) or a broker that is simply saturated — check RequestHandlerAvgIdlePercent and the request-queue size.",
  local:
    "LocalTimeMs owns the total: time goes into the leader appending to its own log. Slow disk (rising await time / log-flush latency) or lock contention on the partition.",
  remote:
    "RemoteTimeMs owns the total: the leader is waiting on followers to acknowledge for acks=all. One slow follower — an overloaded broker, slow disk, or a saturated inter-broker link — holds up every acks=all produce it replicates.",
  respQueue: "Response queueing dominates — unusual; the network threads are backed up.",
  respSend: "Response send time dominates — unusual; suspect a slow or congested client link.",
};

export default function RequestLatencyBreakdown() {
  const [t, setT] = useState<Toggles>(INITIAL);

  const p = phases(t);
  const tot = total(p);
  const dom = dominant(p);

  function toggle(key: keyof Toggles) {
    setT((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function reset() {
    setT(INITIAL);
  }

  const rows: { key: keyof Toggles; label: string; disabled?: boolean; note?: string }[] = [
    { key: "acksAll", label: "acks=all (wait for the ISR)" },
    {
      key: "slowFollower",
      label: "one slow follower",
      disabled: !t.acksAll,
      note: t.acksAll ? undefined : "only affects RemoteTimeMs, which acks=1 skips",
    },
    { key: "slowDisk", label: "slow disk on the leader" },
    { key: "ioThreadStarvation", label: "too few I/O threads" },
  ];

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · reading the request-latency breakdown
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — a produce request only, fixed phase costs rather than a live broker, and the mean
        instead of the p99 you would actually watch. What carries over: TotalTimeMs splits into queue → local →
        remote → response-queue → response-send, and each phase points at a different cause — queue time at thread
        starvation, local time at disk, remote time at a slow follower on the acks=all path. On a fetch, RemoteTimeMs
        instead measures the long-poll wait for data and a high value is normal.
      </p>

      <div className="mb-4 flex flex-col gap-2">
        {rows.map((r) => (
          <label
            key={r.key}
            className={`flex items-center gap-2 font-mono text-[11px] ${
              r.disabled ? "text-text-faint/50" : "text-text-muted"
            }`}
          >
            <input
              type="checkbox"
              aria-label={r.label}
              checked={t[r.key]}
              disabled={r.disabled}
              onChange={() => toggle(r.key)}
              className="accent-accent"
            />
            {r.label}
            {r.note && <span className="text-text-faint">— {r.note}</span>}
          </label>
        ))}
      </div>

      <div data-testid="rlb-bar" className="mb-3 flex h-8 w-full overflow-hidden rounded border border-border-soft">
        {PHASE_ORDER.map((k) => {
          const pct = (p[k] / tot) * 100;
          if (pct < 0.5) return null;
          const shade =
            k === dom
              ? "bg-danger/60"
              : k === "queue"
                ? "bg-accent/40"
                : k === "local"
                  ? "bg-stream/40"
                  : k === "remote"
                    ? "bg-accent/25"
                    : "bg-border";
          return (
            <div
              key={k}
              className={`h-full ${shade}`}
              style={{ width: `${pct}%` }}
              title={`${PHASE_LABEL[k]} ${p[k]} ms`}
            />
          );
        })}
      </div>

      <div data-testid="rlb-phases" className="mb-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PHASE_ORDER.map((k) => (
          <div
            key={k}
            className={`flex items-center justify-between rounded-md border px-3 py-1.5 font-mono text-[11px] ${
              k === dom ? "border-danger/40 bg-danger-soft text-text" : "border-border-soft bg-bg-inset text-text-muted"
            }`}
          >
            <span>{PHASE_LABEL[k]}</span>
            <span data-testid={`rlb-phase-${k}`}>{p[k]} ms</span>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 text-sm leading-relaxed text-text-muted">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={dom ? "danger" : "success"}>
            {dom ? `${PHASE_LABEL[dom]} dominates` : "balanced and low"}
          </Badge>
          <span data-testid="rlb-total" className="font-mono text-[11px] text-text-faint">
            TotalTimeMs {tot} ms
          </span>
        </div>
        <p data-testid="rlb-diagnosis">
          {dom
            ? DIAGNOSIS[dom]
            : "No single phase owns the total and it is low — nothing here is the bottleneck. A latency incident with a breakdown like this is upstream or downstream of the broker, not inside it."}
        </p>
      </div>
    </div>
  );
}
