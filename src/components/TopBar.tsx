"use client";

import { useCluster, KAFKA_VERSIONS, DEPLOYMENT_LABELS, KafkaVersion } from "@/lib/context/ClusterContext";
import {
  DeploymentType,
  KAFKA_VERSION_INFO,
  SUPPORTED_KAFKA_VERSIONS,
  availableDeployments,
  versionIsArchived,
} from "@/lib/types";
import LogStrip from "./LogStrip";

export default function TopBar() {
  const { version, setVersion, deployment, setDeployment } = useCluster();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/90 px-6 py-3 backdrop-blur">
      <LogStrip />

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
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
                {versionIsArchived(v) ? " · archived" : ""}
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
            {availableDeployments(version).map((value) => (
              <option key={value} value={value}>
                {DEPLOYMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {versionIsArchived(version) && (
          <span
            className="w-full text-[11px] text-text-faint sm:w-auto"
            title={KAFKA_VERSION_INFO[version].note}
          >
            Kafka {version} is end of life — latest patch {KAFKA_VERSION_INFO[version].latestPatch}, no
            further releases. Apache supports {SUPPORTED_KAFKA_VERSIONS.join(", ")}.
          </span>
        )}
      </div>
    </header>
  );
}
