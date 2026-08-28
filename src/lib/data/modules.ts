import { Module } from "@/lib/types";

export const modules: Module[] = [
  {
    slug: "mental-model",
    index: 1,
    title: "Kafka mental model",
    summary:
      "The append-only log, brokers, partitions, replicas, and the ordering and delivery guarantees everything else is built on.",
    topics: [
      "Kafka's append-only log",
      "Brokers, topics, partitions, replicas",
      "Leaders, followers, ISR, and controllers",
      "Producers, consumers, offsets, and consumer groups",
      "Ordering guarantees",
      "At-most-once, at-least-once, and exactly-once processing",
    ],
    activities: [
      "Animate a record moving from producer to partition replicas and consumer",
      "Change partition counts and observe ordering",
      "Simulate broker failure and leader election",
      "Predict what happens before revealing the result",
    ],
    status: "available",
  },
  {
    slug: "local-cluster-lab",
    index: 2,
    title: "Local cluster laboratory",
    summary:
      "A reproducible three-broker KRaft cluster with CLI tools, a Kafka UI, and Prometheus/Grafana for hands-on labs.",
    topics: [
      "Three Kafka brokers in KRaft mode",
      "Kafka CLI tools",
      "A simple producer and consumer",
      "Kafka UI",
      "Metrics collection with Prometheus and Grafana",
      "Optional Schema Registry and Kafka Connect",
    ],
    activities: [
      "Create and inspect topics",
      "Produce records with and without keys",
      "Observe partition placement",
      "Stop and restart brokers",
      "Inspect consumer offsets",
      "Change topic-level configuration safely",
    ],
    status: "external",
  },
  {
    slug: "producer-configuration",
    index: 3,
    title: "Producer configuration",
    summary:
      "Configuration organized by goal — durability, batching, backpressure, latency, ordering, and transactions.",
    topics: [
      "Prevent acknowledged data loss (acks, enable.idempotence, retries)",
      "Improve batching (batch.size, linger.ms)",
      "Control memory and backpressure (buffer.memory, max.block.ms)",
      "Handle large records (max.request.size)",
      "Bound request latency (request.timeout.ms, delivery.timeout.ms)",
      "Preserve ordering during retries",
      "Use transactions (transactional.id, transaction timeouts)",
    ],
    topicDetail: {
      "Prevent acknowledged data loss (acks, enable.idempotence, retries)": {
        summary:
          "acks defines what \"success\" means; idempotence is what makes repeating that success safe.",
        configs: ["acks", "enable.idempotence", "retries", "min.insync.replicas"],
        points: [
          {
            term: "acks=0",
            detail:
              "The producer never waits for a response. The record may not have reached the broker at all.",
          },
          {
            term: "acks=1",
            detail:
              "The leader wrote it to its own log. If the leader dies before followers replicate, an in-sync follower can be elected without the record — you were told it succeeded and it's gone.",
          },
          {
            term: "acks=all",
            detail:
              "The leader doesn't reply until every replica currently in the ISR has the record. Necessary for broker-failure durability, but not sufficient on its own — if the ISR has shrunk to just the leader, acks=all still acknowledges a single-copy write.",
          },
          {
            term: "min.insync.replicas",
            detail:
              "A topic (or broker) config, not a producer one. The minimum ISR size an acks=all write is accepted with — set it to 2+ so a lone leader can't ack a single copy. Below it, the leader rejects produce requests with NOT_ENOUGH_REPLICAS. This, plus a replication factor above it, is what actually guarantees multiple copies exist.",
          },
          {
            term: "enable.idempotence=true (default)",
            detail:
              "Tags each batch with a producer ID and sequence number so the broker discards a retry it has already seen. This is what lets retries default to effectively unbounded without also meaning \"safe to duplicate.\"",
          },
        ],
        watchOut:
          "acks=all alone doesn't make retries safe. If a produce request times out after the broker already wrote the record, a naive retry appends it a second time — idempotence is what closes that gap.",
      },
      "Improve batching (batch.size, linger.ms)": {
        summary:
          "Records are grouped per partition before they're sent; fuller batches mean fewer, cheaper requests.",
        configs: ["batch.size", "linger.ms"],
        points: [
          {
            term: "Batch vs request",
            detail:
              "A batch is per-partition. One network request to a broker can bundle the batches for every partition on that broker — batches and requests aren't 1:1.",
          },
          {
            term: "linger.ms",
            detail:
              "How long the producer waits after the first record in a batch before sending anyway, trading a little latency for a fuller batch. Kafka 4.0 raised the default from 0 to 5.",
          },
          {
            term: "batch.size",
            detail:
              "The other trigger: if records fill it before linger.ms elapses, the batch sends immediately regardless of the timer.",
          },
          {
            term: "linger.ms=0",
            detail:
              "Doesn't disable batching — records that happen to arrive together still share a batch. It only disables intentionally waiting for more.",
          },
        ],
        watchOut:
          "A bigger batch.size only helps if records actually arrive fast enough to fill it. Otherwise linger.ms is doing all the work.",
      },
      "Control memory and backpressure (buffer.memory, max.block.ms)": {
        summary:
          "The producer buffers unsent records in memory; when that fills, send() blocks rather than failing.",
        configs: ["buffer.memory", "max.block.ms"],
        points: [
          {
            term: "buffer.memory",
            detail:
              "The budget for records buffered in the producer waiting to be sent, across all partitions. It roughly — not exactly — tracks the producer's footprint: compression buffers and in-flight requests use memory on top of it.",
          },
          {
            term: "A full buffer",
            detail:
              "send() blocks the calling thread to give the sender thread a chance to drain the buffer to the brokers — it doesn't fail immediately.",
          },
          {
            term: "max.block.ms",
            detail:
              "How long send() will block before giving up and throwing a TimeoutException.",
          },
          {
            term: "Backpressure, not data loss",
            detail:
              "A full buffer means the producer is being throttled by memory. Nothing has been lost.",
          },
        ],
        watchOut:
          "The failure mode is the opposite of a crash — a calling thread that looks hung for up to max.block.ms with no error, because nothing has actually failed yet.",
      },
      "Handle large records (max.request.size)": {
        summary:
          "Caps the largest request the producer will build, enforced locally inside send() before batching.",
        configs: ["max.request.size"],
        points: [
          {
            term: "What it caps",
            detail:
              "The largest single produce request, which in practice caps the largest individual record the producer will accept.",
          },
          {
            term: "Enforced synchronously",
            detail:
              "A record over the limit throws RecordTooLargeException immediately inside send(), before it's batched or sent — not as a delayed broker rejection.",
          },
          {
            term: "Only matters relative to the broker",
            detail:
              "The broker, and the topic if it overrides the broker default, enforce their own maximum message size independently.",
          },
        ],
        watchOut:
          "Raising max.request.size without raising the matching broker or topic limit just moves where the same record is rejected — from a local exception to a failed round trip.",
      },
      "Bound request latency (request.timeout.ms, delivery.timeout.ms)": {
        summary:
          "One bounds a single network round trip; the other bounds the whole journey from send() to final outcome.",
        configs: ["request.timeout.ms", "delivery.timeout.ms"],
        points: [
          {
            term: "request.timeout.ms",
            detail:
              "How long the producer waits for a broker's response to one produce request before treating that attempt as failed. Scoped to a single round trip.",
          },
          {
            term: "delivery.timeout.ms",
            detail:
              "The outer budget: total time from send() to success or failure, covering the linger wait, every retry, and every request.timeout.ms window along the way.",
          },
          {
            term: "The real retry bound",
            detail:
              "delivery.timeout.ms — not retries — is what actually determines how long the producer keeps trying before delivering a TimeoutException to the callback.",
          },
        ],
        watchOut:
          "request.timeout.ms must stay comfortably below delivery.timeout.ms, or one slow request can burn the entire delivery budget in a single attempt.",
      },
      "Preserve ordering during retries": {
        summary:
          "Kafka only orders records within a partition, and retries are the easiest way to break that by accident.",
        configs: ["max.in.flight.requests.per.connection", "enable.idempotence"],
        points: [
          {
            term: "max.in.flight.requests.per.connection",
            detail:
              "How many produce requests can be outstanding to a broker at once, unacknowledged, before the producer waits for a response.",
          },
          {
            term: "How reordering happens",
            detail:
              "If more than one request is in flight and an earlier one fails and is retried while a later one already succeeded, the later record lands in the log first — silent, with no error raised.",
          },
          {
            term: "enable.idempotence=true",
            detail:
              "The broker tracks sequence numbers per partition and correctly orders out-of-sequence retries, which is why up to 5 in-flight requests stay safe.",
          },
        ],
        watchOut:
          "Without idempotence, the only way to guarantee order under retries is max.in.flight.requests.per.connection=1 — which costs throughput.",
      },
      "Use transactions (transactional.id, transaction timeouts)": {
        summary:
          "Idempotence gives no-duplicates per partition; transactions add all-or-nothing atomicity across partitions.",
        configs: ["transactional.id", "transaction.timeout.ms"],
        points: [
          {
            term: "What idempotence lacks",
            detail:
              "A producer can write idempotently to many partitions at once, but nothing stops one partition's write succeeding while another's fails.",
          },
          {
            term: "What transactions add",
            detail:
              "Either every record across every partition in the transaction becomes visible to read_committed consumers, or none of them do.",
          },
          {
            term: "transactional.id",
            detail:
              "Turns transactions on and fences out any older producer instance still running with the same ID — the \"zombie\" after a restart. Requires enable.idempotence=true and acks=all.",
          },
          {
            term: "transaction.timeout.ms",
            detail:
              "Bounds a transaction that had a partition added but was never committed or aborted. The clock starts when the first partition is added, not at beginTransaction(), and it can't exceed the broker's transaction.max.timeout.ms.",
          },
        ],
        watchOut:
          "An open transaction blocks read_committed consumers from reading past it. When the timeout elapses the coordinator aborts it, and the producer's next attempt to continue that transaction is fenced.",
      },
    },
    activities: [
      "Compare acks=0, acks=1, and acks=all",
      "Introduce latency and measure batching and throughput",
      "Kill the partition leader during production",
      "Fill the producer buffer",
      "Send duplicates with and without idempotence",
      "Trigger record-size and delivery-timeout failures",
    ],
    status: "available",
  },
  {
    slug: "consumer-configuration",
    index: 4,
    title: "Consumer configuration",
    summary:
      "Consumer groups, partition assignment, offset commits, rebalances, and poison-message handling.",
    topics: [
      "Consumer groups and partition assignment",
      "Polling and heartbeats",
      "Offset commits",
      "Rebalance behavior",
      "Static membership",
      "Cooperative assignment",
      "Poison messages and retry strategies",
    ],
    topicDetail: {
      "Consumer groups and partition assignment": {
        summary:
          "A group is the unit of both scaling and offset tracking; each partition goes to exactly one member at a time.",
        configs: ["group.id", "group.protocol"],
        points: [
          {
            term: "group.id",
            detail:
              "Every consumer sharing it gets a disjoint subset of the subscribed partitions. Add a consumer and the coordinator hands it partitions to take over — that is horizontal scaling.",
          },
          {
            term: "The ceiling is the partition count",
            detail:
              "6 partitions supports at most 6 working consumers in one group. A 7th sits idle — a partition is never split across two members.",
          },
          {
            term: "Where the assignment is computed",
            detail:
              "Classic protocol: the coordinator elects one member as group leader to run the assignor. New protocol (group.protocol=consumer, Kafka 4.0): the broker computes it, with no leader.",
          },
          {
            term: "Two group.ids are independent",
            detail:
              "Same topic, different group.id: each gets every partition and tracks its own offsets. Same group.id plus more instances is scaling one consumer; a different group.id fans the same data out to a second application.",
          },
        ],
        watchOut:
          "Running more consumers than partitions doesn't add throughput — the extra members are assigned nothing and sit idle.",
      },
      "Polling and heartbeats": {
        summary:
          "Two independent liveness clocks watch the poll loop; conflating them is the source of most rebalance confusion.",
        configs: [
          "heartbeat.interval.ms",
          "session.timeout.ms",
          "max.poll.interval.ms",
          "max.poll.records",
          "group.protocol",
        ],
        points: [
          {
            term: "Heartbeats",
            detail:
              "A background thread sends one every heartbeat.interval.ms. If the coordinator hears none within session.timeout.ms it assumes the process is dead — a crash, a long GC pause, a network partition. This runs even while your code is mid-processing.",
          },
          {
            term: "max.poll.interval.ms",
            detail:
              "The maximum wall time allowed between two consecutive poll() calls. It catches a consumer that is alive and heartbeating but stuck in a record handler. Overrun it and the consumer leaves the group before it can poll again.",
          },
          {
            term: "max.poll.records",
            detail:
              "Caps how many records one poll() returns — the main lever for keeping a batch's total processing time under max.poll.interval.ms.",
          },
          {
            term: "Under the new protocol (KIP-848)",
            detail:
              "group.protocol=consumer: the broker drives heartbeat cadence and the session timeout, so those two client configs are ignored. max.poll.interval.ms stays a client concern under both protocols.",
          },
        ],
        watchOut:
          "A session.timeout.ms too tight for the app's GC behavior, or processing that keeps overrunning max.poll.interval.ms, makes a group rebalance constantly — sometimes more than it actually works.",
      },
      "Offset commits": {
        summary:
          "A committed offset is the recovery point for the next owner of a partition — not the consumer's live read position.",
        configs: ["enable.auto.commit", "auto.commit.interval.ms"],
        points: [
          {
            term: "What it is",
            detail:
              "A bookmark in the internal __consumer_offsets topic, one per (group, topic, partition). A commit of offset N asserts \"everything below N is done.\"",
          },
          {
            term: "Not the read position",
            detail:
              "The read position is in-memory and moves every poll. The committed offset is where a new owner of the partition resumes after a restart or rebalance.",
          },
          {
            term: "enable.auto.commit=true (default)",
            detail:
              "Commits the current position during a poll() call, once auto.commit.interval.ms has elapsed — for the records returned by the previous poll, on the assumption you finished processing them.",
          },
          {
            term: "Manual commits",
            detail:
              "enable.auto.commit=false, then commitSync or commitAsync after processing — ties the commit to work completion instead of the poll loop's timing.",
          },
        ],
        watchOut:
          "Auto-commit advances the bookmark past records that were never handled if you're still processing them on another path, or crash after poll() but before the work is done.",
      },
      "Rebalance behavior": {
        summary:
          "Recomputing and redistributing a group's partition assignments — cheap to make rare, expensive when it's constant.",
        configs: ["partition.assignment.strategy", "group.protocol"],
        points: [
          {
            term: "What triggers it",
            detail:
              "Membership changes — a consumer joins, leaves, or is declared dead — or the subscribed topic's partition count changes.",
          },
          {
            term: "Classic eager protocol",
            detail:
              "Stop-the-world: every consumer revokes all of its partitions, the group re-forms, and new assignments go out. No partition in the group is consumed for the duration.",
          },
          {
            term: "Uncommitted work is lost",
            detail:
              "Revoked partitions get reassigned, so anything not committed before the revoke is re-delivered to whoever picks them up.",
          },
          {
            term: "New protocol (group.protocol=consumer, KIP-848)",
            detail:
              "Assignment moves to the broker and reconciliation is incremental through heartbeat responses — no stop-the-world barrier, no client-side assignor. Opt-in in 4.0.",
          },
        ],
        watchOut:
          "The operational goal is two-fold: make rebalances rare (stable membership, processing that fits the poll interval) and cheap when they happen (cooperative assignment, static membership).",
      },
      "Static membership": {
        summary:
          "Lets a restarting consumer keep its identity, so a rolling deploy doesn't cost two rebalances per instance.",
        configs: ["group.instance.id", "session.timeout.ms"],
        points: [
          {
            term: "The default",
            detail:
              "A restarted consumer is a brand-new member with a fresh member ID. The restart looks like one consumer leaving and another joining — two rebalances. A rolling deploy of N instances is 2N.",
          },
          {
            term: "group.instance.id",
            detail:
              "A stable, unique value per instance tells the coordinator to remember this member across disconnects. Reconnect within session.timeout.ms and it gets its exact partitions back with no rebalance.",
          },
          {
            term: "The tradeoff",
            detail:
              "Genuine failures now take up to session.timeout.ms to be noticed instead of being caught fast.",
          },
        ],
        watchOut:
          "Usually paired with a longer session.timeout.ms and deployment tooling that bounces instances quickly enough to reconnect inside that window.",
      },
      "Cooperative assignment": {
        summary:
          "Changes what a rebalance costs — only the partitions that actually move are paused, not the whole group.",
        configs: ["partition.assignment.strategy", "group.protocol"],
        points: [
          {
            term: "How it works",
            detail:
              "The assignor computes the new distribution; only partitions that need to move are revoked (round one), then assigned to their new owners (round two). Consumers keep processing everything they're not losing.",
          },
          {
            term: "Not on by default",
            detail:
              "The default partition.assignment.strategy is [RangeAssignor, CooperativeStickyAssignor]; a group uses the first strategy every member shares — RangeAssignor, an eager one. Untouched groups do stop-the-world Range assignment.",
          },
          {
            term: "Opting in",
            detail:
              "Make CooperativeStickyAssignor the only strategy. From the default list that's one rolling bounce; from an eager-only assignor it's two — deploy both, then deploy again with the eager one removed.",
          },
          {
            term: "The \"sticky\" part",
            detail:
              "The assignor also tries to keep partitions with their existing owner across rebalances, so a transient membership blip doesn't reshuffle everything.",
          },
        ],
        watchOut:
          "The new protocol (group.protocol=consumer) sidesteps this entirely — assignment is broker-side and incremental by design, with no assignor list to manage.",
      },
      "Poison messages and retry strategies": {
        summary:
          "A record that always fails will block its entire partition unless you route it out of the main flow.",
        points: [
          {
            term: "What it is",
            detail:
              "A record the consumer can't process no matter how many times it tries — malformed payload, an undeserializable schema, a business rule it always violates.",
          },
          {
            term: "The raw consumer doesn't retry it",
            detail:
              "poll() already moved the in-memory position past that batch, so an exception propagating out of the loop skips the poison record (and often the rest of its batch).",
          },
          {
            term: "Then it comes back",
            detail:
              "Any resume from the last committed offset — a rebalance, a restart, or an error handler that calls seek() (Spring Kafka's default) — replays it, it fails again, and the offset never advances. Lag grows without bound and every record behind it is blocked.",
          },
          {
            term: "The fix",
            detail:
              "Bound in-place retries for genuinely transient failures, then move the bad record out: a dead-letter topic (produce it plus failure metadata elsewhere, then commit past it), or non-blocking retry topics for transient-but-slow failures.",
          },
        ],
        watchOut:
          "The invariant: never advance the committed offset past a record until it has either been processed or deliberately routed somewhere durable.",
      },
    },
    activities: [
      "Make processing exceed max.poll.interval.ms",
      "Add and remove consumer instances",
      "Compare automatic and manual commits",
      "Crash a consumer before and after committing",
      "Reset offsets and replay data",
      "Process a poison message using retry and dead-letter topics",
    ],
    status: "available",
  },
  {
    slug: "broker-topic-configuration",
    index: 5,
    title: "Broker and topic configuration",
    summary:
      "Replication, retention, compaction, request limits, quotas, and listener/security configuration.",
    topics: [
      "Replication and durability",
      "Retention and compaction",
      "Segment management",
      "Request and record-size limits",
      "Network and I/O threads",
      "Quotas",
      "Controller and KRaft settings",
      "Listener configuration",
      "Security",
      "Rack awareness",
      "Automatic topic creation and defaults",
    ],
    activities: [],
    status: "planned",
  },
  {
    slug: "observability",
    index: 6,
    title: "Observability",
    summary: "Moving from symptom to evidence across lag, ISR, latency, disk, network, and GC signals.",
    topics: [
      "Consumer lag and lag growth rate",
      "Under-replicated and offline partitions",
      "ISR changes",
      "Request latency and request queues",
      "Produce and fetch error rates",
      "Disk usage and disk latency",
      "Network saturation",
      "Controller health",
      "JVM memory and garbage collection",
      "Rebalance frequency",
      "Log-cleaner performance",
    ],
    activities: [
      "Present an unlabeled dashboard and identify the bottleneck: producer, broker, consumer, disk, network, or downstream processing",
    ],
    status: "planned",
  },
  {
    slug: "troubleshooting-scenarios",
    index: 7,
    title: "Troubleshooting scenarios",
    summary:
      "A searchable symptom → evidence → cause → resolution catalog covering the most common Kafka incidents.",
    topics: [
      "Consumer lag",
      "Frequent consumer rebalances",
      "NOT_ENOUGH_REPLICAS",
      "Under-replicated partitions",
      "Timeout errors",
      "Disk usage growth",
      "Large-message failures",
      "Hot partitions",
      "Data loss, duplicates, and out-of-order records",
      "Connectivity and authentication",
    ],
    activities: [],
    status: "planned",
  },
];

export function getModule(slug: string): Module | undefined {
  return modules.find((m) => m.slug === slug);
}
