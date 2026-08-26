"use client";

import { useState } from "react";

interface LogEntry {
  offset: number;
  seq: number;
}

export default function IdempotenceDemo() {
  const [idempotent, setIdempotent] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextSeq, setNextSeq] = useState(0);
  const [log, setLog] = useState<string[]>(["waiting to produce a record."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function send() {
    const seq = nextSeq;
    setEntries((e) => [...e, { offset: e.length, seq }]);
    setNextSeq(seq + 1);
    pushLog(`record sent (seq=${seq}), ack received.`);
  }

  function retry() {
    if (entries.length === 0) return;
    const seq = nextSeq - 1;
    if (idempotent) {
      pushLog(`ack lost in transit, producer retries seq=${seq} — broker already has this sequence number, discarded as a duplicate.`);
      return;
    }
    setEntries((e) => [...e, { offset: e.length, seq }]);
    pushLog(`ack lost in transit, producer retries seq=${seq} — no idempotence, so the broker has no way to detect this is a retry. Appended again.`);
  }

  function reset() {
    setIdempotent(true);
    setEntries([]);
    setNextSeq(0);
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
        Simplified for teaching — real idempotence tracks a producer ID and per-partition sequence number issued by
        the broker, not a plain incrementing counter. What carries over: a retry after a lost ack carries the same
        sequence number as the original send, which is exactly what lets the broker recognize it as a duplicate.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIdempotent((v) => !v)}
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
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
        >
          produce record →
        </button>
        <button
          onClick={retry}
          disabled={entries.length === 0}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-danger/50 hover:text-danger disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted sm:ml-auto"
        >
          ack lost, producer retries →
        </button>
      </div>

      <div data-testid="partition-log" className="rounded-md border border-border-soft bg-bg-inset p-3">
        <div className="mb-2 font-mono text-sm text-text">partition-0</div>
        <div className="flex min-h-[3rem] flex-col gap-1">
          {entries.length === 0 && <span className="font-mono text-[11px] text-text-faint">(empty)</span>}
          {entries.map((e, i) => (
            <div key={i} className="rounded bg-bg-elevated px-2 py-1 font-mono text-[11px] text-text-muted">
              offset {e.offset} · seq={e.seq}
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
