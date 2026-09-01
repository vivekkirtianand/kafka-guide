import Link from "next/link";
import { Module } from "@/lib/types";
import { getModule } from "@/lib/data/modules";
import Badge from "./Badge";

const DIFFICULTY_TONE = {
  beginner: "success",
  intermediate: "stream",
  advanced: "accent",
} as const;

const TRACK_LABEL = {
  "beginner-path": "Beginner path",
  reference: "Reference",
  advanced: "Advanced",
} as const;

export default function ModuleMeta({ module }: { module: Module }) {
  const prereqs = (module.prerequisites ?? [])
    .map((slug) => getModule(slug))
    .filter((m): m is Module => Boolean(m));

  const hasMeta =
    module.difficulty ||
    module.estimatedMinutes ||
    prereqs.length > 0 ||
    (module.objectives?.length ?? 0) > 0;

  if (!hasMeta) return null;

  return (
    <div className="mb-10 flex flex-col gap-4 rounded-lg border border-border bg-bg-elevated p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-text-faint">
        {module.difficulty && (
          <Badge tone={DIFFICULTY_TONE[module.difficulty]}>{module.difficulty}</Badge>
        )}
        {module.track && <Badge tone="neutral">{TRACK_LABEL[module.track]}</Badge>}
        {module.estimatedMinutes && <span>~{module.estimatedMinutes} min</span>}
      </div>

      {prereqs.length > 0 && (
        <div className="text-sm text-text-muted">
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">
            Prerequisites:{" "}
          </span>
          {prereqs.map((m, i) => (
            <span key={m.slug}>
              {i > 0 && ", "}
              <Link href={`/modules/${m.slug}`} className="text-accent hover:underline">
                {m.title}
              </Link>
            </span>
          ))}
        </div>
      )}

      {(module.objectives?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-2 font-display text-sm text-text">By the end of this module you can</h2>
          <ul className="flex flex-col gap-1.5">
            {module.objectives!.map((o) => (
              <li key={o} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stream" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(module.applicableVersions?.length || module.lastReviewed) && (
        <p className="font-mono text-[11px] text-text-faint">
          {module.applicableVersions?.length
            ? `Reviewed against Kafka ${module.applicableVersions.join(", ")}`
            : "Reviewed"}
          {module.lastReviewed ? ` · ${module.lastReviewed}` : ""}
        </p>
      )}
    </div>
  );
}
