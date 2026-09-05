"use client";

import { useId, useState } from "react";
import { Difficulty, TopicDetail } from "@/lib/types";
import { renderGlossaryText } from "./GlossaryTerm";
import Badge from "./Badge";

// Matches the module-level difficulty tones in ModuleMeta so a topic badge reads the same
// as its module's badge.
const LEVEL_TONE: Record<Difficulty, "success" | "stream" | "accent"> = {
  beginner: "success",
  intermediate: "stream",
  advanced: "accent",
};

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

// A topic string with no entry in `topicDetail` — render the raw title so a
// missing or mistyped key is visible rather than silently dropping the topic.
function TopicStub({ index, topic }: { index: number; topic: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 font-mono text-[11px] text-text-faint">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="font-display text-base text-text-muted">{topic}</h3>
      </div>
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
  const buttonId = useId();
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
              id={buttonId}
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
          {detail.level && (
            <div className="mt-1.5">
              <Badge tone={LEVEL_TONE[detail.level]}>{detail.level}</Badge>
            </div>
          )}
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{renderGlossaryText(detail.summary)}</p>
          {detail.configs && detail.configs.length > 0 && <ConfigChips configs={detail.configs} />}
        </div>
      </div>

      {/*
        Panel stays mounted and is hidden with `hidden` when collapsed, so the
        button's `aria-controls` always points at a real element. `role="region"`
        is deliberately omitted — an accordion with more than ~6 panels would
        flood the landmark list (WAI-ARIA APG).
      */}
      <div
        id={panelId}
        aria-labelledby={buttonId}
        hidden={!open}
        className="border-t border-border-soft px-4 py-4"
      >
        {detail.preface && (
          <div className="mb-4 rounded-md border border-border-soft border-l-2 border-l-accent bg-accent-soft px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-accent">In plain terms</span>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{renderGlossaryText(detail.preface)}</p>
          </div>
        )}

        <dl className="flex flex-col gap-3">
          {detail.points.map((p) => (
            <div key={p.term} className="flex flex-col gap-0.5">
              <dt className="font-mono text-[12px] text-accent">{p.term}</dt>
              <dd className="text-sm leading-relaxed text-text-muted">{renderGlossaryText(p.detail)}</dd>
            </div>
          ))}
        </dl>

        {detail.watchOut && (
          <div className="mt-4 rounded-md border border-border-soft border-l-2 border-l-danger bg-danger-soft px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-danger">Watch out</span>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{renderGlossaryText(detail.watchOut)}</p>
          </div>
        )}
      </div>
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
  // Topics that actually have structured content, keyed by the topic string.
  const expandable = topics.filter((t) => detail[t]);
  const [openTopics, setOpenTopics] = useState<Set<string>>(
    () => new Set(expandable.length > 0 ? [expandable[0]] : []),
  );

  const allOpen = expandable.length > 0 && expandable.every((t) => openTopics.has(t));

  function toggle(topic: string) {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function toggleAll() {
    setOpenTopics(allOpen ? new Set() : new Set(expandable));
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-text">Topics</h2>
        {expandable.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="rounded font-mono text-[11px] text-text-faint transition-colors hover:text-accent"
          >
            {allOpen ? "collapse all" : "expand all"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {topics.map((topic, i) =>
          detail[topic] ? (
            <TopicRow
              key={topic}
              index={i}
              topic={topic}
              detail={detail[topic]}
              open={openTopics.has(topic)}
              onToggle={() => toggle(topic)}
            />
          ) : (
            <TopicStub key={topic} index={i} topic={topic} />
          ),
        )}
      </div>
    </div>
  );
}
