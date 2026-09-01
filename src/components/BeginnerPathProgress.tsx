"use client";

import Link from "next/link";
import { useProgress } from "@/lib/context/ProgressContext";

export default function BeginnerPathProgress({
  path,
}: {
  path: { slug: string; title: string }[];
}) {
  const { hydrated, completedCount, resumeSlug, resetAll, progress } = useProgress();

  // Server render and first client paint: reserve the row's height, show nothing else.
  if (!hydrated) return <div className="mb-6 h-9" aria-hidden />;

  const slugs = path.map((m) => m.slug);
  const done = completedCount(slugs);
  const total = path.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const anyProgress = done > 0 || slugs.some((s) => progress[s]?.visitedAt);

  const resume = resumeSlug(slugs);
  const resumeModule = path.find((m) => m.slug === resume);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-[140px] flex-1 items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Beginner path progress"
        >
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-text-faint">
          {done}/{total} done
        </span>
      </div>

      {resumeModule && (
        <Link
          href={`/modules/${resumeModule.slug}`}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg-inset transition-opacity hover:opacity-90"
        >
          {anyProgress ? "Resume" : "Start"}: {resumeModule.title}
        </Link>
      )}

      {anyProgress && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset all module progress? This can't be undone.")) resetAll();
          }}
          className="text-xs text-text-faint underline-offset-2 hover:text-danger hover:underline"
        >
          Reset progress
        </button>
      )}
    </div>
  );
}
