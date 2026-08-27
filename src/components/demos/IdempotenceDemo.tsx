"use client";

import { useState } from "react";

interface LogEntry {
  offset: number;
  // Sequence numbers are part of the idempotent-producer protocol itself — a
  // non-idempotent send never has one, not just an unused one.
  seq: number | null;
}

interface Pending {
  seq: number | null;
  // Set once the user picks "ack lost in transit": the write already reached the
  // broker (it's in `entries`), but the producer doesn't know that yet and must
  // decide whether to retry.
  ambiguous: boolean;
}

export default function IdempotenceDemo() {
  const [idempotent, setIdempotent] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextSeq, setNextSeq] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [log, setLog] = useState<string[]>(["waiting to produce a record."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  // enable.idempotence is set when a producer is constructed — it can't be flipped on a
  // live producer. Toggling it here simulates recreating the producer: a new producer ID
  // and a fresh sequence space starting back at 0. That resets producer-scoped state only
  // — it says nothing about the broker's partition log, which is exactly why a recreated
  // producer's first send can carry the same sequence number as an old entry already in
  // `entries` without colliding: the broker keys duplicate detection on (producer ID,
  // sequence), and this is a different producer ID.
  function toggleIdempotent() {
    setIdempotent((v) => !v);
    setNextSeq(0);
    setPending(null);
    pushLog("producer recreated with the new setting — new producer identity, sequence numbers restart at 0. Existing broker data is untouched.");
  }

  function send() {
    if (pending) return;
    const seq = idempotent ? nextSeq : null;
    setPending({ seq, ambiguous: false });
    pushLog(seq !== null ? `record sent (seq=${seq}) — outcome not yet known.` : "record sent — outcome not yet known.");
  }

  function ackReceived() {
    if (!pending || pending.ambiguous) return;
    setEntries((e) => [...e, { offset: e.length, seq: pending.seq }]);
    if (pending.seq !== null) setNextSeq(pending.seq + 1);
    setPending(null);
    pushLog(pending.seq !== null ? `ack received for seq=${pending.seq} — write confirmed.` : "ack received — write confirmed.");
  }

  function ackLost() {
    if (!pending || pending.ambiguous) return;
    // Ground truth: the write actually reached the broker. Only the acknowledgment
    // failed to make it back — the producer has no way to tell that from a plain retry.
    setEntries((e) => [...e, { offset: e.length, seq: pending.seq }]);
    setPending({ ...pending, ambiguous: true });
    pushLog(
      pending.seq !== null
        ? `ack lost in transit for seq=${pending.seq} — the write actually reached the broker, but the producer doesn't know that. It must decide whether to retry.`
        : "ack lost in transit — the write actually reached the broker, but the producer doesn't know that. It must decide whether to retry.",
    );
  }

  function retry() {
    if (!pending || !pending.ambiguous) return;
    if (pending.seq !== null) {
      setNextSeq(pending.seq + 1);
      setPending(null);
      pushLog(`retry with seq=${pending.seq} arrives — broker already has this sequence number for this producer, discarded as a duplicate. Outcome now confirmed safe.`);
      return;
    }
    setEntries((e) => [...e, { offset: e.length, seq: null }]);
    setPending(null);
    pushLog("retry arrives — without a sequence-number protocol, the broker can't tell this apart from a new record. Appended again as a duplicate.");
  }

  function reset() {
    setIdempotent(true);
    setEntries([]);
    setNextSeq(0);
    setPending(null);
    setLog(["waiting to produce a record."]);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · idempotence and duplicates
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — real idempotence has the producer request a producer ID from the broker once, then
        the producer itself attaches an incrementing per-partition sequence number to each batch it sends (the
        broker issues the producer ID, not the sequence number). Toggling the setting below simulates recreating
        the producer entirely, since enable.idempotence is fixed at construction time. What carries over: the broker
        can only recognize a retry as a duplicate because it carries the same sequence number as the original send —
        which requires idempotence to exist in the first place.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleIdempotent}
          className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
            idempotent
              ? "border-success/50 bg-success-soft text-success"
              : "border-danger/50 bg-danger-soft text-danger"
          }`}
        >
          enable.idempotence={String(idempotent)}
        </button>
        <button
          onClick={send}
          disabled={pending !== null}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          produce record →
        </button>

        {pending && !pending.ambiguous && (
          <>
            <button
              onClick={ackReceived}
              className="rounded border border-success/50 bg-success-soft px-3 py-1.5 font-mono text-[11px] text-success hover:border-success"
            >
              ack received normally →
            </button>
            <button
              onClick={ackLost}
              className="rounded border border-danger/50 bg-danger-soft px-3 py-1.5 font-mono text-[11px] text-danger hover:border-danger sm:ml-auto"
            >
              ack lost in transit →
            </button>
          </>
        )}

        {pending?.ambiguous && (
          <button
            onClick={retry}
            className="rounded border border-danger/50 bg-danger-soft px-3 py-1.5 font-mono text-[11px] text-danger hover:border-danger sm:ml-auto"
          >
            producer retries →
          </button>
        )}
      </div>

      <div data-testid="partition-log" className="rounded-md border border-border-soft bg-bg-inset p-3">
        <div className="mb-2 font-mono text-sm text-text">partition-0</div>
        <div className="flex min-h-[3rem] flex-col gap-1">
          {entries.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
          {entries.map((e, i) => (
            <div key={i} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
              offset {e.offset}
              {e.seq !== null ? ` · seq=${e.seq}` : ""}
            </div>
          ))}
        </div>
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
