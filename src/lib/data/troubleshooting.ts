import { TroubleshootingEntry } from "@/lib/types";

export const troubleshooting: TroubleshootingEntry[] = [
  {
    slug: "consumer-lag",
    symptom: "Consumer lag",
    overview:
      "Lag is log-end-offset minus the group's committed offset, per partition. The number alone isn't the signal — a rising slope pages you, a flat number still has to clear your latency SLA and stay inside retention. Scale last, after you've found what's actually slow.",
    causes: [
      {
        cause: "Slow record processing",
        evidence:
          "Measured per-record processing time × max.poll.records is close to (or over) the gap between poll() calls. records-consumed-rate is well below the produce rate.",
      },
      {
        cause: "Too few partitions for the throughput",
        evidence:
          "Every partition already has a consumer, each consumer is at its CPU or I/O ceiling, and partition count equals the maximum useful parallelism.",
      },
      {
        cause: "Rebalance loops",
        evidence:
          "Non-zero rebalance-rate-per-hour, repeated JoinGroup requests on the coordinator, and consumption stalling every cycle — see “Frequent consumer rebalances”.",
      },
      {
        cause: "Large backlog after downtime",
        evidence:
          "Lag jumped at a deploy or outage and is now draining on a steady negative slope. ETA ≈ current lag ÷ (consume rate − produce rate).",
      },
      {
        cause: "Conservative fetch sizing",
        evidence:
          "max.poll.records is low so each poll does little work, or fetch.min.bytes / fetch.max.wait.ms make fetches inefficient. fetch-latency-avg and fetch-size-avg confirm it.",
      },
      {
        cause: "Downstream dependency latency",
        evidence:
          "Processing time tracks a database or HTTP call's p99. Lag correlates with that dependency's latency, not with any Kafka metric.",
      },
      {
        cause: "Hot partition",
        evidence:
          "One partition's lag far exceeds the rest while the group total looks acceptable — see “Hot partitions”.",
      },
    ],
    resolutionFlow: [
      "Classify the lag: growing (under-provisioned or stuck), flat-but-high (check time lag and retention headroom), or draining (estimate the ETA and wait).",
      "Break lag down per partition — one stuck partition hides in the group total.",
      "Measure real per-record processing time; compare max.poll.records × that against the actual poll interval.",
      "Rule out rebalances and consumer exceptions in the logs before assuming a capacity problem.",
      "Check broker-side fetch latency to confirm the brokers aren't the bottleneck.",
      "Only add consumers or partitions once the bottleneck is located — and never past the partition count.",
    ],
    keyConfigs: ["max.poll.records", "max.poll.interval.ms", "fetch.min.bytes", "fetch.max.wait.ms"],
    watchOut:
      "Adding consumers beyond the partition count leaves them idle — a partition is never split across consumers in one group. If a single partition is the problem, more consumers can't help; raise per-partition throughput or repartition.",
  },
  {
    slug: "frequent-rebalances",
    symptom: "Frequent consumer rebalances",
    overview:
      "A rebalance reassigns partitions across a group. Rare ones are cheap; a group re-forming every few minutes loses most of its consumption time. Under the classic eager protocol every rebalance is stop-the-world for the whole group.",
    causes: [
      {
        cause: "Processing overruns max.poll.interval.ms",
        evidence:
          "The gap between poll() calls exceeds the interval; the broker logs “member … leaving group” and it correlates with slow batches.",
      },
      {
        cause: "Session timeout too tight for GC pauses",
        evidence:
          "GC logs show stop-the-world pauses near session.timeout.ms; the heartbeat thread is starved during the pause and the coordinator declares the member dead.",
      },
      {
        cause: "Unstable instances",
        evidence:
          "Rebalance timestamps line up with pod restarts, OOMKills, or autoscaler scale-downs.",
      },
      {
        cause: "Rolling deployments",
        evidence:
          "One rebalance as each instance stops and another as it rejoins — N instances can mean up to 2N rebalances per deploy, with no static membership configured.",
      },
      {
        cause: "Eager assignment strategy",
        evidence:
          "partition.assignment.strategy is RangeAssignor or RoundRobinAssignor, so every rebalance revokes all partitions group-wide instead of only the ones moving.",
      },
      {
        cause: "Pauses on the coordinator broker",
        evidence:
          "JoinGroup / SyncGroup latency spikes on the broker hosting the group coordinator, from GC or network stalls there.",
      },
    ],
    resolutionFlow: [
      "Correlate rebalance timestamps with deploys, pod events, and GC logs.",
      "Compare max.poll.interval.ms against the real worst-case time to process a full max.poll.records batch.",
      "Check session.timeout.ms and heartbeat.interval.ms against observed GC pauses (heartbeat.interval.ms ≈ one third of session.timeout.ms).",
      "For rolling deploys, use static membership (group.instance.id) so a quick restart doesn't trigger a rebalance.",
      "Move from eager assignment to CooperativeStickyAssignor, or to the KIP-848 consumer protocol, to make rebalances incremental.",
    ],
    keyConfigs: [
      "max.poll.interval.ms",
      "session.timeout.ms",
      "heartbeat.interval.ms",
      "group.instance.id",
      "partition.assignment.strategy",
      "group.protocol",
    ],
    watchOut:
      "Raising max.poll.interval.ms hides slow processing, but it also lengthens how long a genuinely dead consumer holds its partitions before the group recovers. Fix the processing time or lower max.poll.records first.",
  },
  {
    slug: "not-enough-replicas",
    symptom: "NOT_ENOUGH_REPLICAS",
    overview:
      "An acks=all produce is refused because the partition's in-sync replica count is below min.insync.replicas. NOT_ENOUGH_REPLICAS is returned before the append; NOT_ENOUGH_REPLICAS_AFTER_APPEND means the leader wrote the record but couldn't get enough acknowledgements. It's a durability guardrail firing, not a Kafka fault.",
    causes: [
      {
        cause: "A follower is down or slow",
        evidence:
          "UnderReplicatedPartitions > 0, IsrShrinksPerSec fired on the leader, and one broker has dropped out of the ISR for the affected partitions.",
      },
      {
        cause: "min.insync.replicas equals the replication factor",
        evidence:
          "kafka-configs --describe on the topic shows min.insync.replicas = RF, so any single replica blip crosses the floor.",
      },
      {
        cause: "Rolling restart in progress",
        evidence:
          "The errors coincide with a broker bounce and clear within seconds once that broker catches up and rejoins the ISR.",
      },
      {
        cause: "Slow follower disk or network",
        evidence:
          "Replica fetch lag and ISR flapping localized to one broker; disk await or NIC utilization elevated there.",
      },
      {
        cause: "Too few brokers for the replication factor",
        evidence:
          "The topic's RF exceeds the number of live brokers (created oversized, or after a broker loss), so full ISR is unreachable.",
      },
    ],
    resolutionFlow: [
      "For each affected partition, get the current ISR size and compare it to min.insync.replicas and the replication factor.",
      "Identify which replicas are out of sync and which broker they live on.",
      "Repair the follower — disk, network, GC, or a restart — so the ISR refills and durability is restored.",
      "Do not lower min.insync.replicas to silence the error unless you accept that acks=all now guarantees fewer copies.",
      "If the cluster is genuinely short a broker, add capacity or reassign replicas — RF can't exceed the broker count.",
    ],
    keyConfigs: [
      "min.insync.replicas",
      "acks",
      "replica.lag.time.max.ms",
      "unclean.leader.election.enable",
    ],
    watchOut:
      "min.insync.replicas equal to the replication factor leaves zero fault tolerance for writes — a routine rolling restart will reject acks=all produces. The common safe pairing is RF 3 with min.insync.replicas 2.",
  },
  {
    slug: "under-replicated-partitions",
    symptom: "Under-replicated partitions",
    overview:
      "UnderReplicatedPartitions counts partitions whose ISR is smaller than the assigned replica set — a replica is down or can't keep up. A brief spike during a rolling restart is expected; a sustained non-zero count is an incident.",
    causes: [
      {
        cause: "Broker outage",
        evidence:
          "Every partition with a replica on the down broker is under-replicated; the count matches that broker's replica assignment.",
      },
      {
        cause: "Replica fetch latency on one broker",
        evidence:
          "That broker's followers lag; disk await time or NIC saturation is elevated on it specifically.",
      },
      {
        cause: "Disk pressure",
        evidence:
          "Slow appends on the follower, log-flush latency and LocalTimeMs rising on that broker.",
      },
      {
        cause: "Network saturation",
        evidence:
          "ReplicationBytesInPerSec near the NIC's line rate, TCP retransmits climbing.",
      },
      {
        cause: "Leftover replication throttle",
        evidence:
          "leader.replication.throttled.rate / follower.replication.throttled.rate still set from a past reassignment, capping catch-up bandwidth.",
      },
      {
        cause: "Uneven partition or leadership distribution",
        evidence:
          "One broker leads or hosts far more partitions than the others and is saturated.",
      },
    ],
    resolutionFlow: [
      "Run kafka-topics --describe --under-replicated-partitions and note which brokers host the missing replicas.",
      "Check that broker's disk await, free space, NIC utilization, and GC pauses.",
      "Check for stale replication throttle configs before blaming hardware.",
      "Restore the broker, or reassign partitions and leadership if it's a distribution problem.",
      "Wait for the ISR to return to full size on every partition — the metric returning to zero is the resolved signal.",
    ],
    keyConfigs: [
      "replica.lag.time.max.ms",
      "num.replica.fetchers",
      "leader.replication.throttled.rate",
      "follower.replication.throttled.rate",
    ],
    watchOut:
      "A replication throttle left over from a previous partition reassignment is a classic cause of replicas that never catch up. Check for throttle configs on the topic and brokers before assuming a hardware fault.",
  },
  {
    slug: "timeout-errors",
    symptom: "Timeout errors",
    overview:
      "“Timeout” is several different clocks. The exception type tells you which one fired — chasing the wrong one wastes the incident.",
    causes: [
      {
        cause: "Metadata timeout (max.block.ms)",
        evidence:
          "TimeoutException from send() or partitionsFor() before any record leaves — the producer can't fetch metadata: bootstrap failure, DNS, or a missing topic.",
      },
      {
        cause: "Request timeout (request.timeout.ms)",
        evidence:
          "A single produce or fetch round trip exceeded the limit; the broker is slow or the network is dropping packets.",
      },
      {
        cause: "Delivery timeout (delivery.timeout.ms)",
        evidence:
          "Records expire in the accumulator after retries; usually a partition whose leader is unavailable or constantly changing.",
      },
      {
        cause: "Poll interval expiration (max.poll.interval.ms)",
        evidence:
          "The consumer is removed from the group and the next commit throws CommitFailedException — see “Frequent consumer rebalances”.",
      },
      {
        cause: "Transaction timeout (transaction.timeout.ms)",
        evidence:
          "The transactional producer didn't commit or abort in time and the broker aborted the transaction.",
      },
      {
        cause: "Network or DNS failure",
        evidence:
          "Connection-level timeouts across many request types at once, from one client host or network.",
      },
    ],
    resolutionFlow: [
      "Read the exact exception and message — it names the timeout that fired.",
      "Determine scope: one partition or broker (leadership, a slow broker) versus cluster-wide (network, DNS, controller).",
      "Check DNS resolution and TCP connectivity from the client host to every advertised broker address.",
      "Compare the configured timeout against observed request latency (broker TotalTimeMs, client request-latency-avg).",
      "Fix the underlying latency or availability; raising the timeout only buys time and can mask a real regression.",
    ],
    keyConfigs: [
      "request.timeout.ms",
      "delivery.timeout.ms",
      "max.block.ms",
      "max.poll.interval.ms",
      "transaction.timeout.ms",
    ],
    watchOut:
      "delivery.timeout.ms is the upper bound on linger.ms plus request.timeout.ms plus all retries. Setting request.timeout.ms higher than delivery.timeout.ms is rejected by the client as a misconfiguration.",
  },
  {
    slug: "disk-usage-growth",
    symptom: "Disk usage growth",
    overview:
      "Kafka writes until a log directory fills, then that directory goes offline and takes its replicas of those partitions with it. Retention won't free space fast enough once you're close — you need headroom to act before then.",
    causes: [
      {
        cause: "Retention set higher than expected",
        evidence:
          "retention.ms / retention.bytes on the topic, multiplied by the ingestion rate, exceeds the space budgeted for it.",
      },
      {
        cause: "Unexpected ingestion increase",
        evidence:
          "Per-topic BytesInPerSec is well above baseline — a new producer, a retry loop, or a traffic shift.",
      },
      {
        cause: "Partition imbalance across brokers",
        evidence:
          "One broker's log directory is far fuller than the others; leadership or replica placement is skewed.",
      },
      {
        cause: "Compaction falling behind",
        evidence:
          "On compacted topics: log-cleaner max-dirty-percent high, cleaner lag growing, or a dead cleaner thread (silent with the default log.cleaner.threads=1).",
      },
      {
        cause: "Segments not rolling",
        evidence:
          "A low-volume partition whose active segment never closes because segment.ms and segment.bytes are large — retention only acts on closed segments.",
      },
      {
        cause: "Future-dated record timestamps",
        evidence:
          "Time-based retention is measured from the record timestamp; a producer clock skewed into the future keeps segments alive past their real age.",
      },
    ],
    resolutionFlow: [
      "Compare configured retention (ms and bytes) against the actual growth rate and free space.",
      "Check per-topic BytesInPerSec against baseline to spot a runaway producer.",
      "On compacted topics, check log-cleaner metrics and that the cleaner threads are alive.",
      "Confirm segments are rolling — retention can't delete the active segment.",
      "Check the record timestamp distribution for future-dated records blocking expiry.",
      "If growth is uneven across brokers, reassign partitions; if it's a real capacity need, add disk or brokers.",
    ],
    keyConfigs: [
      "retention.ms",
      "retention.bytes",
      "segment.ms",
      "segment.bytes",
      "log.cleaner.threads",
      "min.cleanable.dirty.ratio",
    ],
    watchOut:
      "Dropping retention.ms sharply on a large topic to reclaim space can push lagging consumers past the new log start; they hit OffsetOutOfRange and auto.offset.reset jumps them forward, silently skipping data. Lower it in steps and watch consumer offsets.",
  },
  {
    slug: "large-message-failures",
    symptom: "Large-message failures",
    overview:
      "A record has to clear four independent size limits — producer, broker/topic, replica fetch, and consumer. RecordTooLargeException from any of them looks similar; a fix has to cover all four.",
    causes: [
      {
        cause: "Producer max.request.size",
        evidence:
          "RecordTooLargeException thrown synchronously from send(), before the record is ever transmitted.",
      },
      {
        cause: "Broker message.max.bytes",
        evidence:
          "The broker rejects the batch in the produce response; this value is also the cluster-wide default for new topics.",
      },
      {
        cause: "Topic-level max.message.bytes override",
        evidence:
          "kafka-configs --describe on the topic shows a max.message.bytes stricter (or looser) than the broker default.",
      },
      {
        cause: "Replica fetch limit",
        evidence:
          "A record the leader accepted that followers can't replicate wedges the ISR; modern defaults tie replica.fetch.max.bytes to message.max.bytes, but a hand-tuned cluster can still hit it.",
      },
      {
        cause: "Consumer fetch limits",
        evidence:
          "fetch.max.bytes / max.partition.fetch.bytes below the batch size; modern consumers still return the first batch to make progress, very old clients stall.",
      },
    ],
    resolutionFlow: [
      "Identify which side threw — producer (synchronous, before send), broker (in the produce response), or consumer (on poll).",
      "Line up all four limits: producer max.request.size, broker message.max.bytes, topic max.message.bytes, and the consumer fetch limits.",
      "Decide between raising limits consistently and keeping messages small (claim-check: payload in object storage, a reference on the topic).",
      "If raising, change producer, topic/broker, and consumer together, and roll carefully.",
    ],
    keyConfigs: [
      "max.request.size",
      "message.max.bytes",
      "max.message.bytes",
      "replica.fetch.max.bytes",
      "max.partition.fetch.bytes",
      "compression.type",
    ],
    watchOut:
      "Raising message.max.bytes cluster-wide inflates broker memory pressure and replication traffic for every topic, not just the one that needed it. Prefer a topic-level max.message.bytes override.",
  },
  {
    slug: "hot-partitions",
    symptom: "Hot partitions",
    overview:
      "One partition carries a disproportionate share of traffic. The group's total lag can look fine while that partition's consumer is permanently behind and one broker runs hot.",
    causes: [
      {
        cause: "Poor record-key distribution",
        evidence:
          "Per-partition BytesInPerSec and MessagesInPerSec are skewed; a handful of keys account for most records.",
      },
      {
        cause: "A dominant tenant or key",
        evidence:
          "One customer ID or entity is a large fraction of traffic and all of its records hash to a single partition.",
      },
      {
        cause: "Partition count too low for the key set",
        evidence:
          "Even with well-distributed keys, there aren't enough partitions to spread the load below the per-partition ceiling.",
      },
      {
        cause: "Assignment skew",
        evidence:
          "RangeAssignor stacks the low-numbered partitions of co-subscribed topics onto one consumer, which then can't keep up.",
      },
    ],
    resolutionFlow: [
      "Compare per-partition throughput and per-partition lag to quantify the skew.",
      "Check key cardinality and the frequency of the top keys.",
      "Decide whether the partition count is adequate for that key distribution.",
      "Fix the partitioning: a better key, key salting (a bucket suffix), or an explicit partitioner — knowing this changes per-key ordering.",
      "If it's assignment skew, switch to a sticky or round-robin assignor, or add partitions and consumers together.",
    ],
    keyConfigs: ["partitioner.class", "partitioner.ignore.keys", "num.partitions", "partition.assignment.strategy"],
    watchOut:
      "Increasing the partition count changes the key-to-partition mapping for every key, so existing keys scatter and per-key ordering across the change boundary is not preserved. Repartition during a quiet window and expect a temporary consumer reshuffle.",
  },
  {
    slug: "data-integrity-issues",
    symptom: "Data loss, duplicates, and out-of-order records",
    overview:
      "Three different symptoms with three different diagnostic paths — don't conflate them. Data loss means copies weren't kept. Duplicates mean something was delivered twice. Out-of-order means concurrency or repartitioning.",
    causes: [
      {
        cause: "Data loss: weak producer durability",
        evidence:
          "acks=0 or acks=1 with a leader failure at the loss timestamp; check the controller log for a leader change then.",
      },
      {
        cause: "Data loss: unclean leader election",
        evidence:
          "unclean.leader.election.enable=true and a broker log line naming an unclean election — an out-of-sync replica became leader and truncated ahead of it.",
      },
      {
        cause: "Data loss: replication floor too low",
        evidence:
          "min.insync.replicas of 1, or replication factor of 1 or 2, combined with a broker failure.",
      },
      {
        cause: "Data loss: consumer commits before processing",
        evidence:
          "enable.auto.commit with slow processing, or a manual commit ahead of the work; a crash then skips the uncommitted-but-unprocessed records.",
      },
      {
        cause: "Duplicates: retries without idempotence",
        evidence:
          "enable.idempotence=false with retries > 0; a lost ack on the return path makes the producer re-send an already-written batch.",
      },
      {
        cause: "Duplicates: at-least-once reprocessing",
        evidence:
          "The consumer processed records but crashed or rebalanced before committing; the new owner replays from the last commit. Expected unless the sink is idempotent.",
      },
      {
        cause: "Out-of-order: in-flight retries without idempotence",
        evidence:
          "max.in.flight.requests.per.connection > 1 with idempotence off; a retried batch lands after a later one.",
      },
      {
        cause: "Out-of-order: repartitioning or consumer concurrency",
        evidence:
          "The key changed or partition count grew, splitting one entity across partitions; or a thread pool processes one partition's records in parallel.",
      },
    ],
    resolutionFlow: [
      "Classify the symptom precisely — loss, duplication, or ordering — and treat each independently.",
      "Data loss: audit acks, min.insync.replicas, replication factor, and unclean.leader.election.enable; check broker logs for unclean elections at the incident time; check consumer commit ordering.",
      "Duplicates: check enable.idempotence, then consumer commit-versus-process ordering; confirm the sink is idempotent for at-least-once.",
      "Ordering: check max.in.flight.requests.per.connection and enable.idempotence; confirm the partitioning key is stable and per-partition processing is single-threaded.",
      "For exactly-once end to end, use the transactional producer with read_committed consumers, or make the sink writes idempotent.",
    ],
    keyConfigs: [
      "acks",
      "enable.idempotence",
      "min.insync.replicas",
      "unclean.leader.election.enable",
      "max.in.flight.requests.per.connection",
      "isolation.level",
      "enable.auto.commit",
    ],
    watchOut:
      "enable.idempotence=true is the modern default and preserves order across retries with up to 5 in-flight requests. Explicitly setting acks=1, retries=0, or max.in.flight above 5 silently disables it (or is rejected) — check for overrides before trusting the guarantee.",
  },
  {
    slug: "connectivity-and-auth",
    symptom: "Connectivity and authentication failures",
    overview:
      "The key split is bootstrap versus after bootstrap. A client that connects and then fails every subsequent request is almost always advertised.listeners — it received a broker address it can't reach.",
    causes: [
      {
        cause: "Incorrect advertised.listeners",
        evidence:
          "Bootstrap succeeds, then every produce and fetch times out — the broker handed back an address the client can't resolve or route to. Often region- or network-specific.",
      },
      {
        cause: "DNS or routing",
        evidence:
          "The client host can't resolve or route to a broker's advertised hostname; it works from some networks and not others.",
      },
      {
        cause: "TLS hostname mismatch",
        evidence:
          "The handshake fails with a hostname-verification error; the certificate's SAN list doesn't cover the advertised hostname.",
      },
      {
        cause: "TLS certificate expired",
        evidence:
          "Handshakes that worked yesterday fail at a precise timestamp; existing connections keep working until they drop.",
      },
      {
        cause: "SASL mechanism mismatch",
        evidence:
          "Authentication fails immediately; the client's sasl.mechanism isn't in the listener's sasl.enabled.mechanisms (SCRAM-SHA-256 vs. 512 vs. PLAIN).",
      },
      {
        cause: "ACL denial",
        evidence:
          "Authentication succeeds but the broker returns TOPIC_AUTHORIZATION_FAILED or GROUP_AUTHORIZATION_FAILED for a specific principal and resource.",
      },
      {
        cause: "Clock skew",
        evidence:
          "Kerberos / GSSAPI authentication fails when the client and KDC clocks differ beyond the allowed skew.",
      },
      {
        cause: "Cloud security groups or firewall",
        evidence:
          "Some broker ports reachable and others not — partial connectivity that reads as an intermittent failure.",
      },
    ],
    resolutionFlow: [
      "Determine whether the failure is at bootstrap or after the first metadata response — after points straight at advertised.listeners.",
      "From the client host, resolve and connect to every advertised broker address, not just the bootstrap server.",
      "For TLS: check certificate expiry and that the SAN covers the advertised hostname (openssl s_client).",
      "For SASL: confirm the mechanism matches the listener and the credentials are valid.",
      "For authorization: check ACLs for the exact principal, operation, and resource named in the error.",
      "On Kerberos setups, check clock skew between client, broker, and KDC.",
    ],
    keyConfigs: [
      "advertised.listeners",
      "listeners",
      "listener.security.protocol.map",
      "sasl.mechanism",
      "sasl.jaas.config",
      "ssl.endpoint.identification.algorithm",
    ],
    watchOut:
      "Disabling TLS hostname verification (ssl.endpoint.identification.algorithm=\"\") makes a hostname-mismatch error vanish and opens the client to man-in-the-middle attacks. Fix the certificate SAN or the advertised hostname instead.",
  },
];

export function getTroubleshootingEntry(slug: string): TroubleshootingEntry | undefined {
  return troubleshooting.find((t) => t.slug === slug);
}
