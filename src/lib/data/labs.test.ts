import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { labs, labA, labB } from "./labs";
import { modules } from "./modules";

const verifyLabScript = readFileSync(
  join(process.cwd(), "local-cluster-lab/verify-lab.sh"),
  "utf8",
);

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

    it("does not assert an unguaranteed cross-partition read order (neither 'partition by partition' nor 'interleaved')", () => {
      const text = labA.steps.map((s) => `${s.intro} ${s.expected} ${s.observe}`).join(" ");
      expect(text).not.toMatch(/partition by partition|one partition at a time|one whole partition before|drains one partition|interleav/i);
      // the cross-partition point is made as "no guarantee / undefined", not a specific behaviour
      const consumeBack = labA.steps.find((s) => s.id === "consume-from-beginning")!;
      expect(consumeBack.observe).toMatch(/no ordering promise|undefined|not guaranteed|no promise/i);
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

  describe("Lab B — three-broker cluster", () => {
    it("is a multi-step three-broker walkthrough backed by the Compose project", () => {
      expect(labB.steps.length).toBeGreaterThanOrEqual(8);
      expect(labB.setup.some((c) => /git clone/.test(c.command))).toBe(true);
      expect(labB.setup.some((c) => /docker compose up -d/.test(c.command))).toBe(true);
    });

    it("has an OS matrix covering macOS, Windows/WSL, and Linux", () => {
      const platforms = (labB.platformNotes ?? []).map((p) => p.platform.toLowerCase());
      expect(platforms.some((p) => p.includes("mac"))).toBe(true);
      expect(platforms.some((p) => p.includes("windows") || p.includes("wsl"))).toBe(true);
      expect(platforms.some((p) => p.includes("linux"))).toBe(true);
    });

    it("states a memory/disk floor and what happens below it", () => {
      expect(labB.resourceFloor).toBeDefined();
      expect(labB.resourceFloor!).toMatch(/\bGB\b/);
      expect(labB.resourceFloor!).toMatch(/memory|RAM/i);
    });

    it("offers verify-lab.sh as an automated check", () => {
      expect(labB.verify?.command).toMatch(/verify-lab\.sh/);
    });

    it("has lab-level troubleshooting entries, each with a cause and a fix", () => {
      expect((labB.troubleshooting ?? []).length).toBeGreaterThanOrEqual(3);
      for (const t of labB.troubleshooting ?? []) {
        expect(t.symptom.length).toBeGreaterThan(0);
        expect(t.cause.length).toBeGreaterThan(0);
        expect(t.fix.length).toBeGreaterThan(0);
      }
    });

    it("teaches leader election / ISR and acks=all admission control", () => {
      const ids = labB.steps.map((s) => s.id);
      expect(ids).toContain("stop-leader");
      expect(ids).toContain("min-isr-floor");
      const minIsr = labB.steps.find((s) => s.id === "min-isr-floor")!;
      expect(minIsr.expected).toMatch(/NotEnoughReplicas|min\.insync\.replicas/i);
    });

    it("triggers the ISR floor without breaking the KRaft controller quorum", () => {
      const minIsr = labB.steps.find((s) => s.id === "min-isr-floor")!;
      // it must NOT stop two brokers (that loses the 2-of-3 controller quorum)
      expect(minIsr.command).not.toMatch(/stop\s+kafka-\d+\s+kafka-\d+/);
      // it makes the floor bite by raising the topic's own min.insync.replicas instead
      expect(minIsr.command).toMatch(/--add-config min\.insync\.replicas=3/);
      expect(minIsr.intro + minIsr.observe).toMatch(/controller quorum/i);
    });

    it("keeps broker references consistent — stop-leader targets kafka-2, not a substituted broker", () => {
      const stopLeader = labB.steps.find((s) => s.id === "stop-leader")!;
      expect(stopLeader.command).toMatch(/docker compose stop kafka-2\b/);
      expect(stopLeader.intro).not.toMatch(/substitute the broker/i);
      // every stop/start in the walkthrough names kafka-2 specifically
      for (const s of labB.steps) {
        for (const m of s.command.matchAll(/docker compose (?:stop|start) (\S+)/g)) {
          expect(m[1], s.id).toBe("kafka-2");
        }
      }
    });

    it("does not use the unreliable short consumer timeout", () => {
      for (const s of labB.steps) {
        const t = s.command.match(/--timeout-ms (\d+)/);
        if (t) expect(Number(t[1]), s.id).toBeGreaterThanOrEqual(15000);
      }
    });

    it("does not present inherited broker configs as topic-level in describe output", () => {
      const describe = labB.steps.find((s) => s.id === "describe-replicated")!;
      expect(describe.expected).not.toMatch(/Configs:\s*min\.insync\.replicas/);
      const dyn = labB.steps.find((s) => s.id === "dynamic-config")!;
      // the dynamic-config describe output lists retention.ms but not an inherited min.insync.replicas line
      expect(dyn.expected).toMatch(/retention\.ms=3600000/);
      expect(dyn.expected).not.toMatch(/\n\s*min\.insync\.replicas=2 /);
    });

    it("warns before the destructive volume delete and distinguishes it from a plain down", () => {
      expect(labB.teardown.some((c) => /down -v/.test(c.command))).toBe(true);
      expect(labB.teardownWarning).toMatch(/-v/);
      expect(labB.teardownWarning).toMatch(/no undo|permanently|destructive/i);
    });
  });

  it("the local-cluster-lab module carries Lab A then Lab B and is available", () => {
    const mod = modules.find((m) => m.slug === "local-cluster-lab")!;
    expect(mod.status).toBe("available");
    expect(mod.labs?.map((l) => l.slug)).toEqual([labA.slug, labB.slug]);
  });

  describe("verify-lab.sh", () => {
    it("checks the metrics-pipeline services the Grafana step depends on, not just the brokers", () => {
      // kafka-exporter is what makes the dashboard non-empty — the verifier must not pass without it
      expect(verifyLabScript).toMatch(/kafka-exporter/);
      expect(verifyLabScript).toMatch(/9308/);
      expect(verifyLabScript).toMatch(/prometheus/);
    });

    it("checks all three brokers and every host port", () => {
      for (const port of ["29092", "29093", "29094", "8080", "9090", "3001"]) {
        expect(verifyLabScript, port).toContain(port);
      }
      for (const b of ["kafka-1", "kafka-2", "kafka-3"]) {
        expect(verifyLabScript, b).toContain(b);
      }
    });
  });
});
