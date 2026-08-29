"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

const BROKER_IDS = [1, 2, 3] as const;
type BrokerId = (typeof BROKER_IDS)[number];

// "catching-up" = the broker is back but still replicating the backlog, so it is
// not in the ISR yet.
type BrokerState = "in-sync" | "catching-up" | "down";

interface State {
  broker: Record<BrokerId, BrokerState>;
  leader: BrokerId | null;
  minISR: 1 | 2 | 3;
  log: string[];
}

const INITIAL: State = {
  broker: { 1: "in-sync", 2: "in-sync", 3: "in-sync" },
  leader: 1,
  minISR: 2,
  log: ["partition-0 · replication.factor 3 · leader broker-1 · ISR {1, 2, 3}"],
};

const isr = (b: Record<BrokerId, BrokerState>): BrokerId[] =>
  BROKER_IDS.filter((id) => b[id] === "in-sync");

export default function ReplicationFloorDemo() {
  const [s, setS] = useState<State>(INITIAL);

  const inSync = isr(s.broker);
  const push = (line: string, prev: string[]) => [line, ...prev].slice(0, 6);

  function stopBroker(id: BrokerId) {
    setS((prev) => {
      const broker = { ...prev.broker, [id]: "down" as BrokerState };
      let leader = prev.leader;
      let line: string;
      if (prev.leader === id) {
        const candidates = isr(broker);
        leader = candidates.length > 0 ? candidates[0] : null;
        line =
          leader !== null
            ? `broker-${id} (leader) stopped — controller elects broker-${leader} from the ISR {${isr(broker).join(", ")}}.`
            : `broker-${id} stopped — no in-sync replica left, partition is offline.`;
      } else {
        line = `broker-${id} stopped — drops out of the ISR {${isr(broker).join(", ")}}.`;
      }
      return { ...prev, broker, leader, log: push(line, prev.log) };
    });
  }

  function startBroker(id: BrokerId) {
    setS((prev) => {
      const broker = { ...prev.broker, [id]: "catching-up" as BrokerState };
      // Leadership is never handed to a replica that is still catching up.
      const line =
        prev.leader === null
          ? `broker-${id} restarted — recovering its own log. The partition stays offline until a replica has caught up enough to lead.`
          : `broker-${id} restarted — replicating the backlog from broker-${prev.leader}. Not in the ISR yet.`;
      return { ...prev, broker, log: push(line, prev.log) };
    });
  }

  function catchUp(id: BrokerId) {
    setS((prev) => {
      if (prev.broker[id] !== "catching-up") return prev;
      const broker = { ...prev.broker, [id]: "in-sync" as BrokerState };
      // The first replica back after a full outage becomes leader only now that it's in sync.
      if (prev.leader === null) {
        return {
          ...prev,
          broker,
          leader: id,
          log: push(`broker-${id} caught up and took leadership — the partition is back online. ISR {${id}}`, prev.log),
        };
      }
      return {
        ...prev,
        broker,
        log: push(
          `broker-${id} caught up — rejoined the ISR {${isr(broker).join(", ")}}. Leadership stays with broker-${prev.leader}.`,
          prev.log,
        ),
      };
    });
  }

  function setMinISR(v: 1 | 2 | 3) {
    setS((prev) => ({ ...prev, minISR: v, log: push(`min.insync.replicas set to ${v}.`, prev.log) }));
  }

  function produce(acks: "1" | "all") {
    setS((prev) => {
      const live = isr(prev.broker);
      if (prev.leader === null) {
        return { ...prev, log: push(`produce (acks=${acks}) → partition offline, no leader. Fails with LEADER_NOT_AVAILABLE.`, prev.log) };
      }
      if (acks === "1") {
        return {
          ...prev,
          log: push(
            `produce (acks=1) → leader broker-${prev.leader} acknowledged without waiting for followers. They may or may not have it yet — a leader failure now could lose it.`,
            prev.log,
          ),
        };
      }
      if (live.length < prev.minISR) {
        return {
          ...prev,
          log: push(
            `produce (acks=all) → ISR is {${live.join(", ")}} (${live.length}), below min.insync.replicas=${prev.minISR}. Rejected with NOT_ENOUGH_REPLICAS before the write is attempted.`,
            prev.log,
          ),
        };
      }
      if (live.length === 1) {
        return {
          ...prev,
          log: push(
            `produce (acks=all) → the ISR is only the leader (broker-${prev.leader}). That meets min.insync.replicas=${prev.minISR}, so acks=all is satisfied — but by a single copy a broker failure would lose.`,
            prev.log,
          ),
        };
      }
      return {
        ...prev,
        log: push(
          `produce (acks=all) → replicated to all ${live.length} in-sync replicas {${live.join(", ")}} and acknowledged — durable across a broker failure.`,
          prev.log,
        ),
      };
    });
  }

  function reset() {
    setS(INITIAL);
  }

  const online = s.leader !== null;
  const acksAllOk = online && inSync.length >= s.minISR;
  const tolerance = inSync.length - s.minISR;

  let badgeTone: "success" | "danger" | "accent" = "danger";
  let badgeLabel = online ? "acks=all failing" : "partition offline";
  if (acksAllOk) {
    if (inSync.length === 1) {
      badgeTone = "accent";
      badgeLabel = "acks=all OK · single copy";
    } else if (tolerance > 0) {
      badgeTone = "success";
      badgeLabel = `acks=all OK · ${tolerance} more loss tolerated`;
    } else {
      badgeTone = "accent";
      badgeLabel = "acks=all OK · no headroom";
    }
  }

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
        Simplified for teaching — one partition, replication factor 3, and catch-up is a button rather than a
        function of how far behind the follower is. What carries over: acks=all waits for the whole current ISR,
        min.insync.replicas is the floor below which the write is refused, a restarted broker replicates the backlog
        before rejoining the ISR, and it does not take leadership back on its own.
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
          const st = s.broker[id];
          return (
            <div
              key={id}
              data-testid={`broker-${id}`}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                st === "down"
                  ? "border-danger/40 bg-danger-soft"
                  : st === "catching-up"
                    ? "border-accent/40 bg-accent-soft"
                    : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">broker-{id}</span>
                {s.leader === id ? (
                  <Badge tone="accent">leader</Badge>
                ) : st === "in-sync" ? (
                  <Badge tone="stream">follower</Badge>
                ) : st === "catching-up" ? (
                  <Badge tone="accent">catching up</Badge>
                ) : (
                  <Badge tone="danger">down</Badge>
                )}
              </div>
              <div className="font-mono text-[11px] text-text-faint">
                {st === "in-sync" ? "in ISR" : st === "catching-up" ? "replicating backlog" : "out of ISR"}
              </div>
              {st === "in-sync" ? (
                <button
                  onClick={() => stopBroker(id)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
                >
                  stop broker
                </button>
              ) : st === "catching-up" ? (
                <button
                  onClick={() => catchUp(id)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
                >
                  finish catch-up →
                </button>
              ) : (
                <button
                  onClick={() => startBroker(id)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
                >
                  start broker
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border-soft bg-bg-inset p-3">
        <span data-testid="isr-summary" className="font-mono text-[11px] text-text-muted">
          ISR {`{${inSync.join(", ")}}`} · leader {s.leader === null ? "none" : `broker-${s.leader}`}
        </span>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
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
