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
        ? "poll() returned records 0–2. Policy: process all three records, then commit offset 3."
        : "poll() returned records 0–2. Policy: commit offset 3 first, then process the records.",
    ]);
  }

  // The commit-order policy is enforced by the buttons: in "after" mode you can't commit
  // until every record is processed; in "before" mode you can't process until you've
  // committed.
  const canProcess = phase === "processing" && processed < BATCH_SIZE && (commitPoint === "after" || committed === BATCH_SIZE);
  const canCommit = phase === "processing" && committed !== BATCH_SIZE && (commitPoint === "before" || processed === BATCH_SIZE);

  function processOne() {
    if (!canProcess) return;
    const n = processed + 1;
    setProcessed(n);
    pushLog(`processed record ${n - 1}.`);
  }

  function commit() {
    if (!canCommit) return;
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
    const redelivered = BATCH_SIZE - committed;
    const duplicates = Math.max(0, processed - committed);
    const firstTime = redelivered - duplicates;
    const skipped = Math.max(0, committed - processed);

    if (skipped > 0) {
      pushLog(
        `new owner resumes at committed offset ${committed}. Records ${processed}–${committed - 1} were committed but never processed — silently skipped (at-most-once).`,
      );
    } else if (redelivered === 0) {
      pushLog(`new owner resumes at committed offset ${committed} — nothing to redeliver, clean handoff.`);
    } else {
      const dupPart = duplicates > 0 ? `${duplicates} already processed by the crashed consumer (duplicate${duplicates === 1 ? "" : "s"})` : null;
      const newPart = firstTime > 0 ? `${firstTime} never processed before` : null;
      const breakdown = [dupPart, newPart].filter(Boolean).join(", ");
      pushLog(
        `new owner resumes at committed offset ${committed}. Records ${committed}–${BATCH_SIZE - 1} are redelivered — ${breakdown}. At-least-once means the duplicates get processed twice.`,
      );
    }
  }

  function reset() {
    configure(commitPoint);
  }

  const redelivered = BATCH_SIZE - committed;
  const duplicates = Math.max(0, processed - committed);
  const skipped = phase === "recovered" ? Math.max(0, committed - processed) : 0;

  let badge: { tone: "success" | "danger" | "neutral"; label: string } | null = null;
  if (phase === "recovered") {
    if (skipped > 0) badge = { tone: "danger", label: `${skipped} record${skipped === 1 ? "" : "s"} skipped` };
    else if (redelivered === 0) badge = { tone: "success", label: "clean handoff" };
    else badge = { tone: "neutral", label: `${redelivered} redelivered · ${duplicates} duplicate${duplicates === 1 ? "" : "s"}` };
  }

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
        position. Redelivered records aren&apos;t all &quot;reprocessed&quot; — only the ones the crashed consumer
        had already finished are true duplicates; the rest are being delivered for the first time.
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
          disabled={!canProcess}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
        >
          process one record →
        </button>
        <button
          onClick={commit}
          disabled={!canCommit}
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

      {badge && (
        <div className="mb-4">
          <Badge tone={badge.tone}>{badge.label}</Badge>
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
