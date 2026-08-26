"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Scenario = "buffer" | "oversize" | "timeout";

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "buffer", label: "fill the buffer" },
  { id: "oversize", label: "oversized record" },
  { id: "timeout", label: "delivery timeout" },
];

const BUFFER_SLOTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const DELIVERY_TIMEOUT_MS = 120_000;

export default function BufferAndTimeoutDemo() {
  const [scenario, setScenario] = useState<Scenario>("buffer");

  // buffer.memory / max.block.ms
  const [used, setUsed] = useState(0);
  const [blockedSend, setBlockedSend] = useState(false);
  const [timedOutBlock, setTimedOutBlock] = useState(false);
  const [bufferLog, setBufferLog] = useState<string[]>(["buffer empty (0/5)."]);

  // max.request.size
  const [sizeResult, setSizeResult] = useState<{ oversized: boolean } | null>(null);
  const [sizeLog, setSizeLog] = useState<string[]>(["waiting to send a record."]);

  // delivery.timeout.ms
  const [attempts, setAttempts] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [deliveryOutcome, setDeliveryOutcome] = useState<"delivered" | "timed-out" | null>(null);
  const [deliveryLog, setDeliveryLog] = useState<string[]>(["record queued for delivery."]);

  function push(setter: (fn: (l: string[]) => string[]) => void, line: string) {
    setter((l) => [line, ...l].slice(0, 5));
  }

  function produceIntoBuffer() {
    if (used < BUFFER_SLOTS) {
      setUsed((u) => u + 1);
      push(setBufferLog, `record buffered (${used + 1}/${BUFFER_SLOTS}).`);
      return;
    }
    setBlockedSend(true);
    push(setBufferLog, "buffer full — send() is blocking, waiting for room (up to max.block.ms).");
  }

  function drainBuffer() {
    if (used === 0) return;
    if (blockedSend) {
      setBlockedSend(false);
      push(setBufferLog, "broker acknowledged a batch, freeing a slot — the blocked send() completed immediately.");
      return;
    }
    setUsed((u) => u - 1);
    push(setBufferLog, `broker acknowledged a batch — buffer now ${used - 1}/${BUFFER_SLOTS}.`);
  }

  function blockTimeout() {
    setBlockedSend(false);
    setTimedOutBlock(true);
    push(setBufferLog, "max.block.ms elapsed while blocked — send() throws TimeoutException. The record was never sent.");
  }

  function resetBuffer() {
    setUsed(0);
    setBlockedSend(false);
    setTimedOutBlock(false);
    setBufferLog(["buffer empty (0/5)."]);
  }

  function sendNormal() {
    setSizeResult({ oversized: false });
    push(setSizeLog, "2KB record accepted and batched normally.");
  }

  function sendOversized() {
    setSizeResult({ oversized: true });
    push(
      setSizeLog,
      "2MB record exceeds max.request.size (1MB) — rejected immediately by send(), before batching or any network call.",
    );
  }

  function resetSize() {
    setSizeResult(null);
    setSizeLog(["waiting to send a record."]);
  }

  function retryAttempt() {
    if (deliveryOutcome) return;
    const nextElapsed = elapsedMs + REQUEST_TIMEOUT_MS;
    setAttempts((a) => a + 1);
    setElapsedMs(nextElapsed);
    if (nextElapsed >= DELIVERY_TIMEOUT_MS) {
      setDeliveryOutcome("timed-out");
      push(
        setDeliveryLog,
        `delivery.timeout.ms (${DELIVERY_TIMEOUT_MS}ms) exceeded after ${attempts + 1} attempts — the producer gives up and surfaces a TimeoutException, even though it could technically keep retrying.`,
      );
      return;
    }
    push(setDeliveryLog, `attempt ${attempts + 1}: broker still unreachable after request.timeout.ms (${REQUEST_TIMEOUT_MS}ms). Retrying.`);
  }

  function brokerRecovers() {
    if (deliveryOutcome) return;
    setDeliveryOutcome("delivered");
    push(setDeliveryLog, `broker responded before delivery.timeout.ms elapsed — record delivered successfully after ${attempts} attempt(s).`);
  }

  function resetDelivery() {
    setAttempts(0);
    setElapsedMs(0);
    setDeliveryOutcome(null);
    setDeliveryLog(["record queued for delivery."]);
  }

  function resetAll() {
    resetBuffer();
    resetSize();
    resetDelivery();
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · producer-side failures
        </div>
        <button
          onClick={resetAll}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real buffer.memory and max.request.size are byte limits, not the 5-slot buffer and
        fixed 1MB/2MB record sizes used here. What carries over: whether a failure surfaces as blocking backpressure,
        a synchronous rejection, or a delayed timeout depends on which of these three limits is hit.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScenario(s.id)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              scenario === s.id
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scenario === "buffer" && (
        <div data-testid="scenario-buffer">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              onClick={produceIntoBuffer}
              disabled={blockedSend || timedOutBlock}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
            >
              produce record →
            </button>
            <button
              onClick={drainBuffer}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success"
            >
              broker acks a batch (drain)
            </button>
            {blockedSend && (
              <button
                onClick={blockTimeout}
                className="rounded border border-danger/50 bg-danger-soft px-3 py-1.5 font-mono text-[11px] text-danger hover:border-danger"
              >
                wait past max.block.ms →
              </button>
            )}
          </div>

          {blockedSend && (
            <div className="mb-3">
              <Badge tone="neutral">send() blocked — waiting for buffer space</Badge>
            </div>
          )}
          {timedOutBlock && (
            <div className="mb-3">
              <Badge tone="danger">TimeoutException</Badge>
            </div>
          )}

          <div className="mb-3 flex gap-1.5" data-testid="buffer-gauge">
            {Array.from({ length: BUFFER_SLOTS }).map((_, i) => (
              <div
                key={i}
                className={`h-6 w-6 rounded border ${i < used ? "border-accent/50 bg-accent-soft" : "border-border-soft bg-bg-inset"}`}
              />
            ))}
          </div>

          <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
            {bufferLog.map((line, i) => (
              <div key={i} className={i === 0 ? "text-text" : ""}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenario === "oversize" && (
        <div data-testid="scenario-oversize">
          <div className="mb-3 flex flex-wrap gap-3">
            <button
              onClick={sendNormal}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
            >
              send normal record (2KB) →
            </button>
            <button
              onClick={sendOversized}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger"
            >
              send oversized record (2MB) →
            </button>
          </div>

          {sizeResult && (
            <div className="mb-3">
              <Badge tone={sizeResult.oversized ? "danger" : "success"}>
                {sizeResult.oversized ? "RecordTooLargeException" : "accepted"}
              </Badge>
            </div>
          )}

          <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
            {sizeLog.map((line, i) => (
              <div key={i} className={i === 0 ? "text-text" : ""}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenario === "timeout" && (
        <div data-testid="scenario-timeout">
          <div className="mb-3 flex flex-wrap gap-3">
            <button
              onClick={retryAttempt}
              disabled={deliveryOutcome !== null}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
            >
              retry attempt (broker still down) →
            </button>
            <button
              onClick={brokerRecovers}
              disabled={deliveryOutcome !== null}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-success/50 hover:text-success disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
            >
              broker recovers, ack received →
            </button>
          </div>

          {deliveryOutcome && (
            <div className="mb-3">
              <Badge tone={deliveryOutcome === "delivered" ? "success" : "danger"}>
                {deliveryOutcome === "delivered" ? "delivered" : "TimeoutException"}
              </Badge>
            </div>
          )}

          <div className="mb-3 font-mono text-[11px] text-text-faint">
            elapsed: {elapsedMs}ms / {DELIVERY_TIMEOUT_MS}ms delivery.timeout.ms budget ({attempts} attempt
            {attempts === 1 ? "" : "s"})
          </div>

          <div className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted">
            {deliveryLog.map((line, i) => (
              <div key={i} className={i === 0 ? "text-text" : ""}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
