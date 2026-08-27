"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Acks = 0 | 1 | "all";

interface Broker {
  id: number;
  role: "leader" | "follower";
  alive: boolean;
  hasRecord: boolean;
}

const INITIAL: Broker[] = [
  { id: 1, role: "leader", alive: true, hasRecord: false },
  { id: 2, role: "follower", alive: true, hasRecord: false },
  { id: 3, role: "follower", alive: true, hasRecord: false },
];

// Every acks setting produces one of these outcomes, kept separate from whether the
// record actually survived — "acknowledged" and "safe" are two different questions.
type OutcomeKind = "safe-acked" | "safe-unrequested" | "lost-acked" | "lost-unrequested" | "unknown-ambiguous";

const OUTCOME_BADGE: Record<OutcomeKind, { tone: "success" | "danger" | "neutral"; label: string }> = {
  "safe-acked": { tone: "success", label: "acknowledged — data safe" },
  "safe-unrequested": { tone: "neutral", label: "acknowledgment not requested — delivery unknown" },
  "lost-acked": { tone: "danger", label: "acknowledged — data lost" },
  "lost-unrequested": { tone: "danger", label: "producer considered sent — record lost" },
  "unknown-ambiguous": { tone: "neutral", label: "not acknowledged — outcome unknown" },
};

export default function AcksDurabilityDemo() {
  const [acks, setAcks] = useState<Acks>("all");
  const [crashLeader, setCrashLeader] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>(INITIAL);
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null);
  const [log, setLog] = useState<string[]>(["waiting to produce a record."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function send() {
    // Every trial starts from a clean, fully in-sync cluster — this demo isolates the
    // acks/crash-timing interaction, not leader election (see the leader election demo
    // in Module 1 for that).
    let next: Broker[] = INITIAL.map((b) => (b.role === "leader" ? { ...b, hasRecord: true } : b));
    let kind: OutcomeKind;
    let line: string;

    if (acks === "all") {
      if (crashLeader) {
        // The leader replicates to the ISR — the record genuinely survives — but crashes
        // before its acknowledgment reaches the producer. From the producer's side this
        // is indistinguishable from "never replicated at all": it just sees a timeout.
        next = next.map((b) => (b.role === "leader" ? { ...b, alive: false } : { ...b, hasRecord: true }));
        kind = "unknown-ambiguous";
        line =
          "acks=all: leader replicated to both followers, then crashed before its acknowledgment reached the producer. The record actually survived — a new leader elected from the followers will have it — but the producer can't tell that from a timeout alone. Retrying is the only reasonable move; enable.idempotence=true is what makes that retry safe, whether or not the original write turns out to have already landed.";
      } else {
        next = next.map((b) => (b.role === "follower" ? { ...b, hasRecord: true } : b));
        kind = "safe-acked";
        line = "acks=all: leader replicated to both followers, then acknowledged. The record is durable against any single broker failure.";
      }
    } else if (acks === 1) {
      if (crashLeader) {
        next = next.map((b) => (b.role === "leader" ? { ...b, alive: false } : b));
        kind = "lost-acked";
        line =
          "acks=1: leader acknowledged immediately after its own append, then crashed before replicating. A follower without this record can now be elected leader — the record is gone despite being acknowledged.";
      } else {
        next = next.map((b) => (b.role === "follower" ? { ...b, hasRecord: true } : b));
        kind = "safe-acked";
        line = "acks=1: leader acknowledged after its own append, then replicated normally to both followers.";
      }
    } else {
      // acks=0: the producer never requests an acknowledgment at all — it considers the
      // record sent the moment it hands it to the network and gets back offset=-1. There
      // is no "acknowledged" outcome to have here, safe or otherwise.
      if (crashLeader) {
        next = next.map((b) => (b.role === "leader" ? { ...b, alive: false } : b));
        kind = "lost-unrequested";
        line =
          "acks=0: the producer never asked for an acknowledgment and already moved on. The leader crashed before replicating, so the record is gone — and the producer has no way to know, because it never asked in the first place.";
      } else {
        next = next.map((b) => (b.role === "follower" ? { ...b, hasRecord: true } : b));
        kind = "safe-unrequested";
        line = "acks=0: the producer never asked for an acknowledgment. Nothing failed this time, so the record made it through — but the application never confirmed that, and couldn't have.";
      }
    }

    setBrokers(next);
    setOutcome(kind);
    pushLog(line);
  }

  function reset() {
    setAcks("all");
    setCrashLeader(false);
    setBrokers(INITIAL);
    setOutcome(null);
    setLog(["waiting to produce a record."]);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · acks and acknowledged data loss
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real replication and leader election involve the controller and ISR bookkeeping,
        not a single-step crash. What carries over: a produce request that never completes is genuinely ambiguous —
        the record may have landed anyway — and only acks=0 has no acknowledgment to lose in the first place.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {([0, 1, "all"] as Acks[]).map((a) => (
            <button
              key={String(a)}
              onClick={() => setAcks(a)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
                acks === a
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
              }`}
            >
              acks={a}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCrashLeader((c) => !c)}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            crashLeader
              ? "border-danger/50 bg-danger-soft text-danger"
              : "border-border-soft bg-bg-inset text-text-muted hover:border-danger/40"
          }`}
        >
          {crashLeader ? "leader will crash mid-produce ✓" : "crash leader mid-produce"}
        </button>

        <button
          onClick={send}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream sm:ml-auto"
        >
          produce record →
        </button>
      </div>

      {outcome && (
        <div className="mb-4">
          <Badge tone={OUTCOME_BADGE[outcome].tone}>{OUTCOME_BADGE[outcome].label}</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {brokers.map((b) => (
          <div
            key={b.id}
            data-testid={`acks-broker-${b.id}`}
            className="flex flex-col items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-4"
          >
            <div className="font-mono text-sm text-text">broker-{b.id}</div>
            <Badge tone={b.role === "leader" ? "accent" : "stream"}>{b.role}</Badge>
            <span className="font-mono text-[11px] text-text-faint">{b.alive ? "alive" : "crashed"}</span>
            <span className={`font-mono text-[11px] ${b.hasRecord ? "text-success" : "text-text-faint"}`}>
              {b.hasRecord ? "has record" : "no record"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
