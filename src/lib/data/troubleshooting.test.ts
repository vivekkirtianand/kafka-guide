import { describe, expect, it } from "vitest";
import { troubleshooting, getTroubleshootingEntry } from "./troubleshooting";

describe("troubleshooting catalog data", () => {
  it("covers the ten Module 7 symptoms", () => {
    expect(troubleshooting).toHaveLength(10);
  });

  it("has unique slugs", () => {
    const slugs = troubleshooting.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every entry an overview, causes with evidence, and a resolution flow", () => {
    for (const t of troubleshooting) {
      expect(t.overview.length, t.slug).toBeGreaterThan(0);
      expect(t.causes.length, t.slug).toBeGreaterThan(0);
      expect(t.resolutionFlow.length, t.slug).toBeGreaterThan(0);
      for (const c of t.causes) {
        expect(c.cause.length, `${t.slug}: ${c.cause}`).toBeGreaterThan(0);
        expect(c.evidence.length, `${t.slug}: ${c.cause}`).toBeGreaterThan(0);
      }
    }
  });

  it("resolves an entry by slug", () => {
    expect(getTroubleshootingEntry("consumer-lag")?.symptom).toBe("Consumer lag");
    expect(getTroubleshootingEntry("nope")).toBeUndefined();
  });

  it("keeps the NOT_ENOUGH_REPLICAS guidance from lowering the durability floor as the first move", () => {
    const entry = getTroubleshootingEntry("not-enough-replicas");
    expect(entry?.watchOut).toContain("RF 3 with min.insync.replicas 2");
    // the fix is to repair the follower, not to drop min.insync.replicas
    expect(entry?.resolutionFlow[2]).toContain("Repair the follower");
  });
});
