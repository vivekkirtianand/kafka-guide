import { describe, expect, it } from "vitest";
import { modules, getModule } from "./modules";

describe("module data", () => {
  it("has unique, sequential slugs and indexes", () => {
    const slugs = modules.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(modules.map((m) => m.index)).toEqual(modules.map((_, i) => i + 1));
  });

  it("every topicDetail / topicNarrative key matches a real topic string", () => {
    for (const m of modules) {
      for (const key of Object.keys(m.topicDetail ?? {})) {
        expect(m.topics, `${m.slug}: ${key}`).toContain(key);
      }
      for (const key of Object.keys(m.topicNarrative ?? {})) {
        expect(m.topics, `${m.slug}: ${key}`).toContain(key);
      }
    }
  });

  it("an available module with topicDetail covers every one of its topics", () => {
    for (const m of modules) {
      if (m.status === "available" && m.topicDetail) {
        for (const topic of m.topics) {
          const d = m.topicDetail[topic];
          expect(d, `${m.slug}: ${topic}`).toBeDefined();
          expect(d.summary.length, `${m.slug}: ${topic}`).toBeGreaterThan(0);
          expect(d.points.length, `${m.slug}: ${topic}`).toBeGreaterThan(0);
        }
      }
    }
  });

  describe("Module 1 — mental model accuracy", () => {
    const m1 = getModule("mental-model")!;
    const detail = (t: string) => m1.topicDetail![t];

    it("is built as Topic explorer content, not an outline", () => {
      expect(m1.status).toBe("available");
      expect(Object.keys(m1.topicDetail ?? {})).toHaveLength(m1.topics.length);
    });

    it("notes offsets can have gaps", () => {
      const offsets = detail("Kafka's append-only log").points.find((p) => p.term === "Offsets")!;
      expect(offsets.detail).toMatch(/gap|hole/i);
      expect(offsets.detail).toMatch(/compact/i);
    });

    it("keeps min.insync.replicas as a separate admission floor from acks=all", () => {
      const isr = detail("Leaders, followers, ISR, and controllers").points.find(
        (p) => p.term === "Why the ISR matters"
      )!;
      expect(isr.detail).toMatch(/every replica currently in the ISR/i);
      expect(isr.detail).toMatch(/admission floor/i);
    });

    it("describes idempotent-producer ordering as sequence-number rejection, not broker reordering", () => {
      const retries = detail("Ordering guarantees").points.find((p) => p.term === "Retries can reorder")!;
      expect(retries.detail).toMatch(/sequence number/i);
      expect(retries.detail).not.toMatch(/restore order/i);
    });

    it("does not claim the idempotent producer gives end-to-end exactly-once", () => {
      const eos = detail("At-most-once, at-least-once, and exactly-once processing").points.find(
        (p) => p.term === "Idempotent producer is not exactly-once"
      )!;
      expect(eos.detail).toMatch(/does not make an end-to-end/i);
    });
  });
});
