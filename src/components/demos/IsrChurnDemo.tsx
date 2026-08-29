"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// Four brokers, replication factor 3. IsrShrinksPerSec / IsrExpandsPerSec count
// replicas leaving and rejoining the in-sync set. One isolated pair around an event
// is expected; sustained churn is not — and the tell is whether it is always the
// same replica leaving (one slow broker) or different replicas each time (a shared
// cause). The demo steps a one-minute clock and accumulates the counts.

const BROKERS = [1, 2, 3, 4] as const;
const MAX_STEPS = 6;

type Scenario = "healthy" | "slow-broker" | "shared-fabric";
type Load = "normal" | "spike";

interface ChurnEvent {
  broker: number;
  partition: number;
}

function stepEvents(scenario: Scenario, load: Load, step: number): ChurnEvent[] {
  if (scenario === "healthy") {
    if (load === "spike" && step === 1) return [{ broker: 1, partition: 1 }];
    return [];
  }
  if (scenario === "slow-broker") {
    // broker-3 follows partitions 1 and 2; under load it also falls behind on 4.
    const base = [
      { broker: 3, partition: 1 },
      { broker: 3, partition: 2 },
    ];
    return load === "spike" ? [...base, { broker: 3, partition: 4 }] : base;
  }
  // shared-fabric: a different pair of replicas each minute — no single culprit.
  const rotations: ChurnEvent[][] = [
    [
      { broker: 1, partition: 2 },
      { broker: 2, partition: 3 },
    ],
    [
      { broker: 3, partition: 4 },
      { broker: 4, partition: 1 },
    ],
    [
      { broker: 2, partition: 1 },
      { broker: 1, partition: 3 },
    ],
    [
      { broker: 4, partition: 2 },
      { broker: 3, partition: 1 },
    ],
  ];
  const evts = rotations[(step - 1) % rotations.length];
  return load === "spike" ? [...evts, { broker: (step % 4) + 1, partition: 2 }] : evts;
}

interface State {
  step: number;
  shrinks: Record<number, number>;
  expands: Record<number, number>;
  lastStepEvents: ChurnEvent[];
  log: string[];
}

const START: State = {
  step: 0,
  shrinks: { 1: 0, 2: 0, 3: 0, 4: 0 },
  expands: { 1: 0, 2: 0, 3: 0, 4: 0 },
  lastStepEvents: [],
  log: ["partition replicas RF 3 · all ISRs {leader + 2 followers} · no churn"],
};

export default function IsrChurnDemo() {
  const [scenario, setScenario] = useState<Scenario>("slow-broker");
  const [load, setLoad] = useState<Load>("normal");
  const [minISR, setMinISR] = useState<1 | 2>(2);
  const [s, setS] = useState<State>(START);

  function advance() {
    setS((prev) => {
      if (prev.step >= MAX_STEPS) return prev;
      const step = prev.step + 1;
      const evts = stepEvents(scenario, load, step);
      const shrinks = { ...prev.shrinks };
      const expands = { ...prev.expands };
      for (const e of evts) {
        shrinks[e.broker] += 1;
        expands[e.broker] += 1; // the follower catches back up within the minute
      }
      const line =
        evts.length === 0
          ? `minute ${step}: no ISR changes.`
          : `minute ${step}: ${evts.length} shrink/expand ${evts.length === 1 ? "pair" : "pairs"} — ${evts
              .map((e) => `broker-${e.broker} left partition-${e.partition}'s ISR, then rejoined`)
              .join("; ")}.`;
      return { step, shrinks, expands, lastStepEvents: evts, log: [line, ...prev.log].slice(0, 6) };
    });
  }

  function reset() {
    setScenario("slow-broker");
    setLoad("normal");
    setMinISR(2);
    setS(START);
  }

  const totalShrinks = BROKERS.reduce((sum, b) => sum + s.shrinks[b], 0);
  const churnedBrokers = BROKERS.filter((b) => s.shrinks[b] > 0);
  const isolatedPair = scenario === "healthy" && load === "spike" && totalShrinks <= 1;

  let tone: "success" | "accent" | "danger" = "success";
  let verdict: string;
  if (totalShrinks === 0) {
    verdict =
      s.step === 0
        ? "Step the clock a few minutes and watch IsrShrinksPerSec — then read whether it is one broker or several."
        : "No ISR churn across any broker. Replication is healthy.";
  } else if (isolatedPair) {
    verdict =
      "One shrink/expand pair around the load spike, then back to zero — expected. A single pair around an isolated event (a spike, a brief network blip, a restart) is not an incident.";
  } else if (churnedBrokers.length === 1) {
    tone = "danger";
    verdict = `Localized: every shrink is broker-${churnedBrokers[0]} leaving. That is one slow broker — check its disk await time, its inter-broker link, and its GC pauses. The other brokers are fine; the partitions churning just happen to keep a replica on broker-${churnedBrokers[0]}.`;
  } else if (churnedBrokers.length >= 3) {
    tone = "danger";
    verdict =
      "Not localized: a different replica drops out each minute, spread across most of the cluster. That points at a shared cause — a saturated network fabric, a common storage backend, or correlated GC under a load spike — not one bad broker.";
  } else {
    tone = "accent";
    verdict = `Churn on brokers ${churnedBrokers.join(" and ")}. Check whether they share a rack, a top-of-rack switch, or a storage backend before diagnosing either one on its own.`;
  }

  const atFloorWarning = minISR === 2 && s.lastStepEvents.length > 0 && !isolatedPair;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · localizing ISR churn
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — four brokers, a one-minute clock you step by hand, and every fallen-behind follower
        catches back up within the same minute. What carries over: an isolated shrink/expand pair is normal; sustained
        churn is not; and the diagnosis turns on whether it is always the same replica leaving (one overloaded or
        slow-disk or GC-pausing broker) or different replicas each minute (a shared network, storage, or load cause).
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["healthy", "healthy"],
            ["slow-broker", "one slow broker"],
            ["shared-fabric", "saturated fabric"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            onClick={() => {
              setScenario(val);
              setS(START);
            }}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              scenario === val
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setLoad((l) => (l === "normal" ? "spike" : "normal"));
            setS(START);
          }}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            load === "spike"
              ? "border-accent/50 bg-accent-soft text-accent"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
          }`}
        >
          load: {load}
        </button>
        <span className="font-mono text-[11px] text-text-faint">min.insync.replicas</span>
        {([1, 2] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMinISR(v)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              minISR === v
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={advance}
          disabled={s.step >= MAX_STEPS}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40"
        >
          advance 1 min →
        </button>
        <span data-testid="isrc-clock" className="font-mono text-[11px] text-text-faint">
          minute {s.step}
        </span>
        <span data-testid="isrc-total" className="font-mono text-[11px] text-text-muted">
          IsrShrinksPerSec (cumulative): {totalShrinks}
        </span>
      </div>

      <div data-testid="isrc-brokers" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BROKERS.map((b) => {
          const active = s.shrinks[b] > 0;
          return (
            <div
              key={b}
              data-testid={`isrc-broker-${b}`}
              className={`rounded-md border p-3 ${
                active ? "border-danger/40 bg-danger-soft" : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">broker-{b}</span>
                {active && <Badge tone="danger">churning</Badge>}
              </div>
              <div className="mt-1 font-mono text-[11px] text-text-faint">
                shrinks {s.shrinks[b]} · expands {s.expands[b]}
              </div>
            </div>
          );
        })}
      </div>

      {atFloorWarning && (
        <div data-testid="isrc-floor" className="mb-4 rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-text-muted">
          <Badge tone="danger">at the floor</Badge>
          <p className="mt-2">
            With min.insync.replicas=2 and RF 3, each shrink drops that partition&apos;s ISR to exactly 2 — the floor.
            acks=all still succeeds, but the next shrink on the same partition before the follower rejoins rejects the
            write with NOT_ENOUGH_REPLICAS. Tight min.insync.replicas turns replication churn into produce failures.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-md border border-border-soft bg-bg-inset p-3 text-sm leading-relaxed text-text-muted">
        <Badge tone={tone}>
          {tone === "danger" ? "sustained churn" : tone === "accent" ? "check shared infra" : "stable"}
        </Badge>
        <p data-testid="isrc-verdict" className="mt-2">
          {verdict}
        </p>
      </div>

      <div
        data-testid="isrc-log"
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
      >
        {s.log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
