import Link from "next/link";
import { Module } from "@/lib/types";
import Badge from "./Badge";

export default function ModuleCard({ module }: { module: Module }) {
  return (
    <Link
      href={`/modules/${module.slug}`}
      className="group flex flex-col justify-between rounded-lg border border-border bg-bg-elevated p-5 transition-colors hover:border-accent/50"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs text-text-faint">{String(module.index).padStart(2, "0")}</span>
          <Badge tone={module.status === "planned" ? "neutral" : "success"}>
            {module.status === "planned" ? "planned" : module.status === "external" ? "lab built" : "available"}
          </Badge>
        </div>
        <h3 className="font-display text-lg text-text group-hover:text-accent">{module.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{module.summary}</p>
      </div>
      <div className="mt-4 font-mono text-[11px] text-text-faint">
        {module.topics.length} topics · {module.activities.length} activities
      </div>
    </Link>
  );
}
