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

    it("shows key→partition as conditional (default partitioner, fixed partition count), not absolute", () => {
      const verify = labA.steps.find((s) => s.id === "verify-key-partition")!;
      expect(verify.command).toMatch(/print\.partition=true/);
      expect(verify.observe).toMatch(/hash(es)? the key|modulo the partition count/i);
      // the caveat must be present and the unconditional claim gone
      expect(verify.observe).toMatch(/add partitions|custom partitioner|explicit partition|default partitioner/i);
      expect(verify.observe).not.toMatch(/same partition\s*[—-]\s*every time/i);
    });

    it("never claims the console consumer reads one partition fully before the next", () => {
      const text = labA.steps.map((s) => `${s.intro} ${s.expected} ${s.observe}`).join(" ");
      expect(text).not.toMatch(/partition by partition|one partition at a time|one whole partition before|drains one partition/i);
    });

    it("assumes a POSIX shell and points Windows users at WSL / Git Bash", () => {
      const shellPrereq = labA.prerequisites.find((p) => /shell|WSL|Git Bash/i.test(p));
      expect(shellPrereq).toBeDefined();
      expect(shellPrereq).toMatch(/WSL|Git Bash/);
    });

    it("consumes deterministically — every consume step bounds itself with --max-messages, not a short timeout", () => {
      const consumeSteps = labA.steps.filter((s) => s.command.includes("kafka-console-consumer.sh"));
      expect(consumeSteps.length).toBeGreaterThanOrEqual(3);
      for (const s of consumeSteps) {
        expect(s.command, s.id).toMatch(/--max-messages \d+/);
        // no five-second (or shorter) timeout — the cold consumer-group coordinator setup can eat it
        const timeout = s.command.match(/--timeout-ms (\d+)/);
        if (timeout) expect(Number(timeout[1]), s.id).toBeGreaterThanOrEqual(15000);
      }
    });

    it("teaches sticky (batch-wise) placement for unkeyed records, not one-per-partition", () => {
      const showPartition = labA.steps.find((s) => s.id === "consume-show-partition")!;
      expect(showPartition.observe).toMatch(/sticky|one partition per batch|fills one partition/i);
      // the expected output must not show the three unkeyed records on three different partitions
      const partitions = [...showPartition.expected.matchAll(/Partition:(\d+)/g)].map((m) => m[1]);
      expect(partitions.length).toBeGreaterThan(0);
      expect(new Set(partitions).size).toBe(1);
    });

    it("reports the processed total that Kafka actually prints for the six-record read", () => {
      const verify = labA.steps.find((s) => s.id === "verify-key-partition")!;
      expect(verify.command).toMatch(/--max-messages 6\b/);
      expect(verify.expected).toMatch(/6 messages/);
      expect(verify.expected).not.toMatch(/total of 3 messages/);
    });

    it("shows a broker-readiness line that matches the pinned 4.0.2 image", () => {
      const up = labA.steps.find((s) => s.id === "broker-up")!;
      // 4.0.2 prints `... rack: null isFenced: false) -> (` — the expected line must not stop at `rack: null`
      expect(up.expected).toMatch(/isFenced|rack: null[^)]*\.\.\./);
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
