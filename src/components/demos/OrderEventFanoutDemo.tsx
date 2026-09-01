"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

const BASE_CONSUMERS = ["billing", "email", "warehouse", "analytics"] as const;

interface State {
  published: boolean;
  // committed offset per consumer: 0 = hasn't read the event, 1 = has
  offsets: Record<string, number>;
  loyaltyAdded: boolean;
  log: string[];
}

const initial: State = {
  published: false,
  offsets: Object.fromEntries(BASE_CONSUMERS.map((c) => [c, 0])),
  loyaltyAdded: false,
  log: ["checkout has not published anything yet."],
};

export default function OrderEventFanoutDemo() {
  const [s, setS] = useState<State>(initial);

  const consumers = s.loyaltyAdded ? [...BASE_CONSUMERS, "loyalty"] : [...BASE_CONSUMERS];

  function push(line: string, next: State): State {
    return { ...next, log: [line, ...next.log].slice(0, 7) };
  }

  function publish() {
    if (s.published) return;
    setS((c) =>
      push(
        "checkout appends one order-placed event to topic \"orders\" — offset 0. It does not call anyone.",
        { ...c, published: true },
      ),
    );
  }

  function poll(consumer: string) {
    setS((c) => {
      if (!c.published || c.offsets[consumer] >= 1) return c;
      const offsets = { ...c.offsets, [consumer]: 1 };
      return push(`${consumer} polls topic "orders", reads offset 0, and reacts — independently of the others.`, {
        ...c,
        offsets,
      });
    });
  }

  function addLoyalty() {
    setS((c) => {
      if (c.loyaltyAdded) return c;
      return push(
        "a new loyalty service subscribes to \"orders\". It starts at offset 0 and can read the whole history — checkout's code never changed.",
        { ...c, loyaltyAdded: true, offsets: { ...c.offsets, loyalty: 0 } },
      );
    });
  }

  function reset() {
    setS(initial);
  }

  const allRead = s.published && consumers.every((c) => s.offsets[c] >= 1);

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="wk-fanout-demo">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · one event, many readers
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — a real pipeline has many events, more partitions, and consumer groups rather
        than lone consumers. What carries over: the producer publishes once and doesn&apos;t know its readers;
        each consumer tracks its own position; adding one needs no change to the producer and can replay from
        the start (it does add its own infrastructure and load on the brokers).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={publish}
          disabled={s.published}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:opacity-40"
        >
          checkout: publish order-placed →
        </button>
        <button
          onClick={addLoyalty}
          disabled={s.loyaltyAdded}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
        >
          + add loyalty service
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="wk-fanout-consumers">
        {consumers.map((c) => {
          const read = s.offsets[c] >= 1;
          return (
            <div
              key={c}
              data-testid={`wk-fanout-${c}`}
              className="flex items-center justify-between rounded-md border border-border-soft bg-bg-inset px-3 py-2"
            >
              <span className="font-mono text-[12px] text-text">{c}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-faint">offset {s.offsets[c]}</span>
                <button
                  onClick={() => poll(c)}
                  disabled={!s.published || read}
                  className="rounded border border-border-soft px-2 py-0.5 font-mono text-[10px] text-text-muted hover:border-stream/50 hover:text-stream disabled:opacity-40"
                >
                  {read ? "reacted" : "poll"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {allRead && (
        <div className="mb-4" data-testid="wk-fanout-verdict">
          <Badge tone="success">every downstream reacted to the same event</Badge>
        </div>
      )}

      <div
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
        data-testid="wk-fanout-log"
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
