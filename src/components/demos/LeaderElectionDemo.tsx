"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

interface Broker {
  id: number;
  role: "leader" | "follower" | "offline";
  inSync: boolean;
}

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

      pushLog(`broker-${id} (follower) failed and dropped out of the ISR.`);
      return next;
    });
  }

  function restart(id: number) {
    setBrokers((current) => {
      const hasLeader = current.some((b) => b.role === "leader");
      const next = current.map((b) => (b.id === id ? { ...b, role: (hasLeader ? "follower" : "leader") as Broker["role"], inSync: true } : b));
      pushLog(`broker-${id} restarted and is catching up.`);
      return next;
    });
  }

  function reset() {
    setBrokers(INITIAL);
    setLog(["broker-1 elected leader. brokers 2 and 3 are in-sync followers."]);
  }

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
            className="flex flex-col items-center gap-2 rounded-md border border-border-soft bg-bg-inset p-4"
          >
            <div className="font-mono text-sm text-text">broker-{b.id}</div>
            <Badge
              tone={b.role === "leader" ? "accent" : b.role === "offline" ? "danger" : "stream"}
            >
              {b.role}
            </Badge>
            {b.role === "offline" ? (
              <button
                onClick={() => restart(b.id)}
                className="mt-1 rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
              >
                restart
              </button>
            ) : (
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
