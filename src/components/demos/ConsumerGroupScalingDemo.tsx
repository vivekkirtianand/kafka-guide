"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

const PARTITIONS = 6;
const MAX_CONSUMERS = 8;

// Contiguous ranges, like the RangeAssignor over a single topic: the first `remainder`
// consumers get one extra partition each.
function assign(consumerCount: number): number[][] {
  const result: number[][] = Array.from({ length: consumerCount }, () => []);
  if (consumerCount === 0) return result;
  const base = Math.floor(PARTITIONS / consumerCount);
  const remainder = PARTITIONS % consumerCount;
  let p = 0;
  for (let c = 0; c < consumerCount; c++) {
    const take = base + (c < remainder ? 1 : 0);
    for (let i = 0; i < take; i++) result[c].push(p++);
  }
  return result;
}

export default function ConsumerGroupScalingDemo() {
  const [count, setCount] = useState(2);
  const [log, setLog] = useState<string[]>(["group started with 2 consumers — 6 partitions assigned 3 and 3."]);

  const assignment = assign(count);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function addConsumer() {
    if (count >= MAX_CONSUMERS) return;
    const next = count + 1;
    setCount(next);
    if (next > PARTITIONS) {
      pushLog(
        `consumer-${next} joined — rebalance triggered, but all ${PARTITIONS} partitions are already assigned. consumer-${next} stays idle until a partition frees up or the topic gains partitions.`,
      );
    } else {
      pushLog(`consumer-${next} joined — rebalance: ${next} consumers now share ${PARTITIONS} partitions.`);
    }
  }

  function removeConsumer() {
    if (count <= 1) return;
    const leaving = count;
    setCount(count - 1);
    pushLog(`consumer-${leaving} left — rebalance: its partitions reassigned across the remaining ${count - 1}.`);
  }

  function reset() {
    setCount(2);
    setLog(["group started with 2 consumers — 6 partitions assigned 3 and 3."]);
  }

  const idleConsumers = Math.max(0, count - PARTITIONS);

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · adding and removing consumers
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real assignment depends on the assignor, and a rebalance is a multi-step protocol,
        not instant. What carries over: one partition is consumed by exactly one member of a group, so the working
        consumer count is capped at the partition count, and every join or leave triggers a rebalance.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={addConsumer}
          disabled={count >= MAX_CONSUMERS}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          add consumer →
        </button>
        <button
          onClick={removeConsumer}
          disabled={count <= 1}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          remove consumer →
        </button>
        <span className="font-mono text-[11px] text-text-faint sm:ml-auto">
          {count} consumer{count === 1 ? "" : "s"} · {PARTITIONS} partitions
          {idleConsumers > 0 ? ` · ${idleConsumers} idle` : ""}
        </span>
      </div>

      <div data-testid="assignment" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {assignment.map((parts, i) => (
          <div
            key={i}
            data-testid={`consumer-${i + 1}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-bg-inset p-3"
          >
            <span className="font-mono text-sm text-text">consumer-{i + 1}</span>
            {parts.length > 0 ? (
              <span className="font-mono text-[11px] text-text-muted">
                {parts.map((p) => `p${p}`).join(", ")}
              </span>
            ) : (
              <Badge tone="danger">idle — no partitions</Badge>
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
