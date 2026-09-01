import { describe, expect, it } from "vitest";
import { labs, labA } from "./labs";
import { modules } from "./modules";

describe("lab data", () => {
  it("has unique lab slugs", () => {
    const slugs = labs.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every lab has prerequisites, setup, steps, and teardown", () => {
    for (const l of labs) {
      expect(l.prerequisites.length, l.slug).toBeGreaterThan(0);
      expect(l.setup.length, l.slug).toBeGreaterThan(0);
      expect(l.steps.length, l.slug).toBeGreaterThan(0);
      expect(l.teardown.length, l.slug).toBeGreaterThan(0);
      expect(l.teardownWarning.length, l.slug).toBeGreaterThan(0);
    }
  });

  it("every step has a unique id and the fields the walkthrough renders", () => {
    for (const l of labs) {
      const ids = l.steps.map((s) => s.id);
      expect(new Set(ids).size, l.slug).toBe(ids.length);
      for (const s of l.steps) {
        expect(s.id, `${l.slug}: ${s.title}`).toMatch(/^[a-z0-9-]+$/);
        expect(s.title.length, s.id).toBeGreaterThan(0);
        expect(s.intro.length, s.id).toBeGreaterThan(0);
        expect(s.command.length, s.id).toBeGreaterThan(0);
        expect(s.expected.length, s.id).toBeGreaterThan(0);
        expect(s.observe.length, s.id).toBeGreaterThan(0);
        if (s.commonError) {
          expect(s.commonError.symptom.length, s.id).toBeGreaterThan(0);
          expect(s.commonError.cause.length, s.id).toBeGreaterThan(0);
          expect(s.commonError.recovery.length, s.id).toBeGreaterThan(0);
        }
      }
    }
  });

  describe("Lab A — first local workflow", () => {
    it("is a single-broker walkthrough of exactly ten steps", () => {
      expect(labA.steps).toHaveLength(10);
      expect(labA.setup[0].command).toMatch(/docker run .*apache\/kafka/);
      expect(labA.setup[0].command).not.toMatch(/compose/);
    });

    it("creates the topic with replication factor 1 and explains why", () => {
      const create = labA.steps.find((s) => s.id === "create-topic")!;
      expect(create.command).toMatch(/--replication-factor 1\b/);
      expect(create.observe).toMatch(/replication factor/i);
      expect(create.commonError?.symptom).toMatch(/InvalidReplicationFactor/i);
    });

    it("shows same-key-same-partition from real consumer output", () => {
      const verify = labA.steps.find((s) => s.id === "verify-key-partition")!;
      expect(verify.command).toMatch(/print\.partition=true/);
      expect(verify.observe).toMatch(/hash(es)? the key|modulo the partition count/i);
    });

    it("frames replay as moving the reader, not the data", () => {
      const replay = labA.steps.find((s) => s.id === "reset-and-replay")!;
      expect(replay.command).toMatch(/--reset-offsets .*--to-earliest/);
      expect(replay.observe).toMatch(/no records were deleted|rewind the reader, not the data/i);
    });

    it("warns that removing the container erases the data, and contrasts Lab B volumes", () => {
      expect(labA.teardown[0].command).toMatch(/docker rm -f/);
      expect(labA.teardownWarning).toMatch(/no volume/i);
      expect(labA.teardownWarning).toMatch(/down -v/);
    });
  });

  it("the local-cluster-lab module carries Lab A and is available", () => {
    const mod = modules.find((m) => m.slug === "local-cluster-lab")!;
    expect(mod.status).toBe("available");
    expect(mod.lab?.slug).toBe(labA.slug);
  });
});
