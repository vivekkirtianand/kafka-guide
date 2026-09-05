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

// Beginner-path modules that a learner can actually complete. A `planned` module (a
// scaffolded-but-unbuilt stub, e.g. Connect/Streams) has no completion control — see
// `mod.status !== "planned"` in `[slug]/page.tsx` — so counting it toward progress or
// offering it as a "Resume" target would make the denominator uncompletable and could get
// Resume stuck pointing at a page with no way to check it off. Still fully visible in the
// module list and Sidebar via `beginnerPath()`; only excluded from progress/resume math.
export function trackableBeginnerPath(mods: Module[]): Module[] {
  return beginnerPath(mods).filter((m) => m.status !== "planned");
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
