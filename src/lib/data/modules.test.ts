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

  it("every topicDetail entry carries a valid beginner/intermediate/advanced level", () => {
    for (const m of modules) {
      for (const [topic, d] of Object.entries(m.topicDetail ?? {})) {
        expect(["beginner", "intermediate", "advanced"], `${m.slug}: ${topic}`).toContain(d.level);
      }
    }
  });

  it("Module 0's topics are all beginner-level — it is the foundational module", () => {
    const m0 = getModule("why-kafka")!;
    for (const d of Object.values(m0.topicDetail!)) {
      expect(d.level).toBe("beginner");
    }
  });

  describe("Module 1 — events, topics, partitions, brokers", () => {
    const m1 = getModule("mental-model")!;
    const detail = (t: string) => m1.topicDetail![t];

    it("keeps its slug but is retitled and cut to the three foundational topics (Phase 6b)", () => {
      expect(m1.index).toBe(1);
      expect(m1.title).toMatch(/events, topics, partitions, brokers/i);
      expect(m1.topics).toEqual([
        "Kafka's append-only log",
        "Brokers, topics, partitions, replicas",
        "Producers, consumers, offsets, and consumer groups",
      ]);
      expect(Object.keys(m1.topicDetail ?? {})).toHaveLength(m1.topics.length);
    });

    it("notes offsets can have gaps", () => {
      const offsets = detail("Kafka's append-only log").points.find((p) => p.term === "Offsets")!;
      expect(offsets.detail).toMatch(/gap|hole/i);
      expect(offsets.detail).toMatch(/compact/i);
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
  });

  describe("Module 4 — keys, ordering, and delivery guarantees (Phase 6b split)", () => {
    const m4 = getModule("keys-ordering-and-delivery")!;
    const detail = (t: string) => m4.topicDetail![t];

    it("is a beginner-path module at index 4, split out of the mental model", () => {
      expect(m4.index).toBe(4);
      expect(m4.track).toBe("beginner-path");
      expect(m4.difficulty).toBe("intermediate");
      expect(m4.status).toBe("available");
      expect(m4.prerequisites).toEqual(["mental-model", "build-a-producer-and-consumer"]);
      expect(m4.topics).toEqual([
        "Keys and the partitioner",
        "Ordering guarantees",
        "Leaders, followers, ISR, and controllers",
        "At-most-once, at-least-once, and exactly-once processing",
      ]);
      expect(Object.keys(m4.topicDetail ?? {})).toHaveLength(m4.topics.length);
    });

    it("leads with a keys topic that says a key groups, it does not identify", () => {
      const keys = detail("Keys and the partitioner");
      const text = keys.points.map((p) => `${p.term} ${p.detail}`).join(" ");
      expect(text).toMatch(/murmur2/);
      expect(text).toMatch(/not a primary key|does not identify|not.*unique id/i);
      expect(keys.watchOut).toMatch(/partition count/i);
      // a custom partitioner can still route on the key — don't claim it always makes the key "just data"
      const override = keys.points.find((p) => /overrid/i.test(p.term))!;
      expect(override.detail).toMatch(/still route on the key|often still routes on the key/i);
      expect(override.detail).not.toMatch(/either way the key becomes just data/i);
    });

    it("keeps min.insync.replicas as a separate admission floor from acks=all", () => {
      const isr = detail("Leaders, followers, ISR, and controllers").points.find(
        (p) => p.term === "Why the ISR matters"
      )!;
      expect(isr.detail).toMatch(/every replica currently in the ISR/i);
      expect(isr.detail).toMatch(/admission floor/i);
    });

    it("names replica.lag.time.max.ms (with its 30s default) as the ISR-drop clock and lists it as a config", () => {
      const topic = detail("Leaders, followers, ISR, and controllers");
      expect(topic.configs).toContain("replica.lag.time.max.ms");
      const isr = topic.points.find((p) => p.term === "ISR — in-sync replicas")!;
      expect(isr.detail).toMatch(/replica\.lag\.time\.max\.ms/);
      expect(isr.detail).toMatch(/30s/i);
    });

    it("has the producer (not the broker) assign the sequence number, and the broker reject out-of-order", () => {
      const retries = detail("Ordering guarantees").points.find((p) => p.term === "Retries can reorder")!;
      expect(retries.detail).toMatch(/producer stamps each batch with a per-partition sequence number/i);
      expect(retries.detail).toMatch(/the broker rejects any batch that arrives out of order/i);
      expect(retries.detail).not.toMatch(/broker tags each batch with a sequence number/i);
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

describe("Module 5 — schemas and data contracts", () => {
  const m = getModule("schemas-and-data-contracts")!;
  const detail = (t: string) => m.topicDetail![t];

  it("sits at index 5 on the beginner path (after Keys/ordering, Phase 6b bumped it)", () => {
    expect(m.index).toBe(5);
    expect(m.track).toBe("beginner-path");
    expect(m.difficulty).toBe("intermediate");
    expect(m.status).toBe("available");
    expect(m.prerequisites).toEqual(["build-a-producer-and-consumer", "local-cluster-lab"]);
  });

  it("renders Topic-explorer content for every topic, plus the schema-evolution lab", () => {
    expect(m.walkthrough).toBeUndefined();
    expect(m.labs?.map((l) => l.slug)).toEqual(["lab-c-schema-evolution"]);
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

  it("scopes a registry outage to uncached schema ids, not to all decoding", () => {
    const reg = detail("What the Schema Registry adds");
    const dep = reg.points.find((p) => p.term.includes("dependency"))!;
    expect(dep.detail).toMatch(/already cached/i);
    expect(dep.detail).toMatch(/cold start|never fetched/i);
  });

  it("gets the Avro evolution rules right: no-default add is FORWARD-only, any field drops under BACKWARD", () => {
    const evo = detail("Evolving a schema without breaking consumers");
    const text = evo.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).toMatch(/no default can be added under FORWARD/i);
    expect(text).toMatch(/BACKWARD lets you drop any field/i);
    expect(text).not.toMatch(/breaking change under every mode/i);
    // the no-default add must not be described as safe under BACKWARD
    expect(evo.watchOut).toMatch(/FORWARD-compatible only|FORWARD only/i);
    expect(evo.watchOut).not.toMatch(/fine under BACKWARD or FORWARD/i);
  });

  it("marks the concrete safe-change list as Avro's, not format-neutral", () => {
    const evo = detail("Evolving a schema without breaking consumers");
    const compat = detail("Compatibility modes");
    expect(evo.summary).toMatch(/Avro/);
    expect(`${evo.summary} ${evo.points.map((p) => p.detail).join(" ")}`).toMatch(/Protobuf|JSON Schema/);
    // the compat topic keeps the direction claim but flags the specifics as per-format
    const compatText = compat.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(compatText).toMatch(/per format|separate compatibility checker|by number, not name/i);
  });

  it("notes the Protobuf message-index header in the Confluent wire format", () => {
    const wire = detail("What the Schema Registry adds").points.find((p) => p.term === "The wire format")!;
    expect(wire.detail).toMatch(/message-index/i);
  });

  it("says a soft-deleted schema still resolves by id so old records keep decoding", () => {
    const subj = detail("Subjects, versions, and naming strategies");
    const text = subj.points.map((p) => p.detail).join(" ");
    expect(text).toMatch(/soft delete still resolves by id|globally resolvable/i);
  });

  it("treats a deserialization failure as a poison record that stalls the partition", () => {
    const poison = detail("Deserialization failures and poison records");
    const text = `${poison.summary} ${poison.points.map((p) => p.detail).join(" ")}`;
    expect(text).toMatch(/inside poll\(\)|out of poll\(\)/i);
    expect(text).toMatch(/dead-letter|byte\[\]/i);
    expect(text).not.toMatch(/broker (validates|rejects|checks) the schema/i);
  });
});

describe("Module 7 — consumer groups and resilient processing (Phase 6c retitle)", () => {
  const m = getModule("consumer-configuration")!;

  it("moved onto the beginner path without moving its array position", () => {
    expect(m.index).toBe(7);
    expect(m.title).toMatch(/consumer groups and resilient processing/i);
    expect(m.track).toBe("beginner-path");
    expect(m.status).toBe("available");
    expect(m.prerequisites).toEqual(["mental-model", "build-a-producer-and-consumer"]);
  });

  it("sits after Schemas and before the Connect/Streams stub in beginner-path order", () => {
    const path = modules.filter((x) => x.track === "beginner-path").sort((a, b) => a.index - b.index);
    const slugs = path.map((x) => x.slug);
    expect(slugs.indexOf("schemas-and-data-contracts")).toBeLessThan(slugs.indexOf("consumer-configuration"));
    expect(slugs.indexOf("consumer-configuration")).toBeLessThan(slugs.indexOf("connect-and-streams"));
  });
});

describe("Module 8 — Kafka Connect and Kafka Streams (Phase 7a: Connect content + Lab D)", () => {
  const m = getModule("connect-and-streams")!;
  const detail = (t: string) => m.topicDetail![t];

  it("is now an available beginner-path module at index 8, with the Connect lab", () => {
    expect(m.index).toBe(8);
    expect(m.track).toBe("beginner-path");
    expect(m.status).toBe("available");
    expect(m.difficulty).toBe("intermediate");
    expect(m.prerequisites).toEqual(["build-a-producer-and-consumer", "consumer-configuration"]);
    expect(m.labs?.map((l) => l.slug)).toEqual(["lab-d-connect-file-pipeline"]);
  });

  it("covers all four topics — the two Connect ones and the two Streams ones", () => {
    expect(Object.keys(m.topicDetail ?? {})).toHaveLength(m.topics.length);
    for (const t of m.topics) {
      const d = m.topicDetail![t];
      expect(d, t).toBeDefined();
      expect(d.points.length, t).toBeGreaterThanOrEqual(3);
    }
  });

  it("frames Connect as config-not-code, and says it isn't a transformation engine", () => {
    const conn = detail("Kafka Connect: source and sink connectors");
    const text = conn.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).toMatch(/you configure, you don't code|configure it, you don't write it/i);
    expect(conn.watchOut).toMatch(/not a transformation engine/i);
    expect(conn.watchOut).toMatch(/Kafka Streams/);
  });

  it("distinguishes KStream (events) from KTable (latest value per key)", () => {
    const streams = detail("Kafka Streams: topologies, KStream, and KTable");
    const text = streams.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).toMatch(/KStream/);
    expect(text).toMatch(/KTable/);
    expect(text).toMatch(/latest value per key|current state/i);
    // Streams is a library, not a cluster — the module's whole pitch
    expect(`${streams.summary} ${text}`).toMatch(/library.*not a (cluster|service)|not a cluster/i);
  });

  it("names where stateful Streams operations keep their state and how it recovers", () => {
    const stateful = detail("Stateful processing: joins, aggregations, and windows");
    const text = stateful.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).toMatch(/state store|RocksDB/i);
    expect(text).toMatch(/changelog topic/i);
    expect(stateful.watchOut).toMatch(/window|cardinality/i);
  });
});

describe("Module 9 — broker and topic configuration (Phase 6d advanced-topic prefaces)", () => {
  const m = getModule("broker-topic-configuration")!;
  const advancedTopics = m.topics.filter((t) => m.topicDetail![t].level === "advanced");

  it("has more than one advanced topic to preface, and they're the deep mechanical ones", () => {
    expect(advancedTopics).toEqual([
      "Segment management",
      "Request and record-size limits",
      "Network and I/O threads",
      "Quotas",
      "Controller and KRaft settings",
      "Listener configuration",
      "Rack awareness",
    ]);
  });

  it("every advanced topic in this module has a plain-language preface", () => {
    for (const t of advancedTopics) {
      const preface = m.topicDetail![t].preface;
      expect(preface, t).toBeDefined();
      expect(preface!.length, t).toBeGreaterThan(40);
      // a preface earns its keep by explaining the "why", not repeating the config-key summary
      expect(preface, t).not.toBe(m.topicDetail![t].summary);
    }
  });

  it("does not overclaim: only advanced topics need a preface, not every topic in the module", () => {
    const nonAdvanced = m.topics.filter((t) => m.topicDetail![t].level !== "advanced");
    expect(nonAdvanced.length).toBeGreaterThan(0);
    // beginner/intermediate topics in this module may or may not have one; this just
    // confirms the assertion above didn't accidentally cover the whole module
    expect(advancedTopics.length).toBeLessThan(m.topics.length);
  });

  it("the rack-awareness preface doesn't claim replication factor alone survives a broker loss", () => {
    const preface = m.topicDetail!["Rack awareness"].preface!;
    // durability also needs the survivors to be in sync and electable, not just RF=3
    expect(preface).toMatch(/in sync|electable|electing|elected/i);
    expect(preface).not.toMatch(/replication factor 3 protects you from losing a broker\.\s/i);
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
