import { describe, expect, it } from "vitest";
import { modules, getModule } from "./modules";

describe("module data", () => {
  it("has unique slugs and 0-based sequential indexes (Module 0 is 'Why Kafka?')", () => {
    const slugs = modules.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(modules.map((m) => m.index)).toEqual(modules.map((_, i) => i));
    expect(modules[0].slug).toBe("why-kafka");
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

    it("has the producer (not the broker) assign the sequence number, and the broker reject out-of-order", () => {
      const retries = detail("Ordering guarantees").points.find((p) => p.term === "Retries can reorder")!;
      expect(retries.detail).toMatch(/producer stamps each batch with a per-partition sequence number/i);
      expect(retries.detail).toMatch(/the broker rejects any batch that arrives out of order/i);
      expect(retries.detail).not.toMatch(/broker tags each batch with a sequence number/i);
      expect(retries.detail).not.toMatch(/restore order/i);
    });

    it("requires at least R brokers to host a replication factor of R", () => {
      const replicas = detail("Brokers, topics, partitions, replicas").points.find(
        (p) => p.term === "Partition → replicas"
      )!;
      expect(replicas.detail).toMatch(/at least R brokers/i);
    });

    it("names murmur2 modulo the partition count, and a per-batch null-key spread", () => {
      const key = detail("Brokers, topics, partitions, replicas").points.find(
        (p) => p.term === "Key picks the partition"
      )!;
      expect(key.detail).toMatch(/murmur2/i);
      expect(key.detail).toMatch(/modulo the partition count/i);
      expect(key.detail).toMatch(/in batches, not strictly one record at a time/i);
    });

    it("names replica.lag.time.max.ms (with its 30s default) as the ISR-drop clock and lists it as a config", () => {
      const topic = detail("Leaders, followers, ISR, and controllers");
      expect(topic.configs).toContain("replica.lag.time.max.ms");
      const isr = topic.points.find((p) => p.term === "ISR — in-sync replicas")!;
      expect(isr.detail).toMatch(/replica\.lag\.time\.max\.ms/);
      expect(isr.detail).toMatch(/30s/i);
    });

    it("does not claim the idempotent producer gives end-to-end exactly-once", () => {
      const eos = detail("At-most-once, at-least-once, and exactly-once processing").points.find(
        (p) => p.term === "Idempotent producer is not exactly-once"
      )!;
      expect(eos.detail).toMatch(/does not make an end-to-end/i);
    });
  });
});

describe("course metadata", () => {
  it("every module has difficulty, a positive time estimate, and a track", () => {
    for (const m of modules) {
      expect(["beginner", "intermediate", "advanced"], m.slug).toContain(m.difficulty);
      expect(m.estimatedMinutes ?? 0, m.slug).toBeGreaterThan(0);
      expect(["beginner-path", "reference", "advanced"], m.slug).toContain(m.track);
    }
  });

  it("every module lists at least three learning objectives", () => {
    for (const m of modules) {
      expect(m.objectives?.length ?? 0, m.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("every prerequisite resolves to a real, earlier module", () => {
    for (const m of modules) {
      for (const slug of m.prerequisites ?? []) {
        const dep = getModule(slug);
        expect(dep, `${m.slug} → ${slug}`).toBeDefined();
        expect(dep!.index, `${m.slug} → ${slug}`).toBeLessThan(m.index);
      }
    }
  });

  it("every further-reading link is absolute https, and Apache Kafka docs links are version-pinned", () => {
    for (const m of modules) {
      for (const r of m.furtherReading ?? []) {
        expect(r.url, `${m.slug}: ${r.label}`).toMatch(/^https:\/\//);
        // The unversioned kafka.apache.org/documentation/#anchor pages redirect to the docs
        // landing page — links must target a version-pinned path like /40/….
        if (/^https:\/\/kafka\.apache\.org\//.test(r.url)) {
          expect(r.url, `${m.slug}: ${r.label}`).toMatch(/^https:\/\/kafka\.apache\.org\/\d+\//);
          expect(r.url, `${m.slug}: ${r.label}`).not.toContain("/documentation/#");
        }
      }
    }
  });

  it("splits cleanly into a beginner path plus reference material", () => {
    const paths = modules.filter((m) => m.track === "beginner-path");
    const reference = modules.filter((m) => m.track === "reference");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length + reference.length + modules.filter((m) => m.track === "advanced").length).toBe(
      modules.length,
    );
  });
});

describe("Module 0 — Why Kafka?", () => {
  const m0 = getModule("why-kafka")!;
  // Every learner-visible string on the module — header metadata included, not just the
  // Topic-explorer body.
  const allText = [
    m0.title,
    m0.summary,
    ...(m0.objectives ?? []),
    ...(m0.completionCriteria ?? []),
    ...m0.topics,
    ...m0.activities,
    ...(m0.furtherReading ?? []).flatMap((r) => [r.label, r.url]),
    ...(m0.knowledgeChecks ?? []).flatMap((k) => [k.question, k.explanation, ...k.options]),
    ...(m0.exercises ?? []).flatMap((e) => [e.prompt, ...e.successCriteria]),
    ...Object.values(m0.topicDetail!).flatMap((d) => [
      d.summary,
      d.watchOut ?? "",
      ...d.points.flatMap((p) => [p.term, p.detail]),
    ]),
  ].join(" ");

  it("is the first module, on the beginner path, with no prerequisites", () => {
    expect(m0.index).toBe(0);
    expect(m0.track).toBe("beginner-path");
    expect(m0.prerequisites).toEqual([]);
    expect(m0.status).toBe("available");
  });

  it("covers every listed topic with Topic-explorer content", () => {
    for (const topic of m0.topics) {
      const d = m0.topicDetail![topic];
      expect(d, topic).toBeDefined();
      expect(d.points.length, topic).toBeGreaterThan(0);
    }
  });

  it("does not introduce ISR / acknowledgements / KRaft / controller-quorum before the problem is understood", () => {
    // Acceptance criterion for Phase 2 — checked across every learner-visible field.
    expect(allText).not.toMatch(/\bISR\b|in[- ]sync replica/i);
    // acknowledge / acknowledged / acknowledgment / acknowledgement / ack / acks
    expect(allText).not.toMatch(/\backnowledg|\backs?\b/i);
    expect(allText).not.toMatch(/\bKRaft\b|controller[- ]quorum|controller quorum|\bquorum\b/i);
  });

  it("frames Kafka against the alternatives a beginner would actually weigh", () => {
    expect(m0.topics).toContain("Kafka versus queues");
    expect(m0.topics).toContain("Kafka versus databases");
    expect(m0.topics).toContain("When Kafka is a poor choice");
    expect(allText).toMatch(/request\/response/i);
  });

  it("has a 10-question knowledge check with valid answers", () => {
    expect(m0.knowledgeChecks).toHaveLength(10);
    for (const k of m0.knowledgeChecks!) {
      expect(k.options.length, k.question).toBeGreaterThanOrEqual(2);
      expect(k.answerIndex, k.question).toBeGreaterThanOrEqual(0);
      expect(k.answerIndex, k.question).toBeLessThan(k.options.length);
      expect(k.explanation.length, k.question).toBeGreaterThan(0);
    }
  });

  it("has a 'should this use Kafka?' design exercise with self-check criteria", () => {
    expect(m0.exercises).toHaveLength(1);
    const ex = m0.exercises![0];
    expect(ex.prompt).toMatch(/recommend/i);
    expect(ex.successCriteria.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Module 4 — schemas and data contracts", () => {
  const m = getModule("schemas-and-data-contracts")!;
  const detail = (t: string) => m.topicDetail![t];

  it("is inserted at index 4 on the beginner path, after Build a producer and consumer", () => {
    expect(m.index).toBe(4);
    expect(m.track).toBe("beginner-path");
    expect(m.difficulty).toBe("intermediate");
    expect(m.status).toBe("available");
    expect(m.prerequisites).toEqual(["build-a-producer-and-consumer"]);
  });

  it("renders as Topic-explorer content, not a walkthrough or a lab", () => {
    expect(m.walkthrough).toBeUndefined();
    expect(m.labs).toBeUndefined();
    expect(Object.keys(m.topicDetail ?? {})).toHaveLength(m.topics.length);
    for (const topic of m.topics) {
      const d = m.topicDetail![topic];
      expect(d, topic).toBeDefined();
      expect(d.points.length, topic).toBeGreaterThanOrEqual(2);
    }
  });

  it("leads with the bytes boundary — the broker never parses a record", () => {
    const bytes = detail("Kafka moves bytes, not objects");
    expect(bytes.points.map((p) => p.detail).join(" ")).toMatch(/broker never parses/i);
  });

  it("names all four base compatibility modes and the deploy order each forces", () => {
    const compat = detail("Compatibility modes");
    const text = compat.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).toMatch(/BACKWARD/);
    expect(text).toMatch(/FORWARD/);
    expect(text).toMatch(/FULL/);
    expect(text).toMatch(/NONE/);
    expect(text).toMatch(/Upgrade consumers first/i);
    expect(text).toMatch(/Upgrade producers first/i);
    // plain BACKWARD only checks the previous version — replay needs the transitive mode
    expect(compat.watchOut).toMatch(/transitive/i);
  });

  it("frames the registry as a dependency that is off the per-record hot path", () => {
    const reg = detail("What the Schema Registry adds");
    const text = reg.points.map((p) => p.detail).join(" ");
    expect(text).toMatch(/schema id/i);
    expect(text).toMatch(/zero times per record|cached/i);
    expect(text).toMatch(/outage|dependency/i);
  });

  it("treats a deserialization failure as a poison record that stalls the partition", () => {
    const poison = detail("Deserialization failures and poison records");
    const text = `${poison.summary} ${poison.points.map((p) => p.detail).join(" ")}`;
    expect(text).toMatch(/inside poll\(\)|out of poll\(\)/i);
    expect(text).toMatch(/dead-letter|byte\[\]/i);
    expect(text).not.toMatch(/broker (validates|rejects|checks) the schema/i);
  });
});

describe("knowledge checks (any module)", () => {
  it("every KnowledgeCheck has an in-range answerIndex and enough options", () => {
    for (const m of modules) {
      for (const k of m.knowledgeChecks ?? []) {
        expect(k.options.length, `${m.slug}: ${k.question}`).toBeGreaterThanOrEqual(2);
        expect(k.answerIndex, `${m.slug}: ${k.question}`).toBeGreaterThanOrEqual(0);
        expect(k.answerIndex, `${m.slug}: ${k.question}`).toBeLessThan(k.options.length);
      }
    }
  });
});
