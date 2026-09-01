import { describe, expect, it } from "vitest";
import { Module } from "@/lib/types";
import { courseHours, courseWeeks, beginnerPath, referenceModules, advancedModules } from "./course";
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

  it("the computed course length is a sane part-time estimate", () => {
    expect(courseWeeks(modules)).toBeGreaterThanOrEqual(1);
    expect(courseWeeks(modules)).toBeLessThan(52);
  });
});
