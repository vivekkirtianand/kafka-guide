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
    topicNarrative: {
      "Prevent acknowledged data loss (acks, enable.idempotence, retries)":
        "acks controls what \"successful\" means. acks=0 means the producer never waits for a response — the record may not have even reached the broker. acks=1 means the leader wrote it to its own log, but if the leader dies before followers replicate it, an in-sync follower can be elected leader without that record: the producer was told it succeeded, and it's gone anyway. acks=all is the only setting where the acknowledgment means the record is durable across a broker failure — the leader doesn't reply until every in-sync replica has it, which min.insync.replicas (a topic config, not a producer one) makes enforceable rather than best-effort.\n\nacks alone doesn't make retries safe, though. If a produce request times out after the broker actually wrote it, a naive retry sends the same record again and the log now has a duplicate. enable.idempotence=true (the default) closes that gap: the producer tags each batch with a producer ID and sequence number, and the broker discards a retry it's already seen. retries then becomes safe to leave at its effectively-unbounded default, because idempotence is what prevents \"safe to retry\" from also meaning \"safe to duplicate.\"",
      "Improve batching (batch.size, linger.ms)":
        "A batch is accumulated per partition: the producer groups records destined for the same partition together before writing them to disk on the broker, rather than paying that per-record overhead individually. That's a separate thing from a produce request over the network — one request to a broker can bundle the batches for every partition on that broker the producer currently has data for, so requests and batches aren't a 1:1 relationship. Batching is what makes both cheaper: fuller batches mean fewer, more efficient requests.\n\nlinger.ms is how long the producer will wait, after the first record in a batch arrives, before sending it anyway even if the batch isn't full — trading a small amount of added latency for a much fuller, more efficient batch. batch.size is the other trigger: if enough records arrive quickly enough to fill it before linger.ms elapses, the batch sends immediately regardless of the timer. Kafka 4.0 raised the default linger.ms from 0 to 5, on the reasoning that 5ms of added latency is negligible for nearly every workload and the batching win is not — though even at linger.ms=0, records that happen to arrive together can still land in the same batch; the setting only disables intentionally waiting for more.",
      "Control memory and backpressure (buffer.memory, max.block.ms)":
        "buffer.memory is the total memory the producer will use to hold records that have been sent but not yet acknowledged, across every partition. It exists because a producer can generate records faster than the broker (or the network) can absorb them — without a bound, an application under load could grow producer memory without limit.\n\nWhen the buffer is full, send() doesn't fail immediately — it blocks the calling thread, giving the broker a chance to catch up and free space. max.block.ms is how long it will block before giving up and throwing a TimeoutException instead. This is backpressure, not a durability control: a full buffer means the producer is being throttled by memory, not that any data has been lost. The failure mode to watch for is the opposite of a crash — a calling thread that appears hung for up to max.block.ms with no error, because nothing has actually failed yet.",
      "Handle large records (max.request.size)":
        "max.request.size caps the largest single produce request the producer will construct, which in practice caps the largest individual record it will accept. It's enforced synchronously inside send() — a record over the limit throws a RecordTooLargeException immediately, before the record is ever batched or reaches the network, not later as a delayed broker rejection.\n\nThis limit only matters relative to the broker side: the broker (and the topic, if it overrides the broker default) enforces its own maximum message size independently. Raising max.request.size on the producer without raising the matching limit on the broker doesn't help — it just moves where the same record gets rejected, from an immediate local exception to a failed request round trip.",
      "Bound request latency (request.timeout.ms, delivery.timeout.ms)":
        "These sound similar but bound different things. request.timeout.ms is how long the producer waits for a broker's response to one specific produce request before treating that attempt as failed and moving on to a retry. It's scoped to a single network round trip.\n\ndelivery.timeout.ms is the outer budget: the total time from calling send() to the record's final outcome — success or failure — covering the linger wait, every retry, and every request.timeout.ms window along the way. It's the setting that actually determines how long the producer keeps trying before giving up on a record and delivering a TimeoutException to the application's callback, which is why it — not retries — is the practical bound on retry behavior. request.timeout.ms has to stay comfortably below delivery.timeout.ms, or a single slow request could burn the entire delivery budget in one attempt.",
      "Preserve ordering during retries":
        "Kafka only guarantees order within a partition, and only among records the producer actually sent in that order — retries are exactly where that guarantee is easiest to accidentally break. max.in.flight.requests.per.connection controls how many produce requests can be outstanding to a broker at once, unacknowledged, before the producer waits for a response. If more than one is in flight and an earlier one fails and gets retried while a later one succeeds first, the later record lands in the log before the earlier one — silent reordering, with no error raised anywhere.\n\nenable.idempotence=true closes this gap the same way it closes the duplicate-on-retry gap: the broker tracks sequence numbers per partition and can detect and correctly order out-of-sequence retries, which is why it's safe to run with up to 5 in-flight requests (the max Kafka allows once idempotence is on) instead of being forced down to max.in.flight.requests.per.connection=1 to get the same guarantee.",
      "Use transactions (transactional.id, transaction timeouts)":
        "Idempotence already guarantees no duplicates independently within each partition a producer writes to — a producer can idempotently write to many partitions at once, each tracked separately. What it doesn't give you is atomicity across those partitions: nothing stops one partition's write from succeeding while another's fails. Transactions add exactly that: either every record across every partition in the transaction becomes visible to read_committed consumers, or none of them do. Setting transactional.id turns this on for a producer and also fences out any older producer instance still running with the same ID — the classic \"zombie\" scenario after a restart — which is why transactions require enable.idempotence=true and acks=all underneath.\n\ntransaction.timeout.ms bounds the other failure mode: a transaction that's had a partition added but was never committed or aborted, which would otherwise block read_committed consumers from reading past it indefinitely — the clock starts when the first partition is added, not at beginTransaction(). It also can't exceed the broker's transaction.max.timeout.ms, or initialization itself fails. Once the timeout elapses, the coordinator proactively aborts the transaction so consumers aren't left waiting on a producer that may never come back; the producer's next attempt to continue that transaction is then fenced.",
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
        "A consumer group is the unit of scaling and of offset tracking. Every consumer that shares a group.id is assigned a disjoint subset of the partitions across all the topics the group subscribes to — each partition is consumed by exactly one member at a time, which is what makes horizontal scaling work: add a consumer and the coordinator hands it some partitions to take over. The ceiling is the partition count. A topic with 6 partitions supports at most 6 working consumers in one group; a 7th sits idle with nothing assigned, because a partition is never split across two members.\n\nThe assignment itself is computed by one elected member (the group leader), not the broker — the coordinator only picks the leader and distributes the result. Two different group.ids on the same topic are completely independent: each gets every partition, each tracks its own offsets, and neither affects the other. That's the difference between scaling one logical consumer (same group.id, more instances) and fanning the same data out to two separate applications (different group.ids).",
      "Polling and heartbeats":
        "A Kafka consumer is single-threaded around one loop: call poll(), get a batch of records, process them, call poll() again. Two separate liveness mechanisms watch that loop, and conflating them causes a lot of confusion. Heartbeats run on a background thread and fire every heartbeat.interval.ms; if the coordinator doesn't hear one within session.timeout.ms it assumes the consumer process is dead — a crash, a long GC pause, a network partition. That check keeps running even while your code is mid-processing.\n\nmax.poll.interval.ms is the other clock: the maximum wall time allowed between two consecutive poll() calls. It exists to catch a consumer that's alive and heartbeating but stuck — an infinite loop in a record handler, a downstream call that never returns. If processing one batch takes longer than max.poll.interval.ms, the consumer proactively leaves the group before it can call poll() again, and a rebalance moves its partitions elsewhere. max.poll.records caps how many records one poll() returns, which is the main lever for keeping a batch's total processing time under that interval.\n\nheartbeat.interval.ms and session.timeout.ms as described here are client settings under the classic group protocol. Kafka 4.0 ships a new consumer group protocol (KIP-848), opted into with group.protocol=consumer, where the broker drives heartbeat cadence and the session timeout — those two client configs are ignored. max.poll.interval.ms stays a client concern under both protocols, because only the client knows how long its own processing is taking.",
      "Offset commits":
        "A committed offset is a bookmark stored in the internal __consumer_offsets topic, one per (group, topic, partition). It records the offset of the next record the group should read — meaning a commit of offset N asserts \"everything below N is done.\" It's not the consumer's current read position (that's in-memory and moves every poll); it's the recovery point a new owner of that partition will resume from after a restart or rebalance.\n\nenable.auto.commit=true (the default) commits the current position automatically, but only during a poll() call and only once auto.commit.interval.ms has elapsed since the last commit. The subtle part: the offsets committed are for records returned by the previous poll, on the assumption you finished processing them before calling poll() again. If you didn't — you're still processing on another path, or you crash after poll() but before the work is done — auto-commit will have advanced the bookmark past records that were never actually handled. Manual commits (enable.auto.commit=false, then commitSync or commitAsync after processing) exist to tie the commit to the completion of work rather than to the poll loop's timing.",
      "Rebalance behavior":
        "A rebalance is the process of recomputing partition assignments for a group and redistributing them — triggered whenever membership changes (a consumer joins, leaves, or is declared dead) or the subscribed topic's partition count changes. Under the classic eager protocol, a rebalance is stop-the-world: every consumer revokes all of its partitions, the group re-forms, and new assignments are handed out. For the duration, no partition in the group is being consumed. A group that rebalances constantly — because session.timeout.ms is too tight for its GC behavior, or processing keeps blowing past max.poll.interval.ms — can spend more time rebalancing than working.\n\nThe operational goals are to make rebalances rare (stable membership, processing that comfortably fits the poll interval) and, when they do happen, cheap (cooperative assignment, static membership). A rebalance also invalidates any uncommitted work: partitions you were processing get revoked, so anything not committed before the revoke will be re-delivered to whoever picks them up.\n\nAll of the above is the classic group protocol, where one elected member computes the assignment and the whole group synchronizes through the coordinator to adopt it. Kafka 4.0's new consumer group protocol (group.protocol=consumer, KIP-848) moves assignment computation to the broker and delivers the reconciliation incrementally through each member's heartbeat responses — there's no stop-the-world barrier and no client-side assignor to configure. It's opt-in in 4.0; a group left on the classic protocol behaves exactly as described here.",
      "Static membership":
        "Normally, a consumer that restarts is a brand-new member as far as the coordinator is concerned — it gets a fresh member ID, so the restart looks like one consumer leaving and a different one joining, and each of those triggers a rebalance. For a rolling deployment across N instances that's 2N rebalances to end up exactly where you started.\n\nStatic membership (set group.instance.id to a stable, unique value per instance) tells the coordinator to remember this member across disconnects. If a static member drops and reconnects within session.timeout.ms, the coordinator gives it back the exact partitions it had and skips the rebalance entirely. The tradeoff is deliberate: genuine failures now take up to session.timeout.ms to be noticed instead of being caught fast, so static membership usually comes with a longer session timeout and is paired with deployment tooling that bounces instances quickly enough to stay inside that window.",
      "Cooperative assignment":
        "Cooperative assignment (the CooperativeStickyAssignor) changes what a rebalance costs. Instead of every consumer revoking everything and starting over, the assignor computes the new distribution, and only the partitions that actually need to move are revoked — in a first rebalance round the losing consumers give up just those partitions, and a second round assigns them to their new owners. Consumers keep processing every partition they're not losing straight through the rebalance.\n\nIt is not automatically active. The default partition.assignment.strategy is the list [RangeAssignor, CooperativeStickyAssignor], and a group uses the first assignor every member has in common — which is RangeAssignor, an eager one. A consumer group that never touched this config is doing stop-the-world Range assignment. You opt into cooperative rebalancing by setting CooperativeStickyAssignor as the strategy, and switching a running group takes a two-step rolling upgrade — deploy with both assignors listed, then deploy again with RangeAssignor removed — because the group can't agree on the cooperative protocol until no member still prefers the eager one.\n\nThe practical payoff: adding one consumer to a large group then moves a handful of partitions and pauses only those, instead of pausing the entire group. The \"sticky\" part means the assignor also tries to keep partitions with their existing owner across rebalances, so a transient membership blip doesn't reshuffle everything. Kafka 4.0's new consumer group protocol (group.protocol=consumer) sidesteps this whole client-side question — assignment is computed on the broker and applied incrementally by design, with no assignor list to manage.",
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
