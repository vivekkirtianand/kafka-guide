"use client";

import { useId, useState } from "react";
import { TopicDetail } from "@/lib/types";

// The trailing "(acks, enable.idempotence, …)" in a topic string duplicates the
// config chips, so drop it from the displayed heading.
function cleanTitle(topic: string): string {
  return topic.replace(/\s*\([^)]*\)\s*$/, "");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConfigChips({ configs }: { configs: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {configs.map((c) => (
        <span
          key={c}
          className="inline-flex rounded border border-border-soft bg-bg-inset px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function TopicRow({
  index,
  topic,
  detail,
  open,
  onToggle,
}: {
  index: number;
  topic: string;
  detail: TopicDetail;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const title = cleanTitle(topic);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-elevated">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-1 shrink-0 font-mono text-[11px] text-text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-text">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex w-full items-center gap-2 rounded text-left transition-colors hover:text-accent"
            >
              <span className="min-w-0 flex-1">{title}</span>
              <Chevron open={open} />
            </button>
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{detail.summary}</p>
          {detail.configs && detail.configs.length > 0 && <ConfigChips configs={detail.configs} />}
        </div>
      </div>

      {open && (
        <div id={panelId} role="region" aria-label={title} className="border-t border-border-soft px-4 py-4">
          <dl className="flex flex-col gap-3">
            {detail.points.map((p) => (
              <div key={p.term} className="flex flex-col gap-0.5">
                <dt className="font-mono text-[12px] text-accent">{p.term}</dt>
                <dd className="text-sm leading-relaxed text-text-muted">{p.detail}</dd>
              </div>
            ))}
          </dl>

          {detail.watchOut && (
            <div className="mt-4 rounded-md border border-border-soft border-l-2 border-l-danger bg-danger-soft px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-danger">Watch out</span>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{detail.watchOut}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopicExplorer({
  topics,
  detail,
}: {
  topics: string[];
  detail: Record<string, TopicDetail>;
}) {
  // Only the topics we actually have structured content for, in list order.
  const entries = topics.filter((t) => detail[t]);
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([0]));

  const allOpen = entries.length > 0 && openSet.size === entries.length;

  function toggle(i: number) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setOpenSet(allOpen ? new Set() : new Set(entries.map((_, i) => i)));
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-text">Topics</h2>
        <button
          type="button"
          onClick={toggleAll}
          className="rounded font-mono text-[11px] text-text-faint transition-colors hover:text-accent"
        >
          {allOpen ? "collapse all" : "expand all"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {entries.map((topic, i) => (
          <TopicRow
            key={topic}
            index={i}
            topic={topic}
            detail={detail[topic]}
            open={openSet.has(i)}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>
    </div>
  );
}
