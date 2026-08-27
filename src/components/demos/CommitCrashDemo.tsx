"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

// A single batch of 3 records (offsets 0–2) has been returned by poll(). The demo is about
// the order of two events: committing offset 3, and the consumer crashing.
const BATCH_SIZE = 3;

type CommitPoint = "after" | "before";
type Phase = "processing" | "crashed" | "recovered";

export default function CommitCrashDemo() {
  const [commitPoint, setCommitPoint] = useState<CommitPoint>("after");
  const [processed, setProcessed] = useState(0); // records fully processed in this batch
  const [committed, setCommitted] = useState(0); // durable offset
  const [phase, setPhase] = useState<Phase>("processing");
  const [log, setLog] = useState<string[]>(["poll() returned records 0–2. Not yet processed."]);

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 6));
  }

  function configure(cp: CommitPoint) {
    setCommitPoint(cp);
    setProcessed(0);
    setCommitted(0);
    setPhase("processing");
    setLog([
      cp === "after"
        ? "poll() returned records 0–2. Plan: process each record, then commit offset 3."
        : "poll() returned records 0–2. Plan: commit offset 3 first, then process each record.",
    ]);
  }

  function processOne() {
    if (phase !== "processing" || processed >= BATCH_SIZE) return;
    const n = processed + 1;
    setProcessed(n);
    pushLog(`processed record ${n - 1}.`);
  }

  function commit() {
    if (phase !== "processing" || committed === BATCH_SIZE) return;
    setCommitted(BATCH_SIZE);
    pushLog(`committed offset ${BATCH_SIZE} — the group's durable bookmark now says records 0–2 are done.`);
  }

  function crash() {
    if (phase !== "processing") return;
    setPhase("crashed");
    pushLog(`consumer crashed after processing ${processed} of ${BATCH_SIZE} records, with committed offset at ${committed}.`);
  }

  function recover() {
    if (phase !== "crashed") return;
    setPhase("recovered");
    const replay = BATCH_SIZE - committed;
    const skipped = Math.max(0, committed - processed);
    if (skipped > 0) {
      pushLog(
        `new owner resumes at committed offset ${committed}. Records ${processed}–${committed - 1} were committed but never processed — silently skipped (at-most-once).`,
      );
    } else if (replay > 0) {
      pushLog(
        `new owner resumes at committed offset ${committed}. Records ${committed}–${BATCH_SIZE - 1} are delivered again — ${replay} record${replay === 1 ? "" : "s"} reprocessed (at-least-once).`,
      );
    } else {
      pushLog(`new owner resumes at committed offset ${committed} — nothing to replay, clean handoff.`);
    }
  }

  function reset() {
    configure(commitPoint);
  }

  const replay = BATCH_SIZE - committed;
  const skipped = phase === "recovered" ? Math.max(0, committed - processed) : 0;

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · crashing before vs. after a commit
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — a real crash is abrupt and a real batch is larger. What carries over: a new owner
        of the partition always resumes from the committed offset, never from the crashed consumer&apos;s in-memory
        position. Commit after processing and a crash reprocesses; commit before processing and a crash skips.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["after", "before"] as CommitPoint[]).map((cp) => (
          <button
            key={cp}
            onClick={() => configure(cp)}
            className={`rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              commitPoint === cp
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-border-soft bg-bg-inset text-text-muted hover:border-accent/40"
            }`}
          >
            commit {cp} processing
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={processOne}
          disabled={phase !== "processing" || processed >= BATCH_SIZE}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          process one record →
        </button>
        <button
          onClick={commit}
          disabled={phase !== "processing" || committed === BATCH_SIZE}
          className="rounded border border-success/50 bg-success-soft px-3 py-1.5 font-mono text-[11px] text-success hover:border-success disabled:cursor-default disabled:opacity-40"
        >
          commit offset 3 →
        </button>
        <button
          onClick={crash}
          disabled={phase !== "processing"}
          className="rounded border border-danger/50 bg-danger-soft px-3 py-1.5 font-mono text-[11px] text-danger hover:border-danger disabled:cursor-default disabled:opacity-40"
        >
          crash consumer →
        </button>
        {phase === "crashed" && (
          <button
            onClick={recover}
            className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
          >
            another consumer takes over →
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">records processed</div>
          <div data-testid="processed-count" className="font-mono text-lg text-text">{processed} / {BATCH_SIZE}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">committed offset</div>
          <div data-testid="committed-offset" className="font-mono text-lg text-text">{committed}</div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg-inset p-3">
          <div className="font-mono text-[11px] text-text-faint">phase</div>
          <div className="font-mono text-lg text-text">{phase}</div>
        </div>
      </div>

      {phase === "recovered" && (
        <div className="mb-4">
          <Badge tone={skipped > 0 ? "danger" : replay > 0 ? "neutral" : "success"}>
            {skipped > 0
              ? `${skipped} record${skipped === 1 ? "" : "s"} skipped`
              : replay > 0
                ? `${replay} record${replay === 1 ? "" : "s"} reprocessed`
                : "clean handoff"}
          </Badge>
        </div>
      )}

      <div
        data-testid="crash-log"
        className="rounded-md border border-border-soft bg-bg-inset p-3 font-mono text-[11px] leading-relaxed text-text-muted"
      >
        {log.map((line, i) => (
          <div key={i} className={i === 0 ? "text-text" : ""}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
