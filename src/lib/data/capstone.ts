import { Capstone } from "@/lib/types";

// The end-of-course project. No new repo code ships — the spec is the deliverable, and the
// learner builds it on the Lab B stack using everything the course covered.
export const capstoneProject: Capstone = {
  brief: `You have been handed the event backbone for **Larkspur**, a small online retailer. Checkout already emits an order event per purchase. Three teams are waiting on that stream: finance needs every order stored durably and exactly once end to end, the loyalty team needs a per-customer running total kept current, and the fraud team needs to replay the full history on demand without disturbing anyone else. A fourth consumer exports the loyalty totals to the analytics warehouse.

Build the whole pipeline yourself, on the three-broker Lab B cluster, with no step-by-step walkthrough. You decide the topic layout, the schema, the client configuration, the failure behaviour, and how it is observed. The work is graded against the rubric below — reliability and operational safety count as much as getting the totals right.

Everything you need has been covered: topic and partition design (Modules 1, 4), keys and delivery guarantees (Module 4), schemas and compatibility (Module 5), the producer and consumer you already built (Module 3), consumer groups and poison-record handling (Module 6), Connect and Streams (Module 8), the three-broker cluster and its failure modes (Module 2 / Lab B), and observability (Module 10).`,

  stack:
    "The Lab B three-broker cluster (local-cluster-lab/, brokers plus Schema Registry and Connect under --profile extras), Kafka 4.0, and the examples/order-pipeline-java project as your starting point.",

  requirements: [
    {
      id: "topics",
      title: "Design and create the topics",
      detail:
        "Create the order topic, the loyalty-totals topic (log-compacted), and a dead-letter topic. Choose a partition count for each from a stated throughput and consumer-parallelism target, set replication factor 3, and set min.insync.replicas=2 on the topics that must not lose an acknowledged write. Write down why each number is what it is.",
      buildsOn: ["mental-model", "keys-ordering-and-delivery", "broker-topic-configuration"],
    },
    {
      id: "schema",
      title: "Put the order event under a schema contract",
      detail:
        "Register a closed schema for the order value on the <topic>-value subject with BACKWARD compatibility, and have the producer serialize through the Schema Registry. Confirm an incompatible change (dropping a required field, changing a type) is rejected at registration, not at the consumer.",
      buildsOn: ["schemas-and-data-contracts"],
    },
    {
      id: "producer",
      title: "Write the idempotent, keyed producer and a load generator",
      detail:
        "acks=all, enable.idempotence=true, keyed by customerId so one customer's orders keep their order. Add a generator that sends at least 1000 orders across at least 20 customers, and have it exit non-zero if any send ultimately fails.",
      buildsOn: ["build-a-producer-and-consumer", "keys-ordering-and-delivery"],
    },
    {
      id: "consumer-group",
      title: "Build the finance consumer group with commit-after-write",
      detail:
        "enable.auto.commit=false; write the order to your store, then commitSync. Run three instances and show kafka-consumer-groups.sh reporting the partitions split across them, with total lag returning to zero after the backlog drains.",
      buildsOn: ["consumer-configuration", "build-a-producer-and-consumer"],
    },
    {
      id: "dead-letter",
      title: "Add a dead-letter path that never blocks a partition",
      detail:
        "A record that fails to deserialize or violates the schema is produced to the dead-letter topic with its original key, its headers, and added error metadata (the exception, the source topic-partition-offset). The source consumer commits past it and keeps going. A genuine downstream failure (your store is down) must still propagate and stop the commit.",
      buildsOn: ["consumer-configuration", "schemas-and-data-contracts"],
    },
    {
      id: "streams",
      title: "Aggregate a per-customer running total with Kafka Streams",
      detail:
        "Fold the order topic into a per-customer total on the compacted loyalty-totals topic, backed by a changelog. Intermediate updates need not all be emitted, but the final total per customer must equal the sum you can compute by hand from the generated orders.",
      buildsOn: ["connect-and-streams"],
    },
    {
      id: "connect-sink",
      title: "Export the totals with Kafka Connect",
      detail:
        "Run a sink connector that writes the loyalty-totals topic out to a file (or a table). Show it is an ordinary consumer group: kafka-consumer-groups.sh lists connect-<name> with its own committed offsets and lag.",
      buildsOn: ["connect-and-streams"],
    },
    {
      id: "replay",
      title: "Prove the fraud team's replay works in isolation",
      detail:
        "A separate consumer group reads the order topic from earliest and recomputes a per-customer total, matching the Streams result, while the finance group and the Streams app keep running untouched — their committed offsets and lag do not move because of the replay.",
      buildsOn: ["consumer-configuration", "connect-and-streams"],
    },
    {
      id: "failure-drill",
      title: "Run the broker-loss drill",
      detail:
        "Stop one broker and show the producer keeps succeeding while Isr is 2 (>= min.insync.replicas=2). Then raise the order topic's min.insync.replicas to 3 and, with that one broker still down, show acks=all writes are refused with NOT_ENOUGH_REPLICAS rather than silently lost. Restart the broker, wait for the ISR to refill, drop min.insync.replicas back to 2, and confirm the backlog clears. (Do not stop a second broker — that also loses the KRaft controller quorum, which is a different failure.)",
      buildsOn: ["local-cluster-lab", "keys-ordering-and-delivery"],
    },
    {
      id: "observability",
      title: "Make the pipeline observable",
      detail:
        "A Grafana view (or a documented set of PromQL / JMX queries) covering consumer-group lag per group, under-replicated partitions, producer error-rate, and the Streams app state. Define one alert threshold per signal and give a one-line rationale for each — lag as a sustained slope, not a single spike.",
      buildsOn: ["observability"],
    },
    {
      id: "runbook",
      title: "Write the 'loyalty totals look wrong' runbook",
      detail:
        "One page. How to tell whether the cause is the producer (missing or miskeyed orders), the Streams app (crashed, or lagging its input), or compaction (stale value never cleaned). The safe recovery for each, including the reset tool plus KafkaStreams.cleanUp(), and an explicit list of what the reset does NOT undo (the output topic's existing records, downstream consumer offsets).",
      buildsOn: ["connect-and-streams", "troubleshooting-scenarios"],
    },
  ],

  rubric: [
    {
      name: "Correctness",
      focus: "The system produces the right data, and you can prove it.",
      levels: [
        {
          label: "Meets",
          descriptor:
            "The schema is enforced at registration, same-customer orders stay on one partition, the Streams total per customer matches a hand computation, and the fraud replay reproduces that total.",
        },
        {
          label: "Partial",
          descriptor:
            "Totals are right in the steady state but a keying or schema gap lets some records through unvalidated, or the replay result is close but not reconciled to the live total.",
        },
        {
          label: "Missing",
          descriptor:
            "Totals disagree with a hand computation, or records land on partitions inconsistently, or the schema is not actually enforced.",
        },
      ],
    },
    {
      name: "Reliability",
      focus: "Acknowledged data is not lost, and one failure does not stall the pipeline.",
      levels: [
        {
          label: "Meets",
          descriptor:
            "acks=all with min.insync.replicas=2, commit strictly after the write, the dead-letter path never blocks a partition while a real downstream failure still does, and the drill shows one broker tolerated and two brokers refusing (not losing) writes.",
        },
        {
          label: "Partial",
          descriptor:
            "Durability settings are right but the consumer can double-process or skip on a crash, or the dead-letter handler also swallows genuine processing errors.",
        },
        {
          label: "Missing",
          descriptor:
            "acks or min.insync.replicas leave an acknowledged-loss window, or a single poison record stalls a partition, or the drill loses committed data.",
        },
      ],
    },
    {
      name: "Observability",
      focus: "An operator can see the pipeline's health without reading the code.",
      levels: [
        {
          label: "Meets",
          descriptor:
            "All four signals are visible, lag is presented as a trend, and each alert threshold has a rationale tied to a real failure it would catch.",
        },
        {
          label: "Partial",
          descriptor:
            "The signals exist but lag is only shown as an absolute number, or thresholds are set with no stated reasoning.",
        },
        {
          label: "Missing",
          descriptor:
            "Fewer than three signals, or no thresholds, or nothing that would page before customers notice.",
        },
      ],
    },
    {
      name: "Operational safety",
      focus: "Every destructive action is understood before it is run.",
      levels: [
        {
          label: "Meets",
          descriptor:
            "The runbook separates the three failure classes with the evidence for each, every destructive step (reset tool, topic delete, down -v) is annotated with what it erases, and the recovery notes state what a reset does not undo.",
        },
        {
          label: "Partial",
          descriptor:
            "The runbook covers recovery but does not distinguish the failure classes, or omits what the reset leaves behind.",
        },
        {
          label: "Missing",
          descriptor:
            "No runbook, or one that recommends a destructive reset without saying what it costs.",
        },
      ],
    },
  ],

  submission: [
    "A branch with the producer and load generator, the finance consumer, the Streams app, the connector configs, a topic-creation script, and the runbook as markdown.",
    "A short write-up: the topic and partition-count rationale, the four alert thresholds and why, and the broker-loss drill results (what you ran, what you observed).",
    "Your own rubric scores — for every dimension below \"Meets\", one sentence on what is missing and what you would do next.",
  ],
};
