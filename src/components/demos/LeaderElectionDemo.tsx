"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

interface Broker {
  id: number;
  role: "leader" | "follower" | "recovering" | "offline";
  inSync: boolean;
}

const ROLE_TONE = {
  leader: "accent",
  follower: "stream",
  recovering: "neutral",
  offline: "danger",
} as const;

const INITIAL: Broker[] = [
  { id: 1, role: "leader", inSync: true },
  { id: 2, role: "follower", inSync: true },
  { id: 3, role: "follower", inSync: true },
];

export default function LeaderElectionDemo() {
  const [brokers, setBrokers] = useState<Broker[]>(INITIAL);
  const [log, setLog] = useState<string[]>(["broker-1 elected leader. brokers 2 and 3 are in-sync followers."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function failBroker(id: number) {
    setBrokers((current) => {
      const target = current.find((b) => b.id === id);
      if (!target || target.role === "offline") return current;

      const wasLeader = target.role === "leader";
      const wasRecovering = target.role === "recovering";
      const next = current.map((b) => (b.id === id ? { ...b, role: "offline" as const, inSync: false } : b));

      if (wasLeader) {
        const candidates = next.filter((b) => b.role !== "offline" && b.inSync);
        if (candidates.length === 0) {
          pushLog(`broker-${id} (leader) failed. No in-sync replica available — partition is offline.`);
          return next;
        }
        const newLeader = candidates[0];
        pushLog(`broker-${id} (leader) failed. broker-${newLeader.id} elected from the ISR.`);
        return next.map((b) => (b.id === newLeader.id ? { ...b, role: "leader" } : b));
      }

      if (wasRecovering) {
        pushLog(`broker-${id} failed while still catching up — it was never admitted to the ISR.`);
        return next;
      }

      pushLog(`broker-${id} (follower) failed and dropped out of the ISR.`);
      return next;
    });
  }

  function restart(id: number) {
    setBrokers((current) => {
      const hasLeader = current.some((b) => b.role === "leader");
      pushLog(
        hasLeader
          ? `broker-${id} restarted and is replicating from the leader — not yet in the ISR.`
          : `broker-${id} restarted with no leader in place — it has nothing to replicate from and cannot catch up.`,
      );
      return current.map((b) => (b.id === id ? { ...b, role: "recovering" as const, inSync: false } : b));
    });
  }

  // Only valid once a leader exists: the recovering broker has been replicating from it,
  // so admitting it to the ISR is a normal, clean catch-up.
  function catchUp(id: number) {
    setBrokers((current) => {
      if (!current.some((b) => b.role === "leader")) return current;
      pushLog(`broker-${id} caught up and rejoined the ISR as a follower.`);
      return current.map((b) => (b.id === id ? { ...b, role: "follower" as const, inSync: true } : b));
    });
  }

  // No leader means this broker had nothing to replicate from — it cannot have caught up.
  // Promoting it is an unclean election: an explicit, named decision to restore availability
  // at the risk of losing any records only acknowledged to the previous leader.
  function uncleanElect(id: number) {
    setBrokers((current) => {
      if (current.some((b) => b.role === "leader")) return current;
      pushLog(
        `broker-${id} promoted with no confirmed catch-up — unclean election. Records only acknowledged to the previous leader may be lost.`,
      );
      return current.map((b) => (b.id === id ? { ...b, role: "leader" as const, inSync: true } : b));
    });
  }

  function reset() {
    setBrokers(INITIAL);
    setLog(["broker-1 elected leader. brokers 2 and 3 are in-sync followers."]);
  }

  const hasLeader = brokers.some((b) => b.role === "leader");

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · leader election
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {brokers.map((b) => (
          <div
            key={b.id}
            data-testid={`broker-card-${b.id}`}
            className="flex flex-col items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-4"
          >
            <div className="font-mono text-sm text-text">broker-{b.id}</div>
            <Badge tone={ROLE_TONE[b.role]}>{b.role}</Badge>

            {b.role === "offline" && (
              <button
                onClick={() => restart(b.id)}
                className="mt-1 rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
              >
                restart
              </button>
            )}

            {b.role === "recovering" && (
              <div className="mt-1 flex flex-col items-center gap-1.5">
                {hasLeader ? (
                  <button
                    onClick={() => catchUp(b.id)}
                    className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
                  >
                    catch up →
                  </button>
                ) : (
                  <>
                    <span className="max-w-[10rem] text-center font-mono text-[10px] leading-snug text-danger">
                      no leader — nothing to replicate from
                    </span>
                    <button
                      onClick={() => uncleanElect(b.id)}
                      className="rounded border border-danger/50 bg-danger-soft px-2 py-1 font-mono text-[11px] text-danger hover:border-danger"
                    >
                      elect anyway (unclean) →
                    </button>
                  </>
                )}
                <button
                  onClick={() => failBroker(b.id)}
                  className="rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
                >
                  kill
                </button>
              </div>
            )}

            {(b.role === "leader" || b.role === "follower") && (
              <button
                onClick={() => failBroker(b.id)}
                className="mt-1 rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
              >
                kill broker
              </button>
            )}
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
