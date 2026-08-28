"use client";

import { useMemo, useState } from "react";
import { configs, configGoals, configScopes } from "@/lib/data/configs";
import { ChangeMechanism, ConfigEntry, DeploymentType, KafkaVersion, RiskLevel, configAvailable, getDefaultValue } from "@/lib/types";
import { useCluster } from "@/lib/context/ClusterContext";
import Badge from "./Badge";

const RISK_TONE: Record<RiskLevel, "success" | "accent" | "danger"> = {
  safe: "success",
  caution: "accent",
  "high-risk": "danger",
};

const MECHANISM_LABEL: Record<ChangeMechanism, string> = {
  "dynamic-cluster": "dynamic · cluster-wide",
  "topic-alter": "dynamic · per-topic",
  "recreate-client": "recreate client",
  "broker-restart": "broker restart",
};

export default function ConfigExplorer() {
  const { version, deployment } = useCluster();
  const [scope, setScope] = useState<string>("all");
  const [goal, setGoal] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return configs.filter((c) => {
      if (!configAvailable(c, version)) return false;
      if (scope !== "all" && c.scope !== scope) return false;
      if (goal !== "all" && c.goal !== goal) return false;
      if (query && !c.key.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [scope, goal, query, version]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by key…"
          className="w-52 rounded border border-border bg-bg-elevated px-3 py-1.5 font-mono text-xs text-text placeholder:text-text-faint outline-none focus:border-accent/60"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="rounded border border-border bg-bg-elevated px-2.5 py-1.5 font-mono text-xs text-text outline-none"
        >
          <option value="all">all scopes</option>
          {configScopes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="rounded border border-border bg-bg-elevated px-2.5 py-1.5 font-mono text-xs text-text outline-none"
        >
          <option value="all">all goals</option>
          {configGoals.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="ml-auto font-mono text-[11px] text-text-faint">
          {filtered.length} of {configs.filter((c) => configAvailable(c, version)).length}
        </span>
      </div>

      {deployment === "managed" && (
        <div className="mb-4 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 font-mono text-[11px] text-accent">
          Viewing as managed service: configs marked limited or unavailable below aren&apos;t exposed the same way
          as on a self-managed cluster.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <ConfigRow
            key={c.key}
            entry={c}
            version={version}
            deployment={deployment}
            open={expanded === c.key}
            onToggle={() => setExpanded(expanded === c.key ? null : c.key)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-faint">
            No configurations match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({
  entry,
  version,
  deployment,
  open,
  onToggle,
}: {
  entry: ConfigEntry;
  version: KafkaVersion;
  deployment: DeploymentType;
  open: boolean;
  onToggle: () => void;
}) {
  const limitedOnManaged = deployment === "managed" && entry.managedAvailability !== "full";

  return (
    <div className="rounded-lg border border-border bg-bg-elevated">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <span className="font-mono text-sm text-text">{entry.key}</span>
        <Badge tone="stream">{entry.scope}</Badge>
        <Badge tone={RISK_TONE[entry.riskOfChange]}>{entry.riskOfChange}</Badge>
        <Badge tone="neutral">{MECHANISM_LABEL[entry.changeMechanism]}</Badge>
        {limitedOnManaged && (
          <Badge tone={entry.managedAvailability === "unavailable" ? "danger" : "accent"}>
            {entry.managedAvailability} on managed
          </Badge>
        )}
        <span className="ml-auto font-mono text-[11px] text-text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-border-soft px-4 py-4">
          <p className="text-sm text-text-muted">{entry.controls}</p>

          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={`Default (Kafka ${version})`}>
              <code className="font-mono text-xs text-text">{getDefaultValue(entry, version)}</code>
            </Field>
            <Field label="Managed-service availability">
              <span className={limitedOnManaged ? "text-accent" : undefined}>{entry.managedAvailability}</span>
            </Field>
            <Field label="When to change it">{entry.whenToChange}</Field>
            <Field label="Related configurations">{entry.relatedConfigs.join(", ")}</Field>
            <Field label="Performance impact">{entry.performanceImpact}</Field>
            <Field label="Reliability impact">{entry.reliabilityImpact}</Field>
          </dl>

          <div className="mt-4">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
              Failure modes from getting this wrong
            </div>
            <ul className="flex flex-col gap-1">
              {entry.failureModes.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-text-muted">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-danger" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</dt>
      <dd className="text-sm leading-relaxed text-text-muted">{children}</dd>
    </div>
  );
}
