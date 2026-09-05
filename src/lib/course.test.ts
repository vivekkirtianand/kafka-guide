import { describe, expect, it } from "vitest";
import { Module } from "@/lib/types";
import {
  courseHours,
  courseWeeks,
  beginnerPath,
  referenceModules,
  advancedModules,
  trackNeighbors,
  trackableBeginnerPath,
} from "./course";
import { modules } from "./data/modules";

const fixture = (over: Partial<Module>): Module => ({
  slug: over.slug ?? "x",
  index: over.index ?? 1,
  title: over.title ?? "X",
  summary: "",
  topics: [],
  activities: [],
  status: "available",
  ...over,
});

describe("course helpers", () => {
  it("courseHours sums estimatedMinutes and converts to hours", () => {
    const mods = [
      fixture({ slug: "a", estimatedMinutes: 90 }),
      fixture({ slug: "b", estimatedMinutes: 30 }),
      fixture({ slug: "c" }), // no estimate — contributes 0
    ];
    expect(courseHours(mods)).toBe(2);
  });

  it("courseWeeks divides by the part-time pace and rounds, never below 1", () => {
    const mods = [fixture({ slug: "a", estimatedMinutes: 9 * 60 })];
    expect(courseWeeks(mods, 3)).toBe(3);
    expect(courseWeeks([fixture({ slug: "a", estimatedMinutes: 10 })], 3)).toBe(1);
  });

  it("partitions the real module list by track with no module lost", () => {
    const total =
      beginnerPath(modules).length +
      referenceModules(modules).length +
      advancedModules(modules).length;
    expect(total).toBe(modules.length);
    expect(beginnerPath(modules).length).toBeGreaterThan(0);
  });

  it("the beginner-path length is a sane part-time estimate", () => {
    expect(courseWeeks(beginnerPath(modules))).toBeGreaterThanOrEqual(1);
    expect(courseWeeks(beginnerPath(modules))).toBeLessThan(52);
  });
});

describe("trackableBeginnerPath", () => {
  it("drops planned modules but keeps every other beginner-path module", () => {
    const mods = [
      fixture({ slug: "b1", track: "beginner-path", status: "available" }),
      fixture({ slug: "b2", track: "beginner-path", status: "planned" }),
      fixture({ slug: "b3", track: "beginner-path", status: "available" }),
      fixture({ slug: "r1", track: "reference", status: "available" }),
    ];
    expect(trackableBeginnerPath(mods).map((m) => m.slug)).toEqual(["b1", "b3"]);
  });

  it("on the real module list, drops exactly the planned beginner-path modules and nothing else", () => {
    const full = beginnerPath(modules);
    const trackable = trackableBeginnerPath(modules);
    const plannedOnPath = full.filter((m) => m.status === "planned");
    // whatever's planned right now, that's the difference
    expect(full.length - trackable.length).toBe(plannedOnPath.length);
    for (const m of trackable) {
      expect(m.status, m.slug).not.toBe("planned");
    }
    // and every non-planned beginner-path module survives
    expect(trackable.map((m) => m.slug)).toEqual(full.filter((m) => m.status !== "planned").map((m) => m.slug));
  });
});

describe("trackNeighbors", () => {
  const mods = [
    fixture({ slug: "b1", index: 1, track: "beginner-path" }),
    fixture({ slug: "b2", index: 2, track: "beginner-path" }),
    fixture({ slug: "r1", index: 3, track: "reference" }),
    fixture({ slug: "r2", index: 4, track: "reference" }),
  ];

  it("never steps from one track into another", () => {
    const last = trackNeighbors(mods, mods[1]); // b2, last beginner module
    expect(last.prev?.slug).toBe("b1");
    expect(last.next).toBeUndefined();

    const first = trackNeighbors(mods, mods[2]); // r1, first reference module
    expect(first.prev).toBeUndefined();
    expect(first.next?.slug).toBe("r2");
  });

  it("keeps the real beginner path's last module from linking into reference material", () => {
    const path = beginnerPath(modules);
    const { next } = trackNeighbors(modules, path[path.length - 1]);
    expect(next).toBeUndefined();
  });
});
