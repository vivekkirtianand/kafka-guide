"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Scenario = "bandwidth" | "request";

// producer_byte_rate quota, MB/s.
const BYTE_QUOTA = 6;
// request_percentage quota — share of one request-handler thread's time.
const REQUEST_QUOTA_PCT = 150;

function throttleMs(demand: number, quota: number): number {
  // The broker delays responses to bring the measured average back down to the quota.
  if (demand <= quota) return 0;
  return Math.round((demand / quota - 1) * 1000);
}

export default function QuotaThrottleDemo() {
  const [scenario, setScenario] = useState<Scenario>("bandwidth");
  const [produceRate, setProduceRate] = useState(4); // MB/s
  const [requestLoadPct, setRequestLoadPct] = useState(100); // % of a handler thread

  function reset() {
    setScenario("bandwidth");
    setProduceRate(4);
    setRequestLoadPct(100);
  }

  const isBandwidth = scenario === "bandwidth";
  const demand = isBandwidth ? produceRate : requestLoadPct;
  const quota = isBandwidth ? BYTE_QUOTA : REQUEST_QUOTA_PCT;
  const throttled = demand > quota;
  const delay = throttleMs(demand, quota);
  const effective = Math.min(demand, quota);

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · client quotas and throttling
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — the throttle delay is a rough function of how far over quota the client is. What
        carries over: a quota is enforced by <em>delaying the client&apos;s responses</em>, never by failing them, so
        a throttled client just looks slow; and byte-rate and request-time quotas are separate limits for two
        different kinds of heavy client.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(["bandwidth", "request"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              scenario === s
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {s === "bandwidth" ? "producer_byte_rate" : "request_percentage"}
          </button>
        ))}
      </div>

      {isBandwidth ? (
        <div className="mb-4">
          <label className="flex flex-col gap-1.5 font-mono text-[11px] text-text-faint">
            client produce rate: <span className="text-text-muted">{produceRate} MB/s</span>
            <input
              aria-label="client produce rate"
              type="range"
              min={2}
              max={20}
              value={produceRate}
              onChange={(e) => setProduceRate(Number(e.target.value))}
              className="w-full max-w-xs accent-accent"
            />
          </label>
          <div className="mt-2 font-mono text-[11px] text-text-faint">
            producer_byte_rate quota: {BYTE_QUOTA} MB/s
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <label className="flex flex-col gap-1.5 font-mono text-[11px] text-text-faint">
            request-handler time demanded: <span className="text-text-muted">{requestLoadPct}% of a thread</span>
            <input
              aria-label="request-handler time demanded"
              type="range"
              min={20}
              max={400}
              step={10}
              value={requestLoadPct}
              onChange={(e) => setRequestLoadPct(Number(e.target.value))}
              className="w-full max-w-xs accent-accent"
            />
          </label>
          <div className="mt-2 font-mono text-[11px] text-text-faint">
            request_percentage quota: {REQUEST_QUOTA_PCT}% · bytes here are negligible — this client is heavy on
            request rate, not throughput
          </div>
        </div>
      )}

      <div data-testid="outcome" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
            {isBandwidth ? "effective throughput" : "effective handler share"}
          </div>
          <div data-testid="effective" className="mt-1 font-mono text-sm text-text">
            {effective}
            {isBandwidth ? " MB/s" : "%"}
          </div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">added latency (throttle)</div>
          <div data-testid="throttle" className="mt-1 font-mono text-sm text-text">
            {delay} ms
          </div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-text-faint">errors</div>
          <div className="mt-1 font-mono text-sm text-success">none</div>
        </div>
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 text-sm leading-relaxed text-text-muted">
        <Badge tone={throttled ? "accent" : "success"}>{throttled ? "throttled" : "under quota"}</Badge>
        <p className="mt-2">
          {throttled
            ? isBandwidth
              ? `The client wants ${produceRate} MB/s but the quota is ${BYTE_QUOTA} MB/s. The broker holds each response back ~${delay} ms so the measured average settles at ${BYTE_QUOTA} MB/s. The producer's sends succeed — they just take longer. Only produce-throttle-time-avg tells you this apart from a slow cluster.`
              : `The client is asking for ${requestLoadPct}% of a request-handler thread against a ${REQUEST_QUOTA_PCT}% quota. Responses are delayed ~${delay} ms to cap its share. No request fails — a metadata storm behind a request quota looks like latency, not errors.`
            : isBandwidth
              ? `At ${produceRate} MB/s the client is under the ${BYTE_QUOTA} MB/s quota, so nothing is throttled and no latency is added.`
              : `At ${requestLoadPct}% the client is within the ${REQUEST_QUOTA_PCT}% quota — no throttling.`}
        </p>
      </div>
    </div>
  );
}
