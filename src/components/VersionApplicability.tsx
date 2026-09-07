"use client";

import { KafkaRelease, KafkaVersion, versionRangeLabel } from "@/lib/types";
import { useCluster } from "@/lib/context/ClusterContext";

// The "accurate for Kafka X" line under a module header or a runbook, plus a caveat when the
// reader's selected version (top bar) falls outside that range. Shared by the module page
// and the runbook detail page.
export default function VersionApplicability({
  versions,
  reviewed,
  subject = "module",
}: {
  versions: KafkaVersion[];
  reviewed?: string;
  subject?: "module" | "runbook";
}) {
  const { version } = useCluster();
  if (versions.length === 0) {
    return reviewed ? (
      <p className="font-mono text-[11px] text-text-faint">Reviewed {reviewed}</p>
    ) : null;
  }

  const label = versionRangeLabel(versions as KafkaRelease[]);
  const inRange = versions.includes(version);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] text-text-faint">
        Kafka {label}
        {reviewed ? ` · reviewed ${reviewed}` : ""}
      </p>
      {!inRange && (
        <p className="rounded-md border border-accent/30 bg-accent-soft px-3 py-2 font-mono text-[11px] leading-relaxed text-accent">
          You have Kafka {version} selected in the top bar. This {subject} covers the Kafka{" "}
          {label} line, which is KRaft-only — on {version}, ZooKeeper mode still exists and a
          few CLI flags and config defaults differ from what you see here.
        </p>
      )}
    </div>
  );
}
