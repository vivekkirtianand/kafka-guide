"use client";

import { useState } from "react";
import Badge from "@/components/Badge";

type Role = "key" | "value" | "timestamp" | "headers";

const ROLES: Role[] = ["key", "value", "timestamp", "headers"];

const ROLE_NOTE: Record<Role, string> = {
  key: "picks the partition and groups related events so they stay ordered",
  value: "the payload — what actually happened; Kafka stores it as opaque bytes",
  timestamp: "when the event happened (or when the broker stored it)",
  headers: "optional side metadata — trace ids, schema version, source — not used for routing",
};

interface Part {
  label: string;
  display: string;
  role: Role;
}

interface Sample {
  name: string;
  parts: Part[];
}

const SAMPLES: Sample[] = [
  {
    name: "order-placed",
    parts: [
      { label: "A", display: '"order-5591"', role: "key" },
      { label: "B", display: '{ "customerId": "c-42", "total": 79.90, "currency": "USD" }', role: "value" },
      { label: "C", display: "2026-09-01T14:03:22Z", role: "timestamp" },
      { label: "D", display: '{ "traceId": "abc-123", "schemaVersion": "2" }', role: "headers" },
    ],
  },
  {
    name: "sensor-reading",
    parts: [
      { label: "A", display: '{ "celsius": 21.4, "humidity": 55 }', role: "value" },
      { label: "B", display: '"sensor-9"', role: "key" },
      { label: "C", display: '{ "gateway": "gw-3" }', role: "headers" },
      { label: "D", display: "2026-09-01T14:05:00Z", role: "timestamp" },
    ],
  },
];

export default function LabelTheEventDemo() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, Role>>({});
  const [checked, setChecked] = useState(false);

  const sample = SAMPLES[sampleIndex];
  const allPicked = sample.parts.every((p) => picks[p.label]);
  const score = sample.parts.filter((p) => picks[p.label] === p.role).length;

  function assign(label: string, role: Role) {
    if (checked) return;
    setPicks((p) => ({ ...p, [label]: role }));
  }

  function check() {
    if (allPicked) setChecked(true);
  }

  function nextSample() {
    setSampleIndex((i) => (i + 1) % SAMPLES.length);
    setPicks({});
    setChecked(false);
  }

  function reset() {
    setSampleIndex(0);
    setPicks({});
    setChecked(false);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-5" data-testid="wk-label-demo">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-wide text-text-faint">
          Interactive activity · label the event
        </div>
        <button
          onClick={reset}
          className="rounded border border-border px-2.5 py-1 font-mono text-[11px] text-text-muted hover:border-accent/50 hover:text-accent"
        >
          reset
        </button>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-text-faint">
        Simplified for teaching — on the wire these parts are bytes with a fixed record layout, and the key or
        headers can be absent. What carries over: every Kafka event is a key, a value, a timestamp, and
        optional headers, and each part has a distinct job.
      </p>

      <div className="mb-3 font-mono text-[11px] text-text-faint">
        event: {sample.name} — assign each part its role
      </div>

      <div className="mb-4 flex flex-col gap-2" data-testid="wk-label-parts">
        {sample.parts.map((part) => {
          const pick = picks[part.label];
          const right = checked && pick === part.role;
          const wrong = checked && pick !== part.role;
          return (
            <div
              key={part.label}
              data-testid={`wk-label-part-${part.label}`}
              className={`rounded-md border bg-bg-inset p-3 ${
                right ? "border-success/50" : wrong ? "border-danger/50" : "border-border-soft"
              }`}
            >
              <div className="mb-2 break-all font-mono text-[11px] text-text-muted">
                <span className="text-text-faint">{part.label}. </span>
                {part.display}
              </div>
              <div className="flex flex-wrap gap-1">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => assign(part.label, role)}
                    disabled={checked}
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      pick === role
                        ? "border-accent/50 bg-accent-soft text-accent"
                        : "border-border-soft bg-bg-elevated text-text-muted hover:border-accent/40"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {checked && (
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-faint">
                  <span className={right ? "text-success" : "text-danger"}>{part.role}</span> — {ROLE_NOTE[part.role]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          onClick={check}
          disabled={!allPicked}
          className="rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream disabled:opacity-40"
        >
          check answers
        </button>
      ) : (
        <div className="rounded-md border border-border-soft bg-bg-inset p-4" data-testid="wk-label-result">
          <Badge tone={score === sample.parts.length ? "success" : "accent"}>
            {score} / {sample.parts.length} correct
          </Badge>
          <button
            onClick={nextSample}
            className="ml-3 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-text-muted hover:border-stream/50 hover:text-stream"
          >
            next event →
          </button>
        </div>
      )}
    </div>
  );
}
