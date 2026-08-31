import { Incident } from "@/lib/types";

const SCORING = [
  "Correct diagnosis",
  "Evidence collected",
  "Safety of proposed change",
  "Time to mitigation",
  "Long-term corrective action",
  "Durability preserved",
];

export const incidents: Incident[] = [
  {
    slug: "slow-broker",
    title: "One slow broker",
    briefing:
      "Produce latency has climbed cluster-wide over the last twenty minutes. Only one broker shows elevated request-queue time.",
    symptoms: ["Rising p99 produce latency", "Uneven request latency across brokers", "No error rate increase yet"],
    clues: ["Disk I/O metrics", "Request queue and purgatory size", "Under-replicated partition count"],
    scoring: SCORING,
    investigation: {
      clues: [
        { label: "disk I/O metrics", evidence: "broker-2 write latency is 8x the cluster median and climbing." },
        {
          label: "request queue / purgatory size",
          evidence: "broker-2's request queue is saturated; other brokers are near zero.",
        },
        {
          label: "under-replicated partition count",
          evidence:
            "Partitions led by broker-2 are falling out of sync as followers can't keep up with fetch requests.",
        },
      ],
      options: [
        {
          label: "A slow disk on broker-2 is backing up writes and replication",
          correct: true,
          feedback:
            "Disk latency on broker-2 is the root cause: it backs up the request queue, which delays replica fetches, which then produces under-replicated partitions. The fix is to address broker-2's disk (or move its partition leadership off) rather than change producer or replication settings.",
        },
        {
          label: "min.insync.replicas is set too high across the cluster",
          correct: false,
          feedback:
            "min.insync.replicas would only matter if writes were being rejected with NOT_ENOUGH_REPLICAS. Here writes are succeeding but slowly — the evidence points to hardware, not a durability setting.",
        },
        {
          label: "The producer's batch.size is too small",
          correct: false,
          feedback:
            "Producer batching wouldn't explain an isolated broker showing elevated disk latency and request-queue saturation while the rest of the cluster is normal.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "full-broker-disk",
    title: "Full broker disk",
    briefing: "A broker has stopped accepting writes for several partitions it leads.",
    symptoms: [
      "Produce errors on affected partitions",
      "Broker logs show disk write failures",
      "Partition leadership migrating away",
    ],
    clues: ["Disk usage per broker", "Retention and segment settings", "Recent ingestion rate changes"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "disk usage per broker",
          evidence:
            "broker-3's log directory is at 100%; the others sit near 60%. broker-3's log shows repeated write failures and the log directory is now marked offline.",
        },
        {
          label: "retention and segment settings",
          evidence:
            "The topic events.raw has retention.ms of 7 days and no retention.bytes. Its oldest segments are only 6 days old — time-based retention hasn't deleted anything yet.",
        },
        {
          label: "recent ingestion rate changes",
          evidence:
            "BytesInPerSec on events.raw tripled four days ago and has stayed there. With no size cap, the topic simply grew until the disk filled.",
        },
      ],
      options: [
        {
          label: "A traffic increase filled broker-3's disk and its log directory went offline",
          correct: true,
          feedback:
            "Ingestion tripled with only time-based retention and no retention.bytes cap, so events.raw grew until broker-3's disk was full. Kafka took that log directory offline, which dropped broker-3's replicas of those partitions — hence leadership migrating away and produce errors on the partitions it led. Mitigate by freeing space (lower retention.ms on the largest topics in steps, or add capacity) and bringing the log directory back online; then set retention.bytes and alert on free space with real headroom.",
        },
        {
          label: "min.insync.replicas is too high, so acks=all writes are being rejected",
          correct: false,
          feedback:
            "That would surface as NOT_ENOUGH_REPLICAS across many partitions cluster-wide, not disk write failures confined to one broker. The broker log points squarely at a full, offline log directory.",
        },
        {
          label: "The producer is sending records larger than message.max.bytes",
          correct: false,
          feedback:
            "Oversized records are rejected synchronously with RecordTooLargeException; they don't fill a disk or take a log directory offline. The evidence here is capacity, not record size.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "bad-advertised-listener",
    title: "Incorrect advertised listener",
    briefing: "New client deployments in one region can bootstrap but every subsequent request times out.",
    symptoms: ["Bootstrap succeeds, then timeouts", "Only affects one network/region", "Existing long-lived clients unaffected"],
    clues: ["advertised.listeners config", "DNS resolution from the client network", "Listener security protocol map"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "advertised.listeners config",
          evidence:
            "On the client-facing listener the brokers advertise kafka-N.internal:9092. That name resolves inside the cluster VPC but not from the new region's network.",
        },
        {
          label: "DNS resolution from the client network",
          evidence:
            "From a host in the new region, the bootstrap address kafka-bootstrap.example.com resolves (it's a load balancer), but kafka-1.internal returns NXDOMAIN.",
        },
        {
          label: "listener security protocol map",
          evidence:
            "listener.security.protocol.map is unchanged and consistent (PLAINTEXT:PLAINTEXT, SSL:SSL). Both listeners are configured the way they always have been.",
        },
      ],
      options: [
        {
          label: "advertised.listeners hands back per-broker hostnames the new region can't resolve",
          correct: true,
          feedback:
            "Bootstrap works because that one address is a resolvable load balancer. The metadata response then returns kafka-N.internal addresses, and every produce and fetch to those times out because DNS in the new region can't resolve them. Existing clients were already connected before the region was added. Fix: advertise addresses reachable from every client network — a dedicated listener with externally-resolvable names, or split-horizon DNS. Raising request.timeout.ms changes nothing.",
        },
        {
          label: "A firewall rule is blocking port 9092 from the new region",
          correct: false,
          feedback:
            "A blocked port fails the connection attempt immediately, and DNS would still resolve — you'd see a connection refused or a routing timeout, not NXDOMAIN. The evidence is name resolution, not reachability.",
        },
        {
          label: "The brokers' TLS certificates don't cover the new region's hostnames",
          correct: false,
          feedback:
            "The client-facing listener here is PLAINTEXT — there's no TLS handshake to fail. And a certificate problem would fail at connect time, not after a successful bootstrap and metadata fetch.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "poison-message",
    title: "Consumer stuck on a poison message",
    briefing: "Lag on one partition is growing linearly while all others are flat.",
    symptoms: ["Single-partition lag growth", "Repeated processing exceptions in consumer logs", "No rebalances"],
    clues: ["Consumer error logs", "Offset commit history", "Dead-letter topic configuration"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "consumer error logs",
          evidence:
            "The consumer logs a DeserializationException on orders-7 at offset 44,210 every few seconds — the same offset each time. The app uses an error handler that seeks back to the failed record on failure.",
        },
        {
          label: "offset commit history",
          evidence:
            "The committed offset for orders-7 has been frozen at 44,210 for two hours. Every other partition's committed offset is advancing normally.",
        },
        {
          label: "dead-letter topic configuration",
          evidence:
            "There is no dead-letter topic and no retry limit on the error handler — it seeks back to the failed offset indefinitely.",
        },
      ],
      options: [
        {
          label: "One record on orders-7 can't be deserialized and the unbounded seek-back handler retries it forever",
          correct: true,
          feedback:
            "The handler seeks back to 44,210 on every failure with no retry cap and no dead-letter route, so that partition never advances while the rest of the group is healthy. Fast mitigation: skip the record by resetting that partition to offset 44,211. Proper fix: a bounded retry that routes the record to a dead-letter topic and commits past it. Then fix the producer or schema that emitted the bad record.",
        },
        {
          label: "orders-7 is a hot partition and its consumer can't keep up",
          correct: false,
          feedback:
            "A hot partition's consumer still makes progress — its committed offset advances even as lag grows. Here the offset is frozen at a single value and the same deserialization error repeats. That's stuck, not slow.",
        },
        {
          label: "A rebalance loop is stopping the group from consuming orders-7",
          correct: false,
          feedback:
            "There are no rebalances — every other partition is consuming normally. A rebalance loop would stall the whole group, not one partition.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "rebalance-storm",
    title: "Rebalance storm during deployment",
    briefing: "Consumer lag spikes every time the consuming service deploys, then slowly recovers.",
    symptoms: ["Lag spikes correlated with deploys", "Repeated JoinGroup requests", "Brief total processing stalls"],
    clues: ["Deployment timeline", "session.timeout.ms and max.poll.interval.ms", "Partition assignment strategy"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "deployment timeline",
          evidence:
            "The service runs 12 pods and deploys them one at a time, ~20s apart. Each lag spike begins exactly at deploy start and clears a few minutes after the last pod is replaced.",
        },
        {
          label: "session.timeout.ms and max.poll.interval.ms",
          evidence:
            "session.timeout.ms is 45,000 and max.poll.interval.ms is 300,000. group.instance.id is unset (no static membership). Measured processing time per batch is comfortably inside the poll interval.",
        },
        {
          label: "partition assignment strategy",
          evidence:
            "partition.assignment.strategy is RangeAssignor — the classic eager assignor. Every rebalance revokes all partitions across the whole group before reassigning.",
        },
      ],
      options: [
        {
          label: "Each pod restart triggers an eager stop-the-world rebalance, and 12 per deploy compounds",
          correct: true,
          feedback:
            "With no static membership, every pod leaving and rejoining is two rebalances, and RangeAssignor makes each one revoke every partition across all 12 consumers. That's the storm. Fix: set group.instance.id so a pod restarting within session.timeout.ms doesn't trigger a rebalance, and/or move to CooperativeStickyAssignor (or the KIP-848 consumer protocol) so unaffected partitions keep flowing during the ones that remain.",
        },
        {
          label: "Processing is overrunning max.poll.interval.ms during the deploy",
          correct: false,
          feedback:
            "Processing time is well within the interval, and an overrun would cause rebalances continuously, not only during deploys. The trigger is clearly pods cycling.",
        },
        {
          label: "session.timeout.ms is too low and heartbeats are missed under deploy load",
          correct: false,
          feedback:
            "45s is generous, and missed heartbeats would produce rebalances outside deploy windows too. The pattern is exactly one churn event per pod bounce — a membership problem, not a heartbeat one.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "hot-partition",
    title: "Hot partition",
    briefing: "Overall consumer group lag is fine, but one partition is consistently behind the rest.",
    symptoms: [
      "One partition's lag far exceeds others",
      "Uneven broker load",
      "Skewed key distribution in produced records",
    ],
    clues: ["Per-partition throughput", "Record key cardinality", "Partition count relative to consumer count"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "per-partition throughput",
          evidence: "payments-3 takes roughly 6x the records/sec of any other partition. The other 11 partitions are evenly balanced.",
        },
        {
          label: "record key cardinality",
          evidence:
            "Records are keyed by merchant_id. One merchant is 55% of all traffic, and that merchant_id hashes to partition 3.",
        },
        {
          label: "partition count relative to consumer count",
          evidence:
            "12 partitions, 12 consumers — one each. The consumer on payments-3 is pinned at 100% CPU; the rest are near idle.",
        },
      ],
      options: [
        {
          label: "A single dominant key routes most of the traffic to payments-3",
          correct: true,
          feedback:
            "All of that merchant's records hash to partition 3, so one consumer carries 55% of the load while 11 sit idle. Adding consumers can't help — a partition isn't split within a group. Options: a higher-cardinality key such as merchant_id plus payment_id (accepting that strict per-merchant ordering is lost), salting the hot key across a few partitions, or giving that merchant its own topic. Just adding partitions moves the hot spot without removing it.",
        },
        {
          label: "There are too few partitions for the consumer count",
          correct: false,
          feedback:
            "Partitions and consumers are 12 and 12 — exactly matched. The problem is that load isn't evenly distributed across the 12 partitions, not the count.",
        },
        {
          label: "The consumer on payments-3 has a slow downstream dependency",
          correct: false,
          feedback:
            "Then it would be latency-bound, not pinned at 100% CPU, and the partition wouldn't be receiving 6x the input rate. The skew is on the produce side.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "replica-out-of-isr",
    title: "Replica falling out of ISR",
    briefing: "Under-replicated partition count is climbing on one broker.",
    symptoms: ["Rising under-replicated partitions", "Replica fetch lag on one broker", "No client-visible errors yet"],
    clues: ["Replica fetch latency", "Disk and network health on the lagging broker", "GC pause logs"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "replica fetch latency",
          evidence:
            "The under-replicated partitions are all led by broker-4, and the replica that's out of sync is on broker-2 every time. broker-2's fetch requests arrive in bursts with multi-second gaps between them.",
        },
        {
          label: "disk and network health on the lagging broker",
          evidence: "broker-2's disk await time and NIC utilization are both normal. No saturation anywhere.",
        },
        {
          label: "GC pause logs",
          evidence:
            "broker-2's GC log shows stop-the-world pauses of 4–7 seconds every 1–2 minutes. It was recently given a 24 GB heap to 'help with load'.",
        },
      ],
      options: [
        {
          label: "GC pauses on broker-2 keep its replicas from staying caught up, so they age out of the ISR",
          correct: true,
          feedback:
            "The oversized heap lengthened GC pauses. During each multi-second pause broker-2 issues no fetch requests, and under sustained load it can't fully catch up between pauses — so it stays behind the leader longer than replica.lag.time.max.ms and drops out. Fix: shrink the heap (brokers want a modest heap, commonly ~6 GB, with the rest left to the OS page cache) and tune GC. Disk and network are already ruled out.",
        },
        {
          label: "broker-2 has a slow disk backing up its log appends",
          correct: false,
          feedback:
            "Disk await on broker-2 is normal — explicitly ruled out. And the stalls are periodic multi-second freezes, which is a GC signature, not steady disk latency.",
        },
        {
          label: "The inter-broker link between broker-2 and broker-4 is saturated",
          correct: false,
          feedback:
            "NIC utilization on broker-2 is normal, and the fetch gaps recur every 1–2 minutes rather than continuously. Periodic freezes point at GC, not link saturation.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "compaction-not-reclaiming",
    title: "Compaction not reclaiming space",
    briefing: "A compacted topic's disk usage keeps growing despite a stable key set.",
    symptoms: [
      "Steady disk growth on compacted topics",
      "Log-cleaner metrics show rising backlog",
      "No corresponding traffic increase",
    ],
    clues: ["Log-cleaner thread metrics", "Tombstone retention settings", "Dirty ratio thresholds"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "log-cleaner thread metrics",
          evidence:
            "The log-cleaner thread last logged activity 9 days ago, ending with an OutOfMemoryError. log.cleaner.threads is 1. max-dirty-percent is now above 90% on several partitions.",
        },
        {
          label: "tombstone retention settings",
          evidence: "delete.retention.ms is the default 24h. Tombstone accumulation isn't what's driving this growth.",
        },
        {
          label: "dirty ratio thresholds",
          evidence:
            "min.cleanable.dirty.ratio is 0.5, and every partition of the topic is well past that. Compaction is eligible to run — there's just nothing running it.",
        },
      ],
      options: [
        {
          label: "The single log-cleaner thread died 9 days ago and took all compaction with it",
          correct: true,
          feedback:
            "The cleaner thread hit an OutOfMemoryError and, being the only one (log.cleaner.threads=1), stopped compaction cluster-wide — silently. Every compacted topic, including __consumer_offsets, has grown since. Fix: restart the broker to bring the cleaner back, then address why it OOMed (dedupe buffer sizing, or a partition with very high key cardinality) and run more than one cleaner thread so a single failure degrades throughput instead of halting compaction. Alert on live cleaner threads and max-dirty-percent.",
        },
        {
          label: "delete.retention.ms is too high, so tombstones are never removed",
          correct: false,
          feedback:
            "delete.retention.ms is the default 24h, and tombstone buildup wouldn't explain growth across a stable key set of this size. The cleaner isn't running at all.",
        },
        {
          label: "min.cleanable.dirty.ratio is set too high, so compaction rarely triggers",
          correct: false,
          feedback:
            "The dirty ratio is already well past the 0.5 threshold on every partition — compaction is eligible. The problem is that no live cleaner thread exists to perform it.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "producer-timeouts-unavailable-partition",
    title: "Producer timeouts from an unavailable partition",
    briefing: "One service reports intermittent send timeouts while the rest of the cluster looks healthy.",
    symptoms: ["Delivery timeout exceptions on one topic", "Partition leadership recently changed", "Metadata refresh errors in producer logs"],
    clues: ["Partition leader history", "Controller logs", "Producer metadata refresh interval"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "partition leader history",
          evidence:
            "notifications-2 has had no leader for 15 minutes. Its two replicas are on broker-5 and broker-6, both taken down together for rack maintenance. The topic's replication factor is 2.",
        },
        {
          label: "controller logs",
          evidence:
            "The controller logged notifications-2 going offline when its last replica (broker-6) stopped. unclean.leader.election.enable is false, so it's holding the partition offline until an in-sync replica returns.",
        },
        {
          label: "producer metadata refresh interval",
          evidence:
            "The producer uses null keys, so records spread across all partitions. Sends that land on partition 2 block until delivery.timeout.ms and then throw; sends to every other partition succeed.",
        },
      ],
      options: [
        {
          label: "notifications-2 has no leader because both its replicas were taken down together",
          correct: true,
          feedback:
            "Replication factor 2 with both replicas on brokers in the same maintenance window left the partition with no in-sync replica and no leader. Unclean leader election is (correctly) off, so it stays offline until broker-5 or broker-6 returns. The producer's null-key records that hash to partition 2 have nowhere to go and expire after delivery.timeout.ms. Mitigate by bringing one of those brokers back. Long-term: spread replicas across failure domains with rack awareness, and consider RF 3 so a single maintenance event can't take a partition fully offline.",
        },
        {
          label: "The producer's metadata is stale and it's sending to a former leader",
          correct: false,
          feedback:
            "Stale metadata causes brief NOT_LEADER_OR_FOLLOWER errors that succeed on retry after a metadata refresh. This partition has genuinely had no leader for 15 minutes — refreshing metadata wouldn't find one.",
        },
        {
          label: "delivery.timeout.ms is set too low for this service",
          correct: false,
          feedback:
            "Raising it only makes the doomed sends take longer to fail. Records for partition 2 have no leader to go to — the fix is restoring partition availability, not extending the timeout.",
        },
      ],
    },
    status: "available",
  },
  {
    slug: "tls-certificate-expiration",
    title: "TLS certificate expiration",
    briefing: "Clients across one listener suddenly can't establish new connections.",
    symptoms: ["New connections fail with TLS handshake errors", "Existing connections remain healthy", "Failure began at a specific timestamp"],
    clues: ["Certificate expiry dates", "Listener security protocol config", "Broker startup and handshake logs"],
    scoring: SCORING,
    investigation: {
      clues: [
        {
          label: "certificate expiry dates",
          evidence: "The broker keystore certificate on the SSL listener expired today at 00:00 UTC. The failures started at exactly 00:00 UTC.",
        },
        {
          label: "listener security protocol config",
          evidence:
            "The listener map has EXTERNAL:SSL and BROKER:PLAINTEXT, unchanged. Inter-broker replication runs on the PLAINTEXT listener and is completely unaffected.",
        },
        {
          label: "broker startup and handshake logs",
          evidence:
            "The brokers were not restarted. Their logs show a flood of SSLHandshakeException with certificate_expired from new client connections. Connections established before 00:00 UTC are still working.",
        },
      ],
      options: [
        {
          label: "The broker's TLS certificate on the SSL listener expired at 00:00 UTC",
          correct: true,
          feedback:
            "New handshakes fail with certificate_expired; existing connections survive because the certificate is only validated at handshake time. Inter-broker traffic is on a separate PLAINTEXT listener, so the cluster looks healthy from the inside. Fix: deploy a renewed certificate to the brokers' keystores and reload it — a rolling restart, or a dynamic keystore update where supported. Long-term: monitor certificate expiry with weeks of lead time and automate rotation.",
        },
        {
          label: "A client deployment shipped a broken truststore",
          correct: false,
          feedback:
            "That would affect only the clients that deployed, not everything on the listener at once, and the broker log would show clients failing to trust the broker — not certificate_expired. The precise 00:00 UTC cutover matches an expiry, not a rollout.",
        },
        {
          label: "The brokers restarted and came up with the wrong listener configuration",
          correct: false,
          feedback:
            "The logs show the brokers were not restarted and the listener config is unchanged. Only new TLS handshakes fail — a listener misconfiguration would break the listener entirely, including established connections.",
        },
      ],
    },
    status: "available",
  },
];

export function getIncident(slug: string): Incident | undefined {
  return incidents.find((i) => i.slug === slug);
}
