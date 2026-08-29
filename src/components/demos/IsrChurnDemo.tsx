"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// Four brokers, replication factor 3. The IsrShrinks / IsrExpands meters
// (ReplicaManager, per broker) are incremented by the broker LEADING the affected
// partition when it drops or re-adds a replica — never by the follower that fell
// behind. So a single slow follower lights up the meters of the brokers that lead
// its partitions. To localize, you have to look at WHICH replica was removed
// (ISR membership / kafka-topics --describe), not the broker-level counters.
// The demo steps a one-minute clock and accumulates the events.

const BROKERS = [1, 2, 3, 4] as const;
const MAX_STEPS = 6;

type Scenario = "healthy" | "slow-broker" | "shared-fabric";

interface Partition {
  id: number;
  leader: number;
  followers: [number, number];
}

const TOPOLOGY: Partition[] = [
  { id: 1, leader: 1, followers: [2, 3] },
  { id: 2, leader: 2, followers: [3, 4] },
  { id: 3, leader: 3, followers: [4, 1] },
  { id: 4, leader: 4, followers: [1, 2] },
];

interface ShrinkEvent {
  partition: number;
  leader: number; // the broker whose IsrShrinks meter ticks
  removed: number; // the replica that actually fell behind
}

function stepEvents(scenario: Scenario, step: number): ShrinkEvent[] {
  const ev = (partition: number, removed: number): ShrinkEvent => {
    const p = TOPOLOGY.find((t) => t.id === partition)!;
    return { partition, leader: p.leader, removed };
  };
  if (scenario === "healthy") {
    // A single blip in the first minute — a brief GC on a follower — then quiet.
    return step === 1 ? [ev(1, 2)] : [];
  }
  if (scenario === "slow-broker") {
    // broker-3 is a slow follower of partitions 1 and 2 (both led elsewhere).
    return [ev(1, 3), ev(2, 3)];
  }
  // shared-fabric: a different replica lags each minute, all over the cluster.
  const rotations: [number, number][][] = [
    [
      [1, 2],
      [4, 1],
    ],
    [
      [2, 4],
      [3, 4],
    ],
    [
      [1, 3],
      [2, 3],
    ],
    [
      [4, 2],
      [3, 1],
    ],
  ];
  return rotations[(step - 1) % rotations.length].map(([partition, removed]) => ev(partition, removed));
}

interface State {
  step: number;
  meterByLeader: Record<number, number>; // IsrShrinks Count, per broker, as leader
  removedTally: Record<number, number>; // times this broker's replica was the one removed
  lastStepEvents: ShrinkEvent[];
  log: string[];
}

const zero = (): Record<number, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0 });

const START: State = {
  step: 0,
  meterByLeader: zero(),
  removedTally: zero(),
  lastStepEvents: [],
  log: ["partition replicas RF 3 · every ISR {leader + 2 followers} · no churn"],
};

export default function IsrChurnDemo() {
  const [scenario, setScenario] = useState<Scenario>("slow-broker");
  const [minISR, setMinISR] = useState<1 | 2>(2);
  const [s, setS] = useState<State>(START);

  function pickScenario(next: Scenario) {
    setScenario(next);
    setS(START);
  }

  function advance() {
    setS((prev) => {
      if (prev.step >= MAX_STEPS) return prev;
      const step = prev.step + 1;
      const evts = stepEvents(scenario, step);
      const meterByLeader = { ...prev.meterByLeader };
      const removedTally = { ...prev.removedTally };
      for (const e of evts) {
        meterByLeader[e.leader] += 1;
        removedTally[e.removed] += 1;
      }
      const line =
        evts.length === 0
          ? `minute ${step}: no ISR changes.`
          : `minute ${step}: ${evts
              .map(
                (e) =>
                  `partition-${e.partition} (leader broker-${e.leader}) dropped broker-${e.removed} from the ISR, then re-added it`,
              )
              .join("; ")}.`;
      return {
        step,
        meterByLeader,
        removedTally,
        lastStepEvents: evts,
        log: [line, ...prev.log].slice(0, 6),
      };
    });
  }

  function reset() {
    setScenario("slow-broker");
    setMinISR(2);
    setS(START);
  }

  const totalEvents = BROKERS.reduce((sum, b) => sum + s.meterByLeader[b], 0);
  const removedBrokers = BROKERS.filter((b) => s.removedTally[b] > 0);
  const isolated = totalEvents === 1;

  let tone: "success" | "accent" | "danger" = "success";
  let verdict: string;
  if (totalEvents === 0) {
    verdict =
      s.step === 0
        ? "Step the clock a few minutes, then read the meters against the removed-replica tally — they point at different brokers."
        : "No ISR churn. Replication is healthy.";
  } else if (isolated) {
    verdict =
      "One shrink/expand pair in the first minute, then nothing — a brief follower blip (a GC pause, a momentary network stall). A single isolated pair is not an incident; don't page on it.";
  } else if (removedBrokers.length === 1) {
    tone = "danger";
    const culprit = removedBrokers[0];
    const leaders = BROKERS.filter((b) => s.meterByLeader[b] > 0);
    verdict = `The IsrShrinks meters fire on broker${leaders.length > 1 ? "s" : ""} ${leaders.join(
      " and ",
    )} — but those are just the leaders reporting that a follower fell behind. The replica removed every single time is broker-${culprit}. That is the slow broker; the meters point at the wrong place. Check broker-${culprit}'s disk await, its inter-broker link, and its GC pauses.`;
  } else if (removedBrokers.length >= 3) {
    tone = "danger";
    verdict =
      "Both the meters and the removed-replica tally are spread across the cluster — a different replica lags each minute, and no single broker is always the one removed. That is a shared cause: a saturated network fabric, a common storage backend, or correlated GC under load — not one bad broker.";
  } else {
    tone = "accent";
    verdict = `The removed replica is broker ${removedBrokers.join(
      " and broker ",
    )} across these minutes. Check whether they share a rack, a top-of-rack switch, or a storage backend before diagnosing either one alone.`;
  }

  const atFloorWarning = minISR === 2 && s.lastStepEvents.length > 0 && !isolated;

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
        Simplified for teaching — four brokers, a fixed partition layout, a one-minute clock you step by hand, and
        every fallen-behind follower rejoins within the same minute. What carries over: the IsrShrinks / IsrExpands
        meters are incremented by the <em>leader</em> of the affected partition, not by the follower that lagged — so
        one slow broker lights up its <em>leaders&apos;</em> meters. To localize, look at which replica was removed
        from the ISR, not at which broker&apos;s meter moved.
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
            onClick={() => pickScenario(val)}
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
          IsrShrinks Count (all brokers): {totalEvents}
        </span>
      </div>

      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
        IsrShrinks Count — per broker, as partition leader
      </div>
      <div data-testid="isrc-brokers" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BROKERS.map((b) => {
          const count = s.meterByLeader[b];
          return (
            <div
              key={b}
              data-testid={`isrc-broker-${b}`}
              className={`rounded-md border p-3 ${
                count > 0 ? "border-accent/40 bg-accent-soft" : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="font-mono text-sm text-text">broker-{b}</div>
              <div className="mt-1 font-mono text-[11px] text-text-faint">Count {count}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
        Replica removed from the ISR — from partition state, not a meter
      </div>
      <div data-testid="isrc-removed" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BROKERS.map((b) => {
          const count = s.removedTally[b];
          return (
            <div
              key={b}
              data-testid={`isrc-removed-${b}`}
              className={`rounded-md border p-3 ${
                count > 0 ? "border-danger/40 bg-danger-soft" : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">broker-{b}</span>
                {count > 0 && <Badge tone="danger">lagging</Badge>}
              </div>
              <div className="mt-1 font-mono text-[11px] text-text-faint">removed {count}×</div>
            </div>
          );
        })}
      </div>

      {atFloorWarning && (
        <div
          data-testid="isrc-floor"
          className="mb-4 rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-text-muted"
        >
          <Badge tone="danger">at the floor</Badge>
          <p className="mt-2">
            With min.insync.replicas=2 and RF 3, each shrink drops that partition&apos;s ISR to exactly 2 — the floor.
            acks=all still succeeds, but a second replica falling behind on the same partition before the first rejoins
            drops the ISR to 1 and rejects the write with NOT_ENOUGH_REPLICAS. Tight min.insync.replicas turns
            replication churn into produce failures.
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
