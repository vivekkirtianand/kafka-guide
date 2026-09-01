"use client";

import { useProgress } from "@/lib/context/ProgressContext";

// Small completion indicator for a module card / sidebar row. Renders nothing until the
// stored progress has hydrated, so SSR and first paint stay in sync.
export default function ModuleProgressBadge({ slug, className = "" }: { slug: string; className?: string }) {
  const { hydrated, isComplete, progress } = useProgress();
  if (!hydrated) return null;

  if (isComplete(slug)) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-success ${className}`}
        title="Completed"
      >
        <span aria-hidden>✓</span> done
      </span>
    );
  }

  if (progress[slug]?.visitedAt) {
    return (
      <span
        className={`font-mono text-[10px] uppercase tracking-wide text-text-faint ${className}`}
        title="Started"
      >
        started
      </span>
    );
  }

  return null;
}
