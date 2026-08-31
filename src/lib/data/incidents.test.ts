import { describe, expect, it } from "vitest";
import { incidents, getIncident } from "./incidents";

describe("incident simulator data", () => {
  it("has ten incidents with unique slugs", () => {
    expect(incidents).toHaveLength(10);
    const slugs = incidents.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every incident is built out and marked available", () => {
    for (const i of incidents) {
      expect(i.status, i.slug).toBe("available");
      expect(i.investigation, i.slug).toBeDefined();
    }
  });

  it("every investigation has clues with evidence and exactly one correct option", () => {
    for (const i of incidents) {
      const inv = i.investigation!;
      expect(inv.clues.length, i.slug).toBeGreaterThanOrEqual(2);
      for (const c of inv.clues) {
        expect(c.label.length, `${i.slug}: ${c.label}`).toBeGreaterThan(0);
        expect(c.evidence.length, `${i.slug}: ${c.label}`).toBeGreaterThan(0);
      }
      const correct = inv.options.filter((o) => o.correct);
      expect(correct.length, i.slug).toBe(1);
      expect(inv.options.length, i.slug).toBeGreaterThanOrEqual(3);
      for (const o of inv.options) {
        expect(o.feedback.length, `${i.slug}: ${o.label}`).toBeGreaterThan(0);
      }
    }
  });

  it("clue labels match one of the incident's scoped clue categories (case-insensitive, loosely)", () => {
    for (const i of incidents) {
      for (const c of i.investigation!.clues) {
        const hit = i.clues.some((cat) => {
          const a = cat.toLowerCase();
          const b = c.label.toLowerCase();
          return a.includes(b) || b.includes(a) || a.split(/[^a-z.]+/).some((w) => w.length > 3 && b.includes(w));
        });
        expect(hit, `${i.slug}: clue "${c.label}" has no matching category in [${i.clues.join(", ")}]`).toBe(true);
      }
    }
  });

  it("resolves an incident by slug", () => {
    expect(getIncident("rebalance-storm")?.title).toBe("Rebalance storm during deployment");
    expect(getIncident("nope")).toBeUndefined();
  });
});
