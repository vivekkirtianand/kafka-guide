"use client";

import { useCluster, KAFKA_VERSIONS, DEPLOYMENT_LABELS, KafkaVersion } from "@/lib/context/ClusterContext";
import { DeploymentType } from "@/lib/types";
import LogStrip from "./LogStrip";

export default function TopBar() {
  const { version, setVersion, deployment, setDeployment } = useCluster();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/90 px-6 py-3 backdrop-blur">
      <LogStrip />

      <div className="flex items-center gap-2 text-xs font-mono">
        <label className="flex items-center gap-1.5">
          <span className="text-text-faint">version</span>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value as KafkaVersion)}
            className="rounded border border-border bg-bg-elevated px-2 py-1 text-text outline-none hover:border-accent/60"
          >
            {KAFKA_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-text-faint">deployment</span>
          <select
            value={deployment}
            onChange={(e) => setDeployment(e.target.value as DeploymentType)}
            className="rounded border border-border bg-bg-elevated px-2 py-1 text-text outline-none hover:border-accent/60"
          >
            {Object.entries(DEPLOYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
