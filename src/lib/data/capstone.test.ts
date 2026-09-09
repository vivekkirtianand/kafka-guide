import { describe, expect, it } from "vitest";
import { capstoneProject } from "./capstone";
import { modules } from "./modules";

const slugs = new Set(modules.map((m) => m.slug));

describe("capstone project", () => {
  it("has an eleven-requirement spec with unique, stable ids", () => {
    expect(capstoneProject.requirements).toHaveLength(11);
    const ids = capstoneProject.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z-]*[a-z]$/);
  });

  it("fills the title and detail on every requirement", () => {
    for (const r of capstoneProject.requirements) {
      expect(r.title.trim().length, r.id).toBeGreaterThan(0);
      expect(r.detail.trim().length, r.id).toBeGreaterThan(20);
      expect(r.buildsOn.length, r.id).toBeGreaterThan(0);
    }
  });

  it("only references real course modules in buildsOn", () => {
    for (const r of capstoneProject.requirements) {
      for (const m of r.buildsOn) expect(slugs.has(m), `${r.id} -> ${m}`).toBe(true);
    }
  });

  it("exercises the modules the capstone depends on", () => {
    const covered = new Set(capstoneProject.requirements.flatMap((r) => r.buildsOn));
    for (const m of [
      "build-a-producer-and-consumer",
      "keys-ordering-and-delivery",
      "schemas-and-data-contracts",
      "consumer-configuration",
      "connect-and-streams",
    ]) {
      expect(covered.has(m), m).toBe(true);
    }
  });

  it("scores on correctness, reliability, observability, and operational safety", () => {
    expect(capstoneProject.rubric.map((d) => d.name)).toEqual([
      "Correctness",
      "Reliability",
      "Observability",
      "Operational safety",
    ]);
    for (const d of capstoneProject.rubric) {
      expect(d.focus.trim().length, d.name).toBeGreaterThan(0);
      expect(d.levels.map((l) => l.label), d.name).toEqual(["Meets", "Partial", "Missing"]);
      for (const l of d.levels) expect(l.descriptor.trim().length, `${d.name}/${l.label}`).toBeGreaterThan(0);
    }
  });

  it("requires the finance store to survive the write/commit crash window without a duplicate", () => {
    const r = capstoneProject.requirements.find((x) => x.id === "consumer-group")!;
    expect(r.detail).toMatch(/at-least-once/);
    expect(r.detail).toMatch(/idempotent|upsert|atomic/);
    expect(r.detail).toMatch(/orderId/);
  });

  it("requires the dead-letter write to be acknowledged before the source commit", () => {
    const r = capstoneProject.requirements.find((x) => x.id === "dead-letter")!;
    expect(r.detail).toMatch(/acknowledged|send future/);
    expect(r.detail).toMatch(/before committing past the source record/);
    expect(r.detail).toMatch(/do not commit|propagate/);
  });

  it("does not frame the export failure mode as a compaction problem", () => {
    const r = capstoneProject.requirements.find((x) => x.id === "runbook")!;
    expect(r.detail).toMatch(/append-only|upsert-capable|last value per key/i);
    expect(r.detail).toMatch(/not a compaction problem/i);
  });

  it("has a brief, a stack, and a submission checklist", () => {
    expect(capstoneProject.brief).toMatch(/Larkspur/);
    expect(capstoneProject.stack).toMatch(/Lab B|three-broker/);
    expect(capstoneProject.submission.length).toBeGreaterThanOrEqual(3);
  });

  it("makes the min-ISR floor bite by raising it, not by stopping a second broker", () => {
    const drill = capstoneProject.requirements.find((r) => r.id === "failure-drill")!;
    expect(drill.detail).toMatch(/raise the order topic's min\.insync\.replicas to 3/);
    // stopping two of three brokers also loses the KRaft controller quorum — call that out
    expect(drill.detail).toMatch(/Do not stop a second broker/);
    expect(drill.detail).toMatch(/controller quorum/);
  });
});
