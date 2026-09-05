import { GlossaryTerm } from "@/lib/types";

// Core Kafka vocabulary for the beginner path. Definitions stay short and conceptual —
// mechanics live in the modules, which `modules` links to.
export const glossary: GlossaryTerm[] = [
  {
    slug: "event",
    term: "Event (record)",
    definition:
      "A single immutable fact written to Kafka — something that happened, with a timestamp. Carries a key, a value, and optional headers. Also called a record or a message.",
    seeAlso: ["key", "offset", "topic"],
    modules: ["why-kafka", "mental-model"],
  },
  {
    slug: "topic",
    term: "Topic",
    definition:
      "A named, append-only log that events are published to and read from. Split into partitions for scale; retained by time or size regardless of who has read it.",
    seeAlso: ["partition", "retention", "log-compaction"],
    modules: ["why-kafka", "mental-model", "broker-topic-configuration"],
  },
  {
    slug: "partition",
    term: "Partition",
    definition:
      "One ordered, append-only slice of a topic, and Kafka's unit of parallelism and ordering. Each partition is stored and replicated independently. Ordering is guaranteed only within a single partition.",
    seeAlso: ["topic", "offset", "key", "replica"],
    modules: ["why-kafka", "mental-model"],
  },
  {
    slug: "offset",
    term: "Offset",
    definition:
      "The position of a record within its partition — a monotonically increasing integer assigned by the broker on append. Consumers track an offset to know where they are; reading does not consume.",
    seeAlso: ["partition", "consumer-group", "lag"],
    modules: ["why-kafka", "mental-model", "consumer-configuration"],
  },
  {
    slug: "key",
    term: "Key",
    definition:
      "An optional field on a record. Its hash picks the partition, so all records with the same key land on the same partition and stay ordered. A null key spreads records across partitions.",
    seeAlso: ["partition", "event", "log-compaction"],
    modules: ["why-kafka", "mental-model", "keys-ordering-and-delivery", "producer-configuration"],
  },
  {
    slug: "broker",
    term: "Broker",
    definition:
      "One Kafka server process. A cluster is a set of brokers; each holds a subset of the cluster's partitions and serves reads and writes for the partitions it leads.",
    seeAlso: ["cluster", "controller", "leader"],
    modules: ["why-kafka", "mental-model", "broker-topic-configuration"],
  },
  {
    slug: "cluster",
    term: "Cluster",
    definition:
      "A group of brokers working together, coordinated by a controller quorum. Topics, partitions and their replicas are distributed across the cluster's brokers.",
    seeAlso: ["broker", "controller", "kraft"],
    modules: ["why-kafka", "mental-model", "local-cluster-lab"],
  },
  {
    slug: "producer",
    term: "Producer",
    definition:
      "A client that publishes records to topics. Chooses the partition (via the key or a partitioner), batches records, and — depending on acks — waits for the broker to acknowledge the write.",
    seeAlso: ["consumer", "acks", "idempotence"],
    modules: ["why-kafka", "producer-configuration"],
  },
  {
    slug: "consumer",
    term: "Consumer",
    definition:
      "A client that reads records from topic-partitions, tracking its offset as it goes. Consumers usually run as part of a consumer group.",
    seeAlso: ["consumer-group", "offset", "lag", "rebalance"],
    modules: ["why-kafka", "consumer-configuration"],
  },
  {
    slug: "consumer-group",
    term: "Consumer group",
    definition:
      "A set of consumers that share the work of a subscription: each partition is assigned to exactly one member. Adding members scales throughput up to the partition count; the group commits offsets collectively.",
    seeAlso: ["consumer", "rebalance", "offset"],
    modules: ["why-kafka", "consumer-configuration"],
  },
  {
    slug: "rebalance",
    term: "Rebalance",
    definition:
      "The process of reassigning partitions among a consumer group's members when one joins, leaves, or is deemed dead. Frequent rebalances stall consumption and drive lag up.",
    seeAlso: ["consumer-group", "lag"],
    modules: ["consumer-configuration", "observability"],
  },
  {
    slug: "replica",
    term: "Replica",
    definition:
      "A copy of a partition on a broker. The replication factor sets how many copies exist; they sit on different brokers so the partition survives a broker loss.",
    seeAlso: ["replication-factor", "leader", "follower", "isr"],
    modules: ["mental-model", "broker-topic-configuration"],
  },
  {
    slug: "replication-factor",
    term: "Replication factor",
    definition:
      "The number of replicas Kafka keeps for each partition of a topic. A factor of R needs at least R brokers and tolerates up to R−1 broker failures for availability (fewer for guaranteed durability).",
    seeAlso: ["replica", "isr", "min-insync-replicas"],
    modules: ["why-kafka", "broker-topic-configuration"],
  },
  {
    slug: "leader",
    term: "Leader",
    definition:
      "The one replica of a partition that handles all of its client reads and writes at a given time. The controller elects a new leader from the ISR if the current one fails.",
    seeAlso: ["follower", "isr", "controller", "replica"],
    modules: ["keys-ordering-and-delivery"],
  },
  {
    slug: "follower",
    term: "Follower",
    definition:
      "A non-leader replica that continuously fetches from the leader to stay caught up. Followers don't serve clients (barring rack-aware follower fetching); a caught-up follower is eligible to become leader.",
    seeAlso: ["leader", "isr", "replica"],
    modules: ["keys-ordering-and-delivery"],
  },
  {
    slug: "isr",
    term: "In-sync replicas (ISR)",
    definition:
      "The set of replicas currently caught up with the leader. A follower that falls behind for longer than replica.lag.time.max.ms is dropped from the ISR and rejoins once it catches up.",
    seeAlso: ["leader", "follower", "min-insync-replicas", "replication-factor"],
    modules: ["keys-ordering-and-delivery", "broker-topic-configuration", "observability"],
  },
  {
    slug: "min-insync-replicas",
    term: "min.insync.replicas",
    definition:
      "A topic/broker setting: the minimum ISR size for a write with acks=all to be accepted. If the ISR drops below it, those writes fail with NOT_ENOUGH_REPLICAS rather than risking data loss.",
    seeAlso: ["isr", "acks", "replication-factor"],
    modules: ["keys-ordering-and-delivery", "broker-topic-configuration", "troubleshooting-scenarios"],
  },
  {
    slug: "acks",
    term: "acks",
    definition:
      "A producer setting for how many acknowledgements to wait for: 0 (fire and forget), 1 (leader only), or all (every in-sync replica). Only acks=all with min.insync.replicas ≥ 2 protects an acknowledged write from a single broker loss.",
    seeAlso: ["min-insync-replicas", "idempotence", "producer"],
    modules: ["keys-ordering-and-delivery", "producer-configuration"],
  },
  {
    slug: "idempotence",
    term: "Idempotent producer",
    definition:
      "A producer mode where each batch carries a producer id and per-partition sequence number, so the broker rejects duplicates and out-of-order batches from retries. It does not by itself give end-to-end exactly-once.",
    seeAlso: ["acks", "exactly-once", "transaction"],
    modules: ["keys-ordering-and-delivery", "producer-configuration"],
  },
  {
    slug: "transaction",
    term: "Transaction",
    definition:
      "An atomic group of writes across partitions, plus the consumer offsets that produced them. With read_committed consumers this gives Kafka-to-Kafka exactly-once processing.",
    seeAlso: ["idempotence", "exactly-once"],
    modules: ["producer-configuration"],
  },
  {
    slug: "at-least-once",
    term: "At-least-once",
    definition:
      "A delivery guarantee where every record is processed, but a crash between processing and committing the offset can reprocess some. The common default; pairs with idempotent downstream writes.",
    seeAlso: ["at-most-once", "exactly-once", "offset"],
    modules: ["keys-ordering-and-delivery", "consumer-configuration"],
  },
  {
    slug: "at-most-once",
    term: "At-most-once",
    definition:
      "A delivery guarantee where the offset is committed before processing, so a crash skips records rather than repeating them. Records can be lost.",
    seeAlso: ["at-least-once", "exactly-once"],
    modules: ["keys-ordering-and-delivery"],
  },
  {
    slug: "exactly-once",
    term: "Exactly-once (EOS)",
    definition:
      "The observable result of each record being processed once. In Kafka it is scoped to Kafka-to-Kafka pipelines, built from transactions plus read_committed consumers; external side effects still need their own idempotency.",
    seeAlso: ["transaction", "idempotence", "at-least-once"],
    modules: ["keys-ordering-and-delivery", "producer-configuration"],
  },
  {
    slug: "retention",
    term: "Retention",
    definition:
      "The policy that ages records out of a topic by time (retention.ms) or size (retention.bytes, per partition). Independent of whether any consumer has read them.",
    seeAlso: ["log-compaction", "topic", "lag"],
    modules: ["why-kafka", "broker-topic-configuration"],
  },
  {
    slug: "log-compaction",
    term: "Log compaction",
    definition:
      "A cleanup policy that keeps only the latest record per key, instead of deleting by age. Used for changelog-style topics; a null value (a tombstone) marks a key for removal.",
    seeAlso: ["tombstone", "retention", "key"],
    modules: ["why-kafka", "broker-topic-configuration"],
  },
  {
    slug: "tombstone",
    term: "Tombstone",
    definition:
      "A record with a non-null key and a null value. On a compacted topic it signals that the key should be deleted once consumers have had a chance to see it.",
    seeAlso: ["log-compaction", "key"],
    modules: ["broker-topic-configuration"],
  },
  {
    slug: "controller",
    term: "Controller",
    definition:
      "The role that owns cluster metadata — partition leadership, ISR changes, topic creation. In KRaft a quorum of controllers replicates this metadata as its own log, one active and the rest hot standbys. A server runs as a controller, as a broker, or (in small clusters) as both — set by process.roles.",
    seeAlso: ["kraft", "broker", "leader"],
    modules: ["keys-ordering-and-delivery", "broker-topic-configuration", "observability"],
  },
  {
    slug: "kraft",
    term: "KRaft",
    definition:
      "Kafka Raft — the built-in consensus protocol that stores cluster metadata in a replicated log managed by a controller quorum. Replaces ZooKeeper; the only metadata mode in Kafka 4.x.",
    seeAlso: ["controller", "zookeeper", "cluster"],
    modules: ["keys-ordering-and-delivery", "broker-topic-configuration", "local-cluster-lab"],
  },
  {
    slug: "zookeeper",
    term: "ZooKeeper",
    definition:
      "The external coordination service Kafka used for metadata before KRaft. Removed in Kafka 4.0 (KIP-833); relevant only when running older clusters.",
    seeAlso: ["kraft", "controller"],
    modules: ["keys-ordering-and-delivery"],
  },
  {
    slug: "lag",
    term: "Consumer lag",
    definition:
      "How far a consumer group is behind, per partition: the log-end offset minus the group's committed offset. A rising slope means consumption can't keep up; check it per partition, not just as a total.",
    seeAlso: ["offset", "consumer-group", "rebalance"],
    modules: ["observability", "troubleshooting-scenarios"],
  },
  {
    slug: "dead-letter-queue",
    term: "Dead-letter topic (DLQ)",
    definition:
      "A separate topic that a consumer or connector routes records to when they can't be processed — a poison message, a deserialization failure — so the main partition keeps flowing.",
    seeAlso: ["poison-message", "consumer"],
    modules: ["build-a-producer-and-consumer", "schemas-and-data-contracts", "consumer-configuration"],
  },
  {
    slug: "poison-message",
    term: "Poison message",
    definition:
      "A record a consumer cannot process and keeps failing on — a malformed payload, a deserialization failure, a business rule it always violates. With an unbounded retry it stalls the whole partition; the fixes are to skip it, or route it to a dead-letter topic.",
    seeAlso: ["dead-letter-queue", "lag"],
    modules: ["build-a-producer-and-consumer", "schemas-and-data-contracts", "consumer-configuration", "troubleshooting-scenarios"],
  },
  {
    slug: "schema-registry",
    term: "Schema Registry",
    definition:
      "A service that stores versioned record schemas (Avro, Protobuf, JSON Schema) and enforces compatibility rules, so producers and consumers can evolve independently. Records carry a schema id, not the schema.",
    seeAlso: ["serialization", "subject", "schema-compatibility"],
    modules: ["why-kafka", "schemas-and-data-contracts"],
  },
  {
    slug: "serialization",
    term: "Serialization",
    definition:
      "Turning a record's key and value into the bytes Kafka stores. Kafka itself only moves bytes; the serializer (and matching deserializer on the consumer) defines the format.",
    seeAlso: ["schema-registry", "event"],
    modules: ["why-kafka", "schemas-and-data-contracts", "producer-configuration"],
  },
  {
    slug: "subject",
    term: "Subject",
    definition:
      "The name a schema is registered under in the Schema Registry — by default <topic>-value or <topic>-key. A subject holds an ordered list of schema versions and its own compatibility setting.",
    seeAlso: ["schema-registry", "schema-compatibility"],
    modules: ["schemas-and-data-contracts"],
  },
  {
    slug: "schema-compatibility",
    term: "Schema compatibility mode",
    definition:
      "The rule the Schema Registry checks a new schema version against: BACKWARD (default — new consumers read old data), FORWARD (old consumers read new data), FULL (both), or NONE (no check). It decides which side you upgrade first. BACKWARD, FORWARD and FULL each also have a transitive variant that checks against every earlier version, not just the last.",
    seeAlso: ["schema-registry", "subject"],
    modules: ["schemas-and-data-contracts"],
  },
  {
    slug: "bootstrap-servers",
    term: "bootstrap.servers",
    definition:
      "The initial list of broker host:port pairs a client contacts to discover the rest of the cluster. Only needs to reach one live broker; the full topology comes back in the metadata response.",
    seeAlso: ["broker", "cluster"],
    modules: ["producer-configuration", "consumer-configuration"],
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return glossary.find((t) => t.slug === slug);
}
