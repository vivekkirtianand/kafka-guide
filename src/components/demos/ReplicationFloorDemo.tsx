"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

const BROKER_IDS = [1, 2, 3] as const;
type BrokerId = (typeof BROKER_IDS)[number];

interface State {
  alive: Record<BrokerId, boolean>;
  // The current partition leader, or null when every replica is down.
  leader: BrokerId | null;
  minISR: 1 | 2 | 3;
  log: string[];
}

const INITIAL: State = {
  alive: { 1: true, 2: true, 3: true },
  leader: 1,
  minISR: 2,
  log: ["partition-0 · replication.factor 3 · leader broker-1 · ISR {1, 2, 3}"],
};

function isr(alive: Record<BrokerId, boolean>): BrokerId[] {
  return BROKER_IDS.filter((id) => alive[id]);
}

export default function ReplicationFloorDemo() {
  const [s, setS] = useState<State>(INITIAL);

  const inSync = isr(s.alive);

  function push(line: string, prev: string[]): string[] {
    return [line, ...prev].slice(0, 6);
  }

  function toggleBroker(id: BrokerId) {
    setS((prev) => {
      const alive = { ...prev.alive, [id]: !prev.alive[id] };
      const nowAlive = alive[id];
      let leader = prev.leader;
      let line: string;

      if (!nowAlive) {
        // Broker stopped — its replica leaves the ISR.
        if (prev.leader === id) {
          const candidates = isr(alive);
          leader = candidates.length > 0 ? candidates[0] : null;
          line =
            leader !== null
              ? `broker-${id} (leader) stopped — controller elects broker-${leader} from the ISR. ISR {${isr(alive).join(", ")}}`
              : `broker-${id} stopped — no in-sync replica left, partition is offline (no leader).`;
        } else {
          line = `broker-${id} stopped — drops out of the ISR. ISR {${isr(alive).join(", ")}}`;
        }
      } else {
        // Broker restarted — catches up and rejoins the ISR, but does not reclaim leadership.
        if (leader === null) {
          leader = id;
          line = `broker-${id} restarted — it's the only replica up, so it becomes leader. ISR {${id}}`;
        } else {
          line = `broker-${id} restarted — caught up and rejoined the ISR (leadership stays with broker-${leader}). ISR {${isr(alive).join(", ")}}`;
        }
      }

      return { ...prev, alive, leader, log: push(line, prev.log) };
    });
  }

  function setMinISR(v: 1 | 2 | 3) {
    setS((prev) => ({
      ...prev,
      minISR: v,
      log: push(`min.insync.replicas set to ${v}.`, prev.log),
    }));
  }

  function produce(acks: "1" | "all") {
    setS((prev) => {
      const live = isr(prev.alive);
      if (prev.leader === null) {
        return {
          ...prev,
          log: push(`produce (acks=${acks}) → partition offline, no leader. Fails with LEADER_NOT_AVAILABLE.`, prev.log),
        };
      }
      if (acks === "1") {
        return {
          ...prev,
          log: push(
            `produce (acks=1) → leader broker-${prev.leader} wrote it and acknowledged. Not yet on the ${live.length - 1} follower(s) — a leader failure now could lose it.`,
            prev.log,
          ),
        };
      }
      if (live.length >= prev.minISR) {
        return {
          ...prev,
          log: push(
            `produce (acks=all) → replicated to all ${live.length} in-sync replica(s) {${live.join(", ")}}, then acknowledged. Durable.`,
            prev.log,
          ),
        };
      }
      return {
        ...prev,
        log: push(
          `produce (acks=all) → ISR is {${live.join(", ")}} (${live.length}), below min.insync.replicas=${prev.minISR}. Rejected with NOT_ENOUGH_REPLICAS before the write is attempted.`,
          prev.log,
        ),
      };
    });
  }

  function reset() {
    setS(INITIAL);
  }

  const acksAllOk = s.leader !== null && inSync.length >= s.minISR;
  const tolerance = inSync.length - s.minISR;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · replication factor and min.insync.replicas
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — one partition, replication factor 3, and a follower rejoins the ISR the instant its
        broker restarts. What carries over: acks=all waits for the whole current ISR, min.insync.replicas is the floor
        below which the write is refused, and a restarted broker rejoins the ISR without taking leadership back.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] text-text-faint">min.insync.replicas</span>
        {([1, 2, 3] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMinISR(v)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              s.minISR === v
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div data-testid="brokers" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {BROKER_IDS.map((id) => {
          const alive = s.alive[id];
          return (
            <div
              key={id}
              data-testid={`broker-${id}`}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                alive ? "border-border-soft bg-bg-inset" : "border-danger/40 bg-danger-soft"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">broker-{id}</span>
                {s.leader === id ? (
                  <Badge tone="accent">leader</Badge>
                ) : alive ? (
                  <Badge tone="stream">follower</Badge>
                ) : (
                  <Badge tone="danger">down</Badge>
                )}
              </div>
              <div className="font-mono text-[11px] text-text-faint">
                {alive ? "in ISR" : "out of ISR"}
              </div>
              <button
                onClick={() => toggleBroker(id)}
                className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                  alive
                    ? "border-border text-text-muted hover:border-danger/50 hover:text-danger"
                    : "border-border text-text-muted hover:border-success/50 hover:text-success"
                }`}
              >
                {alive ? "stop broker" : "start broker"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border-soft bg-bg-inset p-3">
        <span data-testid="isr-summary" className="font-mono text-[11px] text-text-muted">
          ISR {`{${inSync.join(", ")}}`} · leader {s.leader === null ? "none" : `broker-${s.leader}`}
        </span>
        <Badge tone={acksAllOk ? "success" : "danger"}>
          {acksAllOk
            ? tolerance > 0
              ? `acks=all OK · ${tolerance} more loss tolerated`
              : "acks=all OK · no headroom"
            : "acks=all failing"}
        </Badge>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <button
          onClick={() => produce("all")}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
        >
          produce (acks=all) →
        </button>
        <button
          onClick={() => produce("1")}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          produce (acks=1) →
        </button>
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {s.log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
