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
              "The leader doesn't reply until every in-sync replica has the record. The only setting where an acknowledgment means durable-across-a-broker-failure.",
          },
          {
            term: "min.insync.replicas",
            detail:
              "A topic config, not a producer one. Turns \"all in-sync replicas\" into an enforceable minimum instead of best-effort.",
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
              "Total memory for records that have been sent but not yet acknowledged, across all partitions. Bounds a producer that generates faster than the broker or network can absorb.",
          },
          {
            term: "A full buffer",
            detail:
              "send() blocks the calling thread to give the broker a chance to catch up — it doesn't fail immediately.",
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
    topicNarrative: {
      "Consumer groups and partition assignment":
        "A consumer group is the unit of scaling and of offset tracking. Every consumer that shares a group.id is assigned a disjoint subset of the partitions across all the topics the group subscribes to — each partition is consumed by exactly one member at a time, which is what makes horizontal scaling work: add a consumer and the coordinator hands it some partitions to take over. The ceiling is the partition count. A topic with 6 partitions supports at most 6 working consumers in one group; a 7th sits idle with nothing assigned, because a partition is never split across two members.\n\nWhere the assignment is computed depends on the group protocol. Under the classic protocol, the coordinator picks one member as the group leader, that member runs the assignor and computes the mapping, and the coordinator just distributes the result. Under Kafka 4.0's new consumer group protocol (group.protocol=consumer), the broker computes the assignment itself and there is no leader. Either way, two different group.ids on the same topic are completely independent: each gets every partition, each tracks its own offsets, and neither affects the other. That's the difference between scaling one logical consumer (same group.id, more instances) and fanning the same data out to two separate applications (different group.ids).",
      "Polling and heartbeats":
        "A Kafka consumer is single-threaded around one loop: call poll(), get a batch of records, process them, call poll() again. Two separate liveness mechanisms watch that loop, and conflating them causes a lot of confusion. Heartbeats run on a background thread and fire every heartbeat.interval.ms; if the coordinator doesn't hear one within session.timeout.ms it assumes the consumer process is dead — a crash, a long GC pause, a network partition. That check keeps running even while your code is mid-processing.\n\nmax.poll.interval.ms is the other clock: the maximum wall time allowed between two consecutive poll() calls. It exists to catch a consumer that's alive and heartbeating but stuck — an infinite loop in a record handler, a downstream call that never returns. If processing one batch takes longer than max.poll.interval.ms, the consumer proactively leaves the group before it can call poll() again, and a rebalance moves its partitions elsewhere. max.poll.records caps how many records one poll() returns, which is the main lever for keeping a batch's total processing time under that interval.\n\nheartbeat.interval.ms and session.timeout.ms as described here are client settings under the classic group protocol. Kafka 4.0 ships a new consumer group protocol (KIP-848), opted into with group.protocol=consumer, where the broker drives heartbeat cadence and the session timeout — those two client configs are ignored. max.poll.interval.ms stays a client concern under both protocols, because only the client knows how long its own processing is taking.",
      "Offset commits":
        "A committed offset is a bookmark stored in the internal __consumer_offsets topic, one per (group, topic, partition). It records the offset of the next record the group should read — meaning a commit of offset N asserts \"everything below N is done.\" It's not the consumer's current read position (that's in-memory and moves every poll); it's the recovery point a new owner of that partition will resume from after a restart or rebalance.\n\nenable.auto.commit=true (the default) commits the current position automatically, but only during a poll() call and only once auto.commit.interval.ms has elapsed since the last commit. The subtle part: the offsets committed are for records returned by the previous poll, on the assumption you finished processing them before calling poll() again. If you didn't — you're still processing on another path, or you crash after poll() but before the work is done — auto-commit will have advanced the bookmark past records that were never actually handled. Manual commits (enable.auto.commit=false, then commitSync or commitAsync after processing) exist to tie the commit to the completion of work rather than to the poll loop's timing.",
      "Rebalance behavior":
        "A rebalance is the process of recomputing partition assignments for a group and redistributing them — triggered whenever membership changes (a consumer joins, leaves, or is declared dead) or the subscribed topic's partition count changes. Under the classic eager protocol, a rebalance is stop-the-world: every consumer revokes all of its partitions, the group re-forms, and new assignments are handed out. For the duration, no partition in the group is being consumed. A group that rebalances constantly — because session.timeout.ms is too tight for its GC behavior, or processing keeps blowing past max.poll.interval.ms — can spend more time rebalancing than working.\n\nThe operational goals are to make rebalances rare (stable membership, processing that comfortably fits the poll interval) and, when they do happen, cheap (cooperative assignment, static membership). A rebalance also invalidates any uncommitted work: partitions you were processing get revoked, so anything not committed before the revoke will be re-delivered to whoever picks them up.\n\nAll of the above is the classic group protocol, where one elected member computes the assignment and the whole group synchronizes through the coordinator to adopt it. Kafka 4.0's new consumer group protocol (group.protocol=consumer, KIP-848) moves assignment computation to the broker and delivers the reconciliation incrementally through each member's heartbeat responses — there's no stop-the-world barrier and no client-side assignor to configure. It's opt-in in 4.0; a group left on the classic protocol behaves exactly as described here.",
      "Static membership":
        "Normally, a consumer that restarts is a brand-new member as far as the coordinator is concerned — it gets a fresh member ID, so the restart looks like one consumer leaving and a different one joining, and each of those triggers a rebalance. For a rolling deployment across N instances that's 2N rebalances to end up exactly where you started.\n\nStatic membership (set group.instance.id to a stable, unique value per instance) tells the coordinator to remember this member across disconnects. If a static member drops and reconnects within session.timeout.ms, the coordinator gives it back the exact partitions it had and skips the rebalance entirely. The tradeoff is deliberate: genuine failures now take up to session.timeout.ms to be noticed instead of being caught fast, so static membership usually comes with a longer session timeout and is paired with deployment tooling that bounces instances quickly enough to stay inside that window.",
      "Cooperative assignment":
        "Cooperative assignment (the CooperativeStickyAssignor) changes what a rebalance costs. Instead of every consumer revoking everything and starting over, the assignor computes the new distribution, and only the partitions that actually need to move are revoked — in a first rebalance round the losing consumers give up just those partitions, and a second round assigns them to their new owners. Consumers keep processing every partition they're not losing straight through the rebalance.\n\nIt is not automatically active. The default partition.assignment.strategy is the list [RangeAssignor, CooperativeStickyAssignor], and a group uses the first assignor every member has in common — which is RangeAssignor, an eager one. A consumer group that never touched this config is doing stop-the-world Range assignment. You opt into cooperative rebalancing by making CooperativeStickyAssignor the only strategy. If the group is already on the default list, that's a single rolling bounce that just removes RangeAssignor. It's two rolling bounces only when you're coming from an eager-only assignor that isn't already paired with a cooperative one: first deploy the list with both, then deploy again with the eager one removed — the group can't switch to the cooperative protocol until no member still offers only the eager one.\n\nThe practical payoff: adding one consumer to a large group then moves a handful of partitions and pauses only those, instead of pausing the entire group. The \"sticky\" part means the assignor also tries to keep partitions with their existing owner across rebalances, so a transient membership blip doesn't reshuffle everything. Kafka 4.0's new consumer group protocol (group.protocol=consumer) sidesteps this whole client-side question — assignment is computed on the broker and applied incrementally by design, with no assignor list to manage.",
      "Poison messages and retry strategies":
        "A poison message is a record the consumer can't process successfully no matter how many times it tries — malformed payload, a schema it can't deserialize, a business rule it always violates. The dangerous default plays out in two steps. First, the raw consumer doesn't redeliver a failed record on its own: poll() has already moved its in-memory position past that batch, so an exception that just propagates out of the loop actually skips the poison record (and often the rest of its batch) rather than retrying it. Second, the moment anything resumes from the last committed offset — a rebalance, a restart, or an error handler that calls seek() (which is what Spring Kafka's default handler does) — the poison record comes back, fails again, and is never committed past. Now the partition stops advancing, lag grows without bound, and every record behind the poison one is blocked even though nothing is wrong with them.\n\nThe standard fix is to bound in-place retries (a few immediate attempts for genuinely transient failures) and then get the bad record out of the main flow. A dead-letter topic is the common destination: after max attempts, the consumer produces the record — plus metadata about why it failed — to a separate DLT, commits past it on the original partition, and moves on. Head-of-line blocking is gone and the failed records are retained for inspection or manual replay. Non-blocking retry topics (a chain of topics each with an increasing delay) are the more elaborate version, used when failures are often transient-but-slow and you want delayed retries without holding up the main partition. The invariant across all of these: never advance the committed offset past a record until it has either been processed or deliberately routed somewhere durable.",
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
