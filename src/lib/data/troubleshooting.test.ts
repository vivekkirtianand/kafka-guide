import { describe, expect, it } from "vitest";
import { troubleshooting, getTroubleshootingEntry } from "./troubleshooting";

describe("troubleshooting catalog data", () => {
  it("covers the ten troubleshooting symptoms", () => {
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

  it("frames the fetch limits as soft, not as a large-message rejection", () => {
    const entry = getTroubleshootingEntry("large-message-failures");
    expect(entry?.overview).toContain("three admission limits");
    // replica.fetch.max.bytes must not be listed as a key config that rejects a record
    expect(entry?.keyConfigs).not.toContain("replica.fetch.max.bytes");
    const softCause = entry?.causes.find((c) => c.cause === "Not the fetch limits");
    expect(softCause?.evidence).toMatch(/soft/i);
  });

  it("treats retention.bytes as a per-partition cap", () => {
    const entry = getTroubleshootingEntry("disk-usage-growth");
    expect(entry?.resolutionFlow[0]).toContain("per partition");
  });

  it("keeps the NOT_ENOUGH_REPLICAS guidance from lowering the durability floor as the first move", () => {
    const entry = getTroubleshootingEntry("not-enough-replicas");
    expect(entry?.watchOut).toContain("RF 3 with min.insync.replicas 2");
    // the fix is to repair the follower, not to drop min.insync.replicas
    expect(entry?.resolutionFlow[2]).toContain("Repair the follower");
  });
});
