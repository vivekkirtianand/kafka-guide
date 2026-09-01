import { Module } from "@/lib/types";

// Total learner-facing hours across every module that carries an estimate.
export function courseHours(mods: Module[]): number {
  const minutes = mods.reduce((sum, m) => sum + (m.estimatedMinutes ?? 0), 0);
  return minutes / 60;
}

// Calendar weeks to finish the course at a given part-time pace. Rounded to a whole week so
// it reads as an estimate, never below 1.
export function courseWeeks(mods: Module[], hoursPerWeek = 3): number {
  return Math.max(1, Math.round(courseHours(mods) / hoursPerWeek));
}

// Modules on the linear beginner path, in course order.
export function beginnerPath(mods: Module[]): Module[] {
  return mods.filter((m) => m.track === "beginner-path");
}

// Reference modules — looked up as needed rather than worked through in order.
export function referenceModules(mods: Module[]): Module[] {
  return mods.filter((m) => m.track === "reference");
}

// Deeper mechanical material that assumes the beginner path.
export function advancedModules(mods: Module[]): Module[] {
  return mods.filter((m) => m.track === "advanced");
}

// Previous/next within the same track, in course order — so "next" from the last beginner
// module doesn't spill into reference material. Modules with no track fall back to the whole
// list.
export function trackNeighbors(
  mods: Module[],
  current: Module,
): { prev?: Module; next?: Module } {
  const siblings = (current.track ? mods.filter((m) => m.track === current.track) : mods)
    .slice()
    .sort((a, b) => a.index - b.index);
  const pos = siblings.findIndex((m) => m.slug === current.slug);
  return { prev: siblings[pos - 1], next: siblings[pos + 1] };
}
