"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Rack = "A" | "B" | "C";
const RACKS: Rack[] = ["A", "B", "C"];

// broker id -> its rack. Two brokers per rack.
const BROKER_RACK: Record<number, Rack> = { 1: "A", 2: "A", 3: "B", 4: "B", 5: "C", 6: "C" };
const MIN_ISR = 2;
const CONSUMER_RACK: Rack = "C";

// The three brokers the assignor picks for this partition's replicas, in preference order.
function replicaBrokers(rackAware: boolean): number[] {
  // rack-aware: one replica per rack. Otherwise: lowest broker ids, blind to racks.
  return rackAware ? [1, 3, 5] : [1, 2, 3];
}

export default function RackPlacementDemo() {
  const [rackAware, setRackAware] = useState(true);
  const [rackFetch, setRackFetch] = useState(false);
  const [failed, setFailed] = useState<Set<Rack>>(new Set());
  const [log, setLog] = useState<string[]>([
    "broker.rack set · replicas b1 (A), b3 (B), b5 (C) · consumer in rack C",
  ]);

  function push(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  const replicas = replicaBrokers(rackAware);
  const aliveReplicas = replicas.filter((b) => !failed.has(BROKER_RACK[b]));
  const leader = aliveReplicas[0] ?? null;
  const isrRacks = [...new Set(aliveReplicas.map((b) => BROKER_RACK[b]))];

  const online = leader !== null;
  const acksAllOk = aliveReplicas.length >= MIN_ISR;

  // Where the rack-C consumer fetches from.
  const localReplica = aliveReplicas.find((b) => BROKER_RACK[b] === CONSUMER_RACK) ?? null;
  const fetchFrom =
    rackFetch && localReplica !== null ? localReplica : leader;
  const crossRack = fetchFrom !== null && BROKER_RACK[fetchFrom] !== CONSUMER_RACK;

  function toggleRackAware() {
    const next = !rackAware;
    setRackAware(next);
    setFailed(new Set());
    const r = replicaBrokers(next);
    push(
      next
        ? `broker.rack set — assignor spreads replicas one per rack: ${r.map((b) => `b${b} (${BROKER_RACK[b]})`).join(", ")}.`
        : `broker.rack unset — assignor picks by broker id, blind to racks: ${r.map((b) => `b${b} (${BROKER_RACK[b]})`).join(", ")} — two in rack A.`,
    );
  }

  function toggleRackFetch() {
    const next = !rackFetch;
    setRackFetch(next);
    push(
      next
        ? "rack-aware fetching on (replica.selector.class + client.rack=C) — the consumer prefers an in-sync replica in its own rack."
        : "rack-aware fetching off — the consumer always fetches from the partition leader.",
    );
  }

  function toggleRack(rack: Rack) {
    const next = new Set(failed);
    const failing = !next.has(rack);
    if (failing) next.add(rack);
    else next.delete(rack);
    setFailed(next);

    const nextAlive = replicas.filter((b) => !next.has(BROKER_RACK[b]));
    if (!failing) {
      push(`rack ${rack} back up — its replica rejoins the ISR.`);
    } else if (nextAlive.length === 0) {
      push(`rack ${rack} down — no replica of this partition survives. Partition is offline.`);
    } else if (nextAlive.length < MIN_ISR) {
      push(
        `rack ${rack} down — only ${nextAlive.length} replica left (b${nextAlive.join(", b")}). Below min.insync.replicas=${MIN_ISR}: reads continue, acks=all writes fail.`,
      );
    } else {
      push(
        `rack ${rack} down — ${nextAlive.length} replicas still in sync across racks ${[...new Set(nextAlive.map((b) => BROKER_RACK[b]))].join(", ")}. Partition healthy.`,
      );
    }
  }

  function reset() {
    setRackAware(true);
    setRackFetch(false);
    setFailed(new Set());
    setLog(["broker.rack set · replicas b1 (A), b3 (B), b5 (C) · consumer in rack C"]);
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
        pinned to rack C. What carries over: broker.rack makes the assignor spread replicas across racks so one rack
        can fail without dropping below min.insync.replicas; rack-aware fetching needs both the broker selector and
        the consumer&apos;s client.rack, and only helps when an in-sync replica shares the consumer&apos;s rack.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleRackAware}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            rackAware
              ? "border-success/50 bg-success-soft text-success"
              : "border-danger/50 bg-danger-soft text-danger"
          }`}
        >
          broker.rack {rackAware ? "set" : "unset"}
        </button>
        <button
          onClick={toggleRackFetch}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            rackFetch
              ? "border-stream/50 bg-stream-soft text-stream"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-stream/40"
          }`}
        >
          rack-aware fetching {rackFetch ? "on" : "off"}
        </button>
      </div>

      <div data-testid="racks" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RACKS.map((rack) => {
          const down = failed.has(rack);
          const brokersHere = Object.entries(BROKER_RACK)
            .filter(([, r]) => r === rack)
            .map(([b]) => Number(b));
          return (
            <div
              key={rack}
              data-testid={`rack-${rack}`}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                down ? "border-danger/40 bg-danger-soft" : "border-border-soft bg-bg-inset"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text">rack {rack}</span>
                {rack === CONSUMER_RACK && <Badge tone="stream">consumer</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brokersHere.map((b) => {
                  const hasReplica = replicas.includes(b);
                  const isLeader = leader === b;
                  return (
                    <span
                      key={b}
                      data-testid={`broker-${b}`}
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                        !hasReplica
                          ? "border-border-soft text-text-faint"
                          : down
                            ? "border-danger/40 text-danger line-through"
                            : isLeader
                              ? "border-accent/40 bg-accent-soft text-accent"
                              : "border-stream/40 bg-stream-soft text-stream"
                      }`}
                    >
                      b{b}
                      {hasReplica && (isLeader ? " ·L" : " ·F")}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={() => toggleRack(rack)}
                className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
              >
                {down ? "restore rack" : "fail rack"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-3">
          <span data-testid="partition-status" className="font-mono text-[11px] text-text-muted">
            {online
              ? `online · ISR ${aliveReplicas.length} across rack${isrRacks.length === 1 ? "" : "s"} ${isrRacks.join(", ")}`
              : "offline · no surviving replica"}
          </span>
          <Badge tone={acksAllOk ? "success" : "danger"}>
            {acksAllOk ? "acks=all OK" : "acks=all failing"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-3">
          <span data-testid="fetch-status" className="font-mono text-[11px] text-text-muted">
            {fetchFrom === null
              ? "consumer can't fetch — partition offline"
              : `consumer fetches from b${fetchFrom} (rack ${BROKER_RACK[fetchFrom]})`}
          </span>
          {fetchFrom !== null && (
            <Badge tone={crossRack ? "accent" : "success"}>
              {crossRack ? "cross-rack transfer" : "same-rack, no transfer cost"}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
