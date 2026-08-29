"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Rack = "A" | "B" | "C";
const RACKS: Rack[] = ["A", "B", "C"];
// "ineligible" = recovered its own log, but no leader exists and it wasn't in the last
// ISR — it can't join the ISR or lead until an eligible replica is back.
type BrokerState = "in-sync" | "catching-up" | "ineligible" | "down";

// broker id -> its rack. Two brokers per rack.
const BROKER_RACK: Record<number, Rack> = { 1: "A", 2: "A", 3: "B", 4: "B", 5: "C", 6: "C" };
const MIN_ISR = 2;
const CONSUMER_RACK: Rack = "C";

// The three brokers the assignor picks when a topic is created / reassigned.
const replicaBrokers = (rackAware: boolean): number[] => (rackAware ? [1, 3, 5] : [1, 2, 3]);

interface State {
  rackConfig: boolean; // current broker.rack setting
  placedRackAware: boolean; // how this partition's replicas were actually placed
  replicas: number[];
  leader: number | null;
  brokerState: Record<number, BrokerState>;
  failedRacks: Set<Rack>; // tracked independently of which replicas are placed
  unclean: boolean; // unclean.leader.election.enable
  lastISR: number[]; // last non-empty ISR — the replicas that can lead safely
  dataLoss: boolean;
  rackFetch: boolean;
  log: string[];
}

function freshBrokerState(replicas: number[]): Record<number, BrokerState> {
  const m: Record<number, BrokerState> = {};
  for (const b of replicas) m[b] = "in-sync";
  return m;
}

const INITIAL: State = {
  rackConfig: true,
  placedRackAware: true,
  replicas: [1, 3, 5],
  leader: 1,
  brokerState: freshBrokerState([1, 3, 5]),
  failedRacks: new Set<Rack>(),
  unclean: false,
  lastISR: [1, 3, 5],
  dataLoss: false,
  rackFetch: false,
  log: ["broker.rack set · replicas b1 (A), b3 (B), b5 (C) · consumer in rack C"],
};

export default function RackPlacementDemo() {
  const [s, setS] = useState<State>(INITIAL);

  const inSync = s.replicas.filter((b) => s.brokerState[b] === "in-sync");
  const ineligibleCount = s.replicas.filter((b) => s.brokerState[b] === "ineligible").length;
  const online = s.leader !== null;
  const acksAllOk = online && inSync.length >= MIN_ISR;
  const isrRacks = [...new Set(inSync.map((b) => BROKER_RACK[b]))];
  const localReplica = inSync.find((b) => BROKER_RACK[b] === CONSUMER_RACK) ?? null;
  const fetchFrom = s.rackFetch && localReplica !== null ? localReplica : s.leader;
  const crossRack = fetchFrom !== null && BROKER_RACK[fetchFrom] !== CONSUMER_RACK;
  const configDrift = s.rackConfig !== s.placedRackAware;

  const push = (line: string, prev: string[]) => [line, ...prev].slice(0, 6);

  function toggleRackConfig() {
    setS((prev) => ({
      ...prev,
      rackConfig: !prev.rackConfig,
      log: push(
        `broker.rack ${!prev.rackConfig ? "set" : "unset"} — applies to new topics and reassignments, not this partition. Reassign to move existing replicas.`,
        prev.log,
      ),
    }));
  }

  function reassign() {
    setS((prev) => {
      const replicas = replicaBrokers(prev.rackConfig);
      // A replica whose rack is still down comes up as "down", not magically in sync.
      const brokerState: Record<number, BrokerState> = {};
      for (const b of replicas) brokerState[b] = prev.failedRacks.has(BROKER_RACK[b]) ? "down" : "in-sync";
      const isr = replicas.filter((b) => brokerState[b] === "in-sync");
      const leader = isr[0] ?? null;
      const downNote = replicas.some((b) => brokerState[b] === "down")
        ? ` Replicas in down racks (${replicas.filter((b) => brokerState[b] === "down").map((b) => `b${b}`).join(", ")}) start out of the ISR.`
        : "";
      return {
        ...prev,
        placedRackAware: prev.rackConfig,
        replicas,
        leader,
        brokerState,
        lastISR: isr.length > 0 ? isr : prev.lastISR,
        log: push(
          `partition reassigned — replicas ${replicas.map((b) => `b${b} (${BROKER_RACK[b]})`).join(", ")}.${downNote}`,
          prev.log,
        ),
      };
    });
  }

  function failRack(rack: Rack) {
    setS((prev) => {
      const failedRacks = new Set(prev.failedRacks).add(rack);
      const hit = prev.replicas.filter((b) => BROKER_RACK[b] === rack);
      const brokerState = { ...prev.brokerState };
      for (const b of hit) brokerState[b] = "down";
      let leader = prev.leader;
      if (prev.leader !== null && hit.includes(prev.leader)) {
        leader = prev.replicas.find((b) => brokerState[b] === "in-sync") ?? null;
      }
      const nextISR = prev.replicas.filter((b) => brokerState[b] === "in-sync");
      const lastISR = nextISR.length > 0 ? nextISR : prev.lastISR;
      let line: string;
      if (hit.length === 0) {
        line = `rack ${rack} down — no replica of this partition lives there.`;
      } else if (nextISR.length === 0) {
        line = `rack ${rack} down — no replica survives. Partition offline; last ISR was {b${lastISR.join(", b")}}.`;
      } else if (nextISR.length < MIN_ISR) {
        line = `rack ${rack} down — only ${nextISR.length} replica left (b${nextISR.join(", b")}). Below min.insync.replicas=${MIN_ISR}: reads continue, acks=all fails.`;
      } else {
        line = `rack ${rack} down — ${nextISR.length} replicas still in sync across racks ${[...new Set(nextISR.map((b) => BROKER_RACK[b]))].join(", ")}.`;
      }
      return { ...prev, failedRacks, brokerState, leader, lastISR, log: push(line, prev.log) };
    });
  }

  function restoreRack(rack: Rack) {
    setS((prev) => {
      const failedRacks = new Set(prev.failedRacks);
      failedRacks.delete(rack);
      const hit = prev.replicas.filter((b) => BROKER_RACK[b] === rack && prev.brokerState[b] === "down");
      const brokerState = { ...prev.brokerState };
      for (const b of hit) brokerState[b] = "catching-up";
      // Leadership is never handed to a replica that is still catching up.
      const line =
        hit.length === 0
          ? `rack ${rack} back up.`
          : prev.leader === null
            ? `rack ${rack} back — b${hit.join(", b")} recovering. The partition stays offline until a replica catches up.`
            : `rack ${rack} back — its replica(s) replicate the backlog. Not in the ISR until caught up; leadership stays with b${prev.leader}.`;
      return { ...prev, failedRacks, brokerState, log: push(line, prev.log) };
    });
  }

  // When a leader is elected, recovered-but-ineligible replicas now have a leader to
  // sync from, so they move to "catching-up" and must catch up separately.
  function releaseIneligible(bs: Record<number, BrokerState>): Record<number, BrokerState> {
    const next = { ...bs };
    for (const b of Object.keys(next).map(Number)) if (next[b] === "ineligible") next[b] = "catching-up";
    return next;
  }

  function catchUp(brokerId: number) {
    setS((prev) => {
      if (prev.brokerState[brokerId] !== "catching-up") return prev;

      // Partial recovery — there is a leader to catch up from.
      if (prev.leader !== null) {
        const brokerState = { ...prev.brokerState, [brokerId]: "in-sync" as BrokerState };
        const nextISR = prev.replicas.filter((b) => brokerState[b] === "in-sync");
        return {
          ...prev,
          brokerState,
          lastISR: nextISR,
          log: push(
            `b${brokerId} caught up from leader b${prev.leader} — rejoined the ISR {b${nextISR.join(", b")}}.`,
            prev.log,
          ),
        };
      }

      // Full outage, no leader yet.
      if (prev.lastISR.includes(brokerId)) {
        const brokerState = releaseIneligible({ ...prev.brokerState, [brokerId]: "in-sync" });
        return {
          ...prev,
          brokerState,
          leader: brokerId,
          lastISR: [brokerId],
          log: push(
            `b${brokerId} recovered and took leadership — it was in the last ISR {b${prev.lastISR.join(", b")}}, so no acknowledged data is lost. Other recovered replicas now catch up from it.`,
            prev.log,
          ),
        };
      }
      if (prev.unclean) {
        const brokerState = releaseIneligible({ ...prev.brokerState, [brokerId]: "in-sync" });
        return {
          ...prev,
          brokerState,
          leader: brokerId,
          dataLoss: true,
          lastISR: [brokerId],
          log: push(
            `unclean leader election — b${brokerId} was NOT in the last ISR {b${prev.lastISR.join(", b")}}, so it leads from behind. Records only those replicas held are lost.`,
            prev.log,
          ),
        };
      }
      return {
        ...prev,
        brokerState: { ...prev.brokerState, [brokerId]: "ineligible" },
        log: push(
          `b${brokerId} recovered its log but was not in the last ISR {b${prev.lastISR.join(", b")}}. It stays out of the ISR until a last-ISR replica returns to lead.`,
          prev.log,
        ),
      };
    });
  }

  function toggleUnclean() {
    setS((prev) => {
      const on = !prev.unclean;
      // Turning it on while the partition is stuck offline behind an ineligible replica
      // triggers the unclean election that catchUp would otherwise have skipped.
      if (on && prev.leader === null) {
        const candidate = prev.replicas.find((b) => prev.brokerState[b] === "ineligible");
        if (candidate !== undefined) {
          const brokerState = releaseIneligible({ ...prev.brokerState, [candidate]: "in-sync" });
          return {
            ...prev,
            brokerState,
            unclean: true,
            leader: candidate,
            dataLoss: true,
            lastISR: [candidate],
            log: push(
              `unclean.leader.election.enable set to true — no eligible replica, so the controller elects b${candidate} from behind the last ISR {b${prev.lastISR.join(", b")}}. Records only those replicas held are lost.`,
              prev.log,
            ),
          };
        }
      }
      return { ...prev, unclean: on, log: push(`unclean.leader.election.enable set to ${on}.`, prev.log) };
    });
  }

  function toggleRackFetch() {
    setS((prev) => ({
      ...prev,
      rackFetch: !prev.rackFetch,
      log: push(
        !prev.rackFetch
          ? "rack-aware fetching on (replica.selector.class + client.rack=C) — the consumer prefers an in-sync replica in its own rack."
          : "rack-aware fetching off — the consumer always fetches from the partition leader.",
        prev.log,
      ),
    }));
  }

  function reset() {
    setS(INITIAL);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · rack-aware placement and fetching
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — six brokers, two per rack, one partition with replication factor 3, and a consumer
        pinned to rack C. What carries over: broker.rack only steers new placement, so an existing partition needs a
        reassignment to spread across racks; a restored replica catches up before rejoining the ISR and doesn&apos;t
        take leadership back; and rack-aware fetching needs both the broker selector and the consumer&apos;s
        client.rack, and only helps when an in-sync replica shares the consumer&apos;s rack.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleRackConfig}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            s.rackConfig
              ? "border-success/50 bg-success-soft text-success"
              : "border-danger/50 bg-danger-soft text-danger"
          }`}
        >
          broker.rack {s.rackConfig ? "set" : "unset"}
        </button>
        <button
          onClick={reassign}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reassign partition →
        </button>
        <button
          onClick={toggleRackFetch}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            s.rackFetch
              ? "border-stream/50 bg-stream-soft text-stream"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
          }`}
        >
          rack-aware fetching {s.rackFetch ? "on" : "off"}
        </button>
        <button
          onClick={toggleUnclean}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            s.unclean
              ? "border-danger/50 bg-danger-soft text-danger"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-danger/40"
          }`}
        >
          unclean.leader.election.enable={String(s.unclean)}
        </button>
        {configDrift && (
          <span data-testid="config-drift" className="font-mono text-[11px] text-accent">
            broker.rack changed — reassign to apply to this partition
          </span>
        )}
      </div>

      <div data-testid="racks" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RACKS.map((rack) => {
          const brokersHere = Object.entries(BROKER_RACK)
            .filter(([, r]) => r === rack)
            .map(([b]) => Number(b));
          const replicaHere = brokersHere.filter((b) => s.replicas.includes(b));
          const rackDown = s.failedRacks.has(rack);
          const catchingUpHere = replicaHere.filter((b) => s.brokerState[b] === "catching-up");
          return (
            <div
              key={rack}
              data-testid={`rack-${rack}`}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                rackDown ? "border-danger/40 bg-danger-soft" : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">rack {rack}</span>
                {rack === CONSUMER_RACK && <Badge tone="stream">consumer</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brokersHere.map((b) => {
                  const isReplica = s.replicas.includes(b);
                  const st = s.brokerState[b];
                  const isLeader = s.leader === b;
                  return (
                    <span
                      key={b}
                      data-testid={`broker-${b}`}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                        !isReplica
                          ? "border-border-soft text-text-faint"
                          : st === "down"
                            ? "border-danger/40 text-danger line-through"
                            : st === "catching-up" || st === "ineligible"
                              ? "border-accent/40 bg-accent-soft text-accent"
                              : isLeader
                                ? "border-accent/40 bg-accent-soft text-accent"
                                : "border-stream/40 bg-stream-soft text-stream"
                      }`}
                    >
                      b{b}
                      {isReplica &&
                        (isLeader
                          ? " ·L"
                          : st === "catching-up"
                            ? " ·↑"
                            : st === "ineligible"
                              ? " ·!"
                              : st === "down"
                                ? ""
                                : " ·F")}
                    </span>
                  );
                })}
              </div>
              {catchingUpHere.length > 0 ? (
                catchingUpHere.map((b) => (
                  <button
                    key={b}
                    onClick={() => catchUp(b)}
                    className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
                  >
                    b{b} finish catch-up →
                  </button>
                ))
              ) : rackDown ? (
                <button
                  onClick={() => restoreRack(rack)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
                >
                  restore rack
                </button>
              ) : (
                <button
                  onClick={() => failRack(rack)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
                >
                  fail rack
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-3">
          <span data-testid="partition-status" className="font-mono text-[11px] text-text-muted">
            {online
              ? `online · ISR ${inSync.length} across rack${isrRacks.length === 1 ? "" : "s"} ${isrRacks.join(", ")}`
              : ineligibleCount > 0
                ? "offline · recovered replica ineligible to lead"
                : "offline · no surviving replica"}
          </span>
          <Badge tone={acksAllOk ? "success" : "danger"}>
            {acksAllOk ? "acks=all OK" : "acks=all failing"}
          </Badge>
          {s.dataLoss && <Badge tone="danger">unclean election — data lost</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-3">
          <span data-testid="fetch-status" className="font-mono text-[11px] text-text-muted">
            {fetchFrom === null
              ? "consumer can't fetch — partition offline"
              : `consumer fetches from b${fetchFrom} (rack ${BROKER_RACK[fetchFrom]})`}
          </span>
          {fetchFrom !== null && (
            <Badge tone={crossRack ? "accent" : "success"}>
              {crossRack ? "cross-rack transfer" : "same-rack — no cross-rack transfer"}
            </Badge>
          )}
        </div>
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
