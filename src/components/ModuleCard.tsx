import Link from "next/link";
import { Module } from "@/lib/types";
import Badge from "./Badge";
import ModuleProgressBadge from "./ModuleProgressBadge";

export default function ModuleCard({ module }: { module: Module }) {
  return (
    <Link
      href={`/modules/${module.slug}`}
      className="group flex flex-col justify-between rounded-lg border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/50"
    >
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-faint">{String(module.index).padStart(2, "0")}</span>
            <ModuleProgressBadge slug={module.slug} />
          </div>
          <Badge tone={module.status === "planned" ? "neutral" : "success"}>
            {module.status === "planned" ? "planned" : module.status === "external" ? "lab built" : "available"}
          </Badge>
        </div>
        <h3 className="font-display text-lg text-text group-hover:text-accent">{module.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{module.summary}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-text-faint">
        {module.difficulty && <span className="text-text-muted">{module.difficulty}</span>}
        {module.difficulty && <span aria-hidden>·</span>}
        <span>{module.topics.length} topics</span>
        <span aria-hidden>·</span>
        <span>{module.activities.length} activities</span>
        {module.estimatedMinutes && (
          <>
            <span aria-hidden>·</span>
            <span>~{module.estimatedMinutes} min</span>
          </>
        )}
      </div>
    </Link>
  );
}
