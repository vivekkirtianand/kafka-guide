"use client";

import { useState } from "react";

interface State {
  produced: number; // how many events e0..e(n-1) have been produced
  queueConsumed: number; // messages removed from the queue (gone)
  groupA: number; // Kafka consumer group A committed offset
  groupB: number | null; // group B offset, null until added
  log: string[];
}

const initial: State = {
  produced: 0,
  queueConsumed: 0,
  groupA: 0,
  groupB: null,
  log: ["produce a few events, then read from each side."],
};

export default function QueueVsLogDemo() {
  const [s, setS] = useState<State>(initial);

  function push(line: string, next: State): State {
    return { ...next, log: [line, ...next.log].slice(0, 6) };
  }

  function produce() {
    setS((c) => {
      const id = c.produced;
      return push(`event e${id} produced — enqueued on the queue AND appended to the Kafka partition.`, {
        ...c,
        produced: c.produced + 1,
      });
    });
  }

  function queueConsume() {
    setS((c) => {
      const remaining = c.produced - c.queueConsumed;
      if (remaining <= 0) return push("the queue is empty — nothing left to deliver.", c);
      const id = c.queueConsumed;
      return push(`queue: a worker takes e${id}. It is delivered once and removed — no one else will see it.`, {
        ...c,
        queueConsumed: c.queueConsumed + 1,
      });
    });
  }

  function groupARead() {
    setS((c) => {
      if (c.groupA >= c.produced) return push("group A is caught up — no new events.", c);
      const id = c.groupA;
      return push(`log: group A reads e${id} and advances its offset. The event stays on the log.`, {
        ...c,
        groupA: c.groupA + 1,
      });
    });
  }

  function addGroupB() {
    setS((c) => {
      if (c.groupB !== null) return c;
      return push("log: group B subscribes. It gets its own offset starting at 0 — the full history is still there.", {
        ...c,
        groupB: 0,
      });
    });
  }

  function groupBRead() {
    setS((c) => {
      if (c.groupB === null || c.groupB >= c.produced) return push("group B is caught up — no new events.", c);
      const id = c.groupB;
      return push(`log: group B reads e${id}, independently of group A.`, { ...c, groupB: c.groupB + 1 });
    });
  }

  function resetGroupA() {
    setS((c) =>
      push("log: group A's offset is reset to 0. It will re-read every event — replay costs nothing.", {
        ...c,
        groupA: 0,
      }),
    );
  }

  function reset() {
    setS(initial);
  }

  const events = Array.from({ length: s.produced }, (_, i) => i);
  const queueRemaining = events.slice(s.queueConsumed);

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="wk-queuelog-demo">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · queue vs. retained log
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real queues and Kafka both have far more nuance (visibility timeouts,
        partitions, retention limits). What carries over: a queue delivers each message once and forgets it; a
        Kafka topic keeps events so any number of consumer groups can read — and re-read — them.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={produce}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
        >
          produce event →
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border-soft bg-bg-inset p-3" data-testid="wk-queuelog-queue">
          <div className="mb-2 font-mono text-[12px] text-text">message queue</div>
          <div className="mb-2 flex min-h-[3rem] flex-wrap gap-1">
            {queueRemaining.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
            {queueRemaining.map((id) => (
              <span key={id} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
                e{id}
              </span>
            ))}
          </div>
          <div className="mb-2 font-mono text-[10px] text-text-faint">
            {s.queueConsumed} consumed &amp; gone
          </div>
          <button
            onClick={queueConsume}
            className="rounded border border-border-soft px-2 py-1 font-mono text-[10px] text-text-muted hover:border-stream/50 hover:text-stream"
          >
            worker: consume next
          </button>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-faint">
            No second reader, no replay — a consumed message is gone.
          </p>
        </div>

        <div className="rounded-md border border-border-soft bg-bg-inset p-3" data-testid="wk-queuelog-log">
          <div className="mb-2 font-mono text-[12px] text-text">kafka topic (1 partition)</div>
          <div className="mb-2 flex min-h-[3rem] flex-wrap gap-1">
            {events.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
            {events.map((id) => (
              <span key={id} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
                e{id}
              </span>
            ))}
          </div>
          <div className="mb-2 flex flex-col gap-0.5 font-mono text-[10px] text-text-faint">
            <span data-testid="wk-queuelog-groupA">group A offset: {s.groupA}</span>
            <span data-testid="wk-queuelog-groupB">
              group B offset: {s.groupB === null ? "not subscribed" : s.groupB}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={groupARead}
              className="rounded border border-border-soft px-2 py-1 font-mono text-[10px] text-text-muted hover:border-stream/50 hover:text-stream"
            >
              group A: read next
            </button>
            <button
              onClick={resetGroupA}
              className="rounded border border-border-soft px-2 py-1 font-mono text-[10px] text-text-muted hover:border-accent/50 hover:text-accent"
            >
              group A: reset to 0
            </button>
            {s.groupB === null ? (
              <button
                onClick={addGroupB}
                className="rounded border border-border-soft px-2 py-1 font-mono text-[10px] text-text-muted hover:border-accent/50 hover:text-accent"
              >
                + add group B
              </button>
            ) : (
              <button
                onClick={groupBRead}
                className="rounded border border-border-soft px-2 py-1 font-mono text-[10px] text-text-muted hover:border-stream/50 hover:text-stream"
              >
                group B: read next
              </button>
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-faint">
            Every group reads all events, at its own pace, and can rewind.
          </p>
        </div>
      </div>

      <div
        className="mt-4 rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
        data-testid="wk-queuelog-logfeed"
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
