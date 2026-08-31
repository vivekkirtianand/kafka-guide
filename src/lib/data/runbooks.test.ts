import { describe, expect, it } from "vitest";
import { runbooks, getRunbook } from "./runbooks";

const SECTIONS = ["prechecks", "execution", "validation", "rollback", "escalation"] as const;

describe("production runbooks data", () => {
  it("has the 14 planned runbooks with unique slugs", () => {
    expect(runbooks).toHaveLength(14);
    const slugs = runbooks.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every runbook a summary, a when, a category, and every step section filled", () => {
    for (const r of runbooks) {
      expect(r.summary.length, r.slug).toBeGreaterThan(0);
      expect(r.when.length, r.slug).toBeGreaterThan(0);
      expect(r.category.length, r.slug).toBeGreaterThan(0);
      for (const section of SECTIONS) {
        expect(r.steps[section].length, `${r.slug}: ${section}`).toBeGreaterThan(0);
        for (const step of r.steps[section]) {
          expect(step.trim().length, `${r.slug}: ${section}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("derives a url-safe slug from the title", () => {
    for (const r of runbooks) {
      expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(getRunbook("rolling-broker-restarts")?.title).toBe("Rolling broker restarts");
  });

  it("resolves a runbook by slug and misses cleanly", () => {
    expect(getRunbook("handling-a-full-disk")?.category).toBe("Incident response");
    expect(getRunbook("not-a-runbook")).toBeUndefined();
  });

  it("only uses the five known categories", () => {
    const known = new Set(["Change management", "Capacity", "Deployment", "Security", "Resilience", "Incident response"]);
    for (const r of runbooks) {
      expect(known.has(r.category), `${r.slug}: ${r.category}`).toBe(true);
    }
  });
});
