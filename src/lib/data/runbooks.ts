import { Runbook } from "@/lib/types";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type RunbookSeed = Omit<Runbook, "slug">;

const seeds: RunbookSeed[] = [
  {
    title: "Topic creation and configuration review",
    category: "Change management",
    summary:
      "Vet a new topic's partition count, replication, durability floor, retention, and cleanup policy before it exists — several of these are painful or lossy to change later.",
    when: "A team requests a new topic, or you are auditing topics that were auto-created or created with defaults.",
    steps: {
      prechecks: [
        "Confirm the topic does not already exist and that auto.create.topics.enable is false in production.",
        "Estimate peak throughput and the consumer parallelism you need — that sets the partition count. You can add partitions later, but not without breaking keyed ordering.",
        "Choose the replication factor (3 for anything durable) and confirm the cluster has enough brokers across enough racks to place it.",
        "Choose cleanup.policy (delete, compact, or both) deliberately — switching later can drop data or take a long compaction pass.",
        "Size retention against the disk budget. retention.bytes is enforced per partition, so a topic's on-disk footprint is roughly retention.bytes × partitions × replication factor — compute it that way and set it so no single topic can fill a disk.",
        "Set min.insync.replicas to 2 for an RF-3 durable topic and confirm producers will use acks=all.",
      ],
      execution: [
        "Create with an explicit config, not cluster defaults: kafka-topics.sh --create --partitions N --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=… --config retention.bytes=… --config cleanup.policy=….",
        "For a compacted topic also set delete.retention.ms, min.cleanable.dirty.ratio, and segment.ms on purpose.",
        "Record the topic and the reasoning in your topic registry or infrastructure-as-code so it is reproducible and reviewable.",
      ],
      validation: [
        "kafka-topics.sh --describe: partition count and RF are as intended, ISR is full, and replicas are spread across brokers and racks.",
        "kafka-configs.sh --describe --entity-type topics: the effective configs match what you set.",
        "Produce and consume a test record; confirm a keyed record lands on a deterministic partition.",
      ],
      rollback: [
        "If the topic is unused and newly created, delete it (--delete) after confirming no producer or consumer is connected.",
        "If only a dynamic config is wrong, fix it in place with kafka-configs.sh --alter — no recreate needed.",
        "Partition count and replication factor cannot be lowered; correcting them means a reassignment (RF) or a new topic and migration (partitions).",
      ],
      escalation: [
        "The cluster lacks the brokers or racks to place the requested replication factor.",
        "The request implies a partition count large enough to matter cluster-wide (controller metadata size, open file handles, per-broker partition limits).",
      ],
    },
  },
  {
    title: "Increasing partitions",
    category: "Capacity",
    summary:
      "Add partitions to raise consumer parallelism, accepting that the key-to-partition mapping changes and per-key ordering is not preserved across the change.",
    when: "Every partition already has a consumer and each consumer is at its ceiling, so you cannot gain throughput by adding consumers.",
    steps: {
      prechecks: [
        "Confirm partition count is really the bottleneck — see the consumer-lag and hot-partitions troubleshooting entries first.",
        "Understand the ordering impact: existing keys hash to different partitions afterward, so a consumer may see one key on two partitions after the change — briefly on a time- or size-retention topic, indefinitely on a compact-only topic until a tombstone is written to the old partition.",
        "Check anything that assumes a fixed partition count: custom partitioners, external offset tracking, partition-pinned state, Kafka Streams topologies.",
        "Confirm you cannot instead add consumers (only possible while consumers < partitions) — that is cheaper and lossless.",
        "Pick a low-traffic window.",
      ],
      execution: [
        "kafka-topics.sh --alter --topic … --partitions N, where N is greater than the current count. Partitions can only be added, never removed.",
        "New partitions start empty; producers route to them after their next metadata refresh.",
        "Compaction won't clean this up: it operates independently within each partition, so on a compact-only topic the key's old value stays on its original partition forever unless a newer record or a tombstone is written to that same partition. With cleanup.policy=delete (or delete,compact) the stale copy ages out with retention instead.",
      ],
      validation: [
        "--describe shows the new partitions with a leader and full ISR.",
        "Consumers rebalanced and picked up the new partitions.",
        "Per-partition produce rate re-levels over the following minutes.",
      ],
      rollback: [
        "There is no rollback — partitions cannot be removed. If the increase was wrong, create a new topic with the intended count and migrate producers and consumers to it.",
      ],
      escalation: [
        "The topic feeds a stateful stream processor — repartitioning needs an application-level plan (state store reset / reprocessing).",
        "Downstream consumers rely on total per-key ordering that this change would break.",
      ],
    },
  },
  {
    title: "Adding or removing brokers",
    category: "Capacity",
    summary:
      "Grow or shrink the broker set. The real work is moving partition replicas on or off the broker — the process start or stop is the easy part.",
    when: "Scaling for capacity, replacing hardware, or migrating to new instance types.",
    steps: {
      prechecks: [
        "Adding: provision the broker with a unique node.id, the correct cluster ID, the right controller quorum configuration, listeners, and rack.",
        "Removing: confirm the remaining brokers have the disk and the count to hold the extra replicas (replication factor cannot exceed the live broker count).",
        "Have a partition reassignment plan ready (see the Partition reassignment runbook).",
        "Confirm no reassignment is already running and no replication throttle is left set.",
      ],
      execution: [
        "Add: start the broker, confirm it joins and catches up on cluster metadata, then generate and apply a reassignment (kafka-reassign-partitions.sh --generate, then --execute with a --throttle) that moves some replicas onto it.",
        "Remove: reassign every replica off the target broker onto the others and wait for completion.",
        "Remove: confirm the broker now leads and follows zero partitions (LeaderCount and PartitionCount at 0), then shut it down and, if it was a controller, remove it from the quorum.",
      ],
      validation: [
        "UnderReplicatedPartitions returns to 0 and every ISR is full.",
        "Partition and leader counts are balanced across the new broker set (run a preferred-leader election if leadership is skewed).",
        "No leftover *.replication.throttled.rate configs on brokers or topics.",
      ],
      rollback: [
        "Add: if the new broker misbehaves, reassign its replicas back off and remove it.",
        "Remove: if you stopped a broker that still held in-sync replicas, restart it — those partitions were under-replicated, not lost, provided another replica stayed in-sync.",
      ],
      escalation: [
        "Removing the broker would drop any topic below its replication factor, or below min.insync.replicas for an acks=all topic.",
        "A reassignment stalls because a target replica never enters the ISR.",
      ],
    },
  },
  {
    title: "Partition reassignment",
    category: "Capacity",
    summary:
      "Move partition replicas between brokers — to rebalance, decommission, or fix placement — with a bandwidth throttle so catch-up traffic does not starve live clients.",
    when: "After adding or before removing a broker, to fix an imbalance, or to correct rack placement.",
    steps: {
      prechecks: [
        "Save the current assignment (from --describe or the --generate output) as your rollback plan.",
        "Confirm the target brokers have disk headroom for the incoming replicas.",
        "Choose a throttle: fast enough to finish in a reasonable window, slow enough to leave headroom for client traffic and normal replication.",
        "Do not start with existing under-replicated partitions — fix cluster health first.",
      ],
      execution: [
        "Build the reassignment JSON (--generate with a target broker list, or hand-written for specific moves).",
        "kafka-reassign-partitions.sh --execute --reassignment-json-file … --throttle <bytes/sec>.",
        "Track progress with --verify, which also removes the throttle once every partition has completed.",
      ],
      validation: [
        "--verify reports every partition completed successfully.",
        "ISR is full for every moved partition and UnderReplicatedPartitions is back to 0.",
        "Throttle configs are gone from brokers and topics.",
        "Leadership is balanced — run a preferred-leader election if it is not.",
      ],
      rollback: [
        "--execute the saved original assignment; it is the same operation in reverse and takes a similar catch-up time.",
        "A reassignment still in progress can be cancelled with --cancel, which reverts the in-flight moves.",
      ],
      escalation: [
        "A move stalls: a target replica never joins the ISR — usually a slow or full target broker, or a throttle set too low.",
      ],
    },
  },
  {
    title: "Rolling application deployments",
    category: "Deployment",
    summary:
      "Deploy a new version of a consumer or producer service without a rebalance storm or a lasting lag spike.",
    when: "Any routine deploy of a service in a consumer group, especially one with many instances.",
    steps: {
      prechecks: [
        "Confirm consumers set group.instance.id (static membership) so a quick restart does not trigger a rebalance.",
        "Confirm session.timeout.ms is comfortably longer than an instance's restart time.",
        "Confirm the assignor is CooperativeStickyAssignor, or the KIP-848 consumer protocol, so partitions that are not moving keep flowing.",
        "Start from a healthy baseline — current lag low, no ongoing rebalances.",
        "For producers: confirm the new serializer or schema is compatible with what consumers expect.",
      ],
      execution: [
        "Roll one instance, or a small batch, at a time; wait for it to rejoin the group and resume consuming before the next.",
        "Keep each instance's downtime within session.timeout.ms if you are relying on static membership to avoid a rebalance.",
        "Watch rebalance rate and lag between batches; pause the rollout if either climbs.",
      ],
      validation: [
        "All instances are on the new version and the group is stable (rebalance rate back to roughly zero).",
        "Lag has returned to baseline.",
        "No rise in processing errors or dead-letter volume.",
      ],
      rollback: [
        "Roll back the same way, one batch at a time.",
        "If the trigger was a serialization or poison-message problem, also plan to skip or route the offending records to a dead-letter topic.",
      ],
      escalation: [
        "Lag does not recover within the expected window.",
        "The deploy triggers continuous rebalances — points at membership or timeout configuration (see the rebalance-storm incident).",
      ],
    },
  },
  {
    title: "Rolling broker restarts",
    category: "Deployment",
    summary:
      "Restart every broker for a config change or OS patch, one at a time, keeping all partitions online and durable throughout.",
    when: "A static broker config change, a JVM or OS update, or a certificate reload that needs a restart.",
    steps: {
      prechecks: [
        "Cluster healthy: UnderReplicatedPartitions and OfflinePartitionsCount both 0, every ISR full.",
        "min.insync.replicas is below the replication factor for acks=all topics, so one broker down still allows writes.",
        "controlled.shutdown.enable is true (the default) so each broker migrates leadership before stopping.",
        "Plan the order so controller quorum is never lost — restart controllers deliberately, one at a time, watching ActiveControllerCount.",
        "No active reassignment or replication throttle.",
      ],
      execution: [
        "One broker at a time: trigger a controlled shutdown, wait for it to stop leading partitions, apply the change, restart it.",
        "Wait for it to rejoin and return to full ISR on all of its partitions before touching the next broker.",
        "Run a preferred-leader election after each restart, or once at the end, to restore leadership balance.",
      ],
      validation: [
        "After each broker: UnderReplicatedPartitions returns to 0 before proceeding.",
        "After all: no offline partitions, leadership balanced, ActiveControllerCount is exactly 1.",
        "The intended change is in effect (kafka-configs.sh --describe).",
      ],
      rollback: [
        "If a restarted broker will not rejoin, revert its change and restart again — the cluster keeps serving from the other replicas meanwhile.",
      ],
      escalation: [
        "Any partition goes offline.",
        "Controller quorum cannot be re-formed.",
        "A broker repeatedly fails to catch up after restart.",
      ],
    },
  },
  {
    title: "Certificate and credential rotation",
    category: "Security",
    summary:
      "Roll TLS certificates and SASL credentials ahead of expiry without dropping existing connections, by keeping old and new material valid at the same time.",
    when: "Scheduled rotation, a CA change, or a compromised credential. Not for an already-expired certificate — that is the tls-certificate-expiration incident.",
    steps: {
      prechecks: [
        "Inventory expiry dates for broker keystores, client certificates, and the CA. Rotate with weeks of lead time.",
        "Confirm the new certificate chain: correct SANs for every advertised hostname, signed by a CA present in every client's truststore.",
        "For a CA change: add the new CA to all truststores first (brokers and clients trust both old and new) and let it fully propagate.",
        "For SASL/SCRAM: new credentials can be added alongside the old with kafka-configs.sh --alter --add-config.",
      ],
      execution: [
        "Distribute the new CA to every truststore if the CA is changing; wait for full propagation.",
        "Roll brokers one at a time onto the new keystore — via rolling restart, or a dynamic listener.name.<name>.ssl.keystore.location update where supported.",
        "Roll clients onto the new keystores and credentials.",
        "Once everything is on the new material, remove the old CA from truststores and delete the old SCRAM credentials.",
      ],
      validation: [
        "New TLS handshakes succeed; openssl s_client shows the new certificate and its new expiry.",
        "No SSLHandshakeException or SaslAuthenticationException in broker logs.",
        "Existing connections stayed up throughout the rotation.",
      ],
      rollback: [
        "Redeploy the old keystore or credentials — which is why old and new must overlap in validity. Keep the old material until the new one is fully confirmed.",
      ],
      escalation: [
        "A client cannot be rotated before the deadline, forcing a hard cutover.",
        "The certificate has already expired — switch to incident response.",
      ],
    },
  },
  {
    title: "Capacity planning",
    category: "Capacity",
    summary:
      "Size brokers, disk, partitions, and network from measured throughput and retention, with headroom for a zone failure and for growth.",
    when: "Standing up a cluster, onboarding a large workload, or a periodic (quarterly) review against actuals.",
    steps: {
      prechecks: [
        "Gather inputs: peak sustained write rate (BytesInPerSec), read fan-out (number of consumer groups), and per-topic retention targets.",
        "Compute disk: total bytes ≈ write rate × retention × replication factor, summed across topics, plus headroom.",
        "Compute network: inbound ≈ produce × RF; outbound ≈ produce × (RF − 1 + consumer groups).",
        "Decide failure headroom: the cluster must absorb the loss of one availability zone without exceeding your disk and NIC targets.",
      ],
      execution: [
        "Disk: sized so a full-AZ outage still leaves headroom; set retention.bytes as a backstop, remembering it is a per-partition limit (topic footprint ≈ retention.bytes × partitions × RF).",
        "Partitions: max(throughput ÷ per-partition ceiling, required consumer parallelism); keep per-broker partition counts within tested limits.",
        "Memory: a modest heap (commonly ~6 GB), the rest left to the OS page cache, which should hold the hot tail of the log.",
        "CPU: budget for TLS termination and compression, the main consumers.",
      ],
      validation: [
        "Load-test at projected peak times your headroom factor; confirm p99 produce and fetch latency and replication stay healthy.",
        "Re-derive against actuals on a schedule and watch the trend, not just the current number.",
      ],
      rollback: [
        "Not applicable — this is planning. But stage capacity changes so each is individually reversible (add brokers before raising retention, not after).",
      ],
      escalation: [
        "Growth projections require an architectural change: tiered storage, a second cluster, or cross-region replication.",
      ],
    },
  },
  {
    title: "Backup and disaster recovery",
    category: "Resilience",
    summary:
      "Be able to recover the cluster's data and metadata after a catastrophic loss, with a known and tested RPO and RTO.",
    when: "Designing resilience for a new cluster, or reviewing an existing one after a near-miss.",
    steps: {
      prechecks: [
        "Define RPO (acceptable data loss) and RTO (acceptable downtime) — they drive the whole design.",
        "List what must survive: topic data, __consumer_offsets, ACLs, topic configs, and the Schema Registry _schemas topic.",
        "Choose the mechanism: continuous replication to a second cluster (MirrorMaker 2 — near-zero RPO, ongoing cost), object-storage backup of segments (cheaper, higher RPO), or tiered storage.",
      ],
      execution: [
        "Run MirrorMaker 2 (or equivalent) to the DR cluster: data topics, consumer offsets via MirrorCheckpointConnector, and topic configs.",
        "Back up cluster metadata on a schedule: topic list and configs, ACLs, quotas, and the _schemas topic.",
        "Keep the topics, quotas, and ACLs defined in version-controlled infrastructure-as-code.",
      ],
      validation: [
        "Run a recovery drill on a schedule: stand up from backups or DR, produce and consume, and confirm consumer groups resume at the mirrored offsets.",
        "Measure the drill's actual RPO and RTO against the targets.",
      ],
      rollback: [
        "Have a failback plan: once the primary is restored, reverse the mirror direction and reconcile any writes that happened on DR.",
      ],
      escalation: [
        "A drill misses the RPO or RTO target.",
        "Backup coverage of __consumer_offsets or the schema topic has gaps.",
      ],
    },
  },
  {
    title: "Cluster migration",
    category: "Resilience",
    summary:
      "Move workloads to a new cluster — new hardware, new region, KRaft, or a managed service — with a controlled cutover and a fallback.",
    when: "Hardware refresh, region move, a ZooKeeper-to-KRaft migration handled as a new cluster, or adopting a managed service.",
    steps: {
      prechecks: [
        "Stand up the target cluster and replicate topic configs, partition counts, ACLs, and quotas.",
        "Set up MirrorMaker 2 from source to target: data topics plus MirrorCheckpointConnector for consumer offsets.",
        "Decide topic naming: MM2 prefixes with the source alias by default — either use IdentityReplicationPolicy or plan for the rename.",
        "Inventory every producer and consumer and its bootstrap config, and plan the switch order.",
      ],
      execution: [
        "Let MM2 catch up until target lag is near zero and stable.",
        "Cut producers over to the target (a config or deploy change), by topic or all at once in a window.",
        "Cut consumers over using MM2-translated offsets so they resume at the right position rather than replaying or skipping.",
        "Keep MM2 running briefly for stragglers, then stop it.",
      ],
      validation: [
        "No producers or consumers still connected to the source (its connection and request rates fall to zero).",
        "Target consumer lag is healthy; no duplicate or skipped processing beyond the expected at-least-once window at cutover.",
        "Data-integrity spot check: record counts or checksums on the key topics.",
      ],
      rollback: [
        "Before cutover: trivial — do not switch.",
        "After cutover: switch back to the source, which is still running, and reverse-mirror any writes made on the target.",
      ],
      escalation: [
        "Offset translation has gaps — consumers would replay or skip on cutover.",
        "The source cannot be kept running as a fallback for the planned window.",
      ],
    },
  },
  {
    title: "Kafka upgrades",
    category: "Deployment",
    summary:
      "Upgrade the broker version across the cluster by rolling restart, then bump the metadata feature level once every broker is on the new binary.",
    when: "Adopting a new Kafka release for features or security fixes.",
    steps: {
      prechecks: [
        "Read the release notes for the target version: breaking changes, removed configs, changed defaults.",
        "Confirm the upgrade path is supported — you generally cannot skip several majors at once.",
        "Note the current and target metadata.version (feature level). Brokers are upgraded first; the feature level is bumped afterward with kafka-features.sh.",
        "Cluster healthy, backups and DR current, a rolling-restart window booked.",
        "Check client-library compatibility for anything you plan to upgrade alongside.",
      ],
      execution: [
        "Roll brokers one at a time onto the new binary (same process as Rolling broker restarts), keeping config unchanged at first.",
        "Once all brokers are upgraded and stable, run kafka-features.sh --bootstrap-server … upgrade --metadata <new version>.",
        "Then adopt new configs and features deliberately, one at a time.",
      ],
      validation: [
        "Every broker reports the new version; kafka-features.sh describe shows the new metadata version.",
        "No under-replicated or offline partitions; controller quorum healthy.",
        "Client traffic and error rates are unaffected throughout.",
      ],
      rollback: [
        "Before the feature-level bump: roll brokers back to the old binary one at a time.",
        "After the feature-level bump: a metadata.version downgrade is often not supported — treat that bump as the point of no return and only do it once you are confident.",
      ],
      escalation: [
        "A broker will not start on the new binary.",
        "The feature-level bump is blocked by a broker that has not finished upgrading.",
      ],
    },
  },
  {
    title: "Consumer offset recovery",
    category: "Incident response",
    summary:
      "Move a consumer group back to a correct position after it committed a wrong offset, lost its offsets, or needs to replay a range.",
    when: "A bad deploy committed past unprocessed records, an offsets outage, or a deliberate reprocessing request.",
    steps: {
      prechecks: [
        "Decide the target position: earliest, latest, a timestamp, a specific offset, or a relative shift.",
        "Stop the group — kafka-consumer-groups.sh --reset-offsets refuses to run against an active group.",
        "Understand the consequence: moving backward means reprocessing (the sink must tolerate duplicates); moving forward means skipping (those records are never processed).",
        "Record the current committed offsets (--describe) as the rollback point.",
      ],
      execution: [
        "Dry run first: --reset-offsets --group … --topic … --to-<target> --dry-run, and read the proposed offsets.",
        "Apply with --execute.",
        "For a time target use --to-datetime <ISO>, which resolves to the first offset at or after that time per partition.",
        "Restart the consumers.",
      ],
      validation: [
        "--describe shows the new committed offsets, and once consumers restart, lag draining (or holding, for a deliberate forward skip).",
        "Downstream: confirm reprocessing is idempotent, or that the skip was intended and acceptable.",
      ],
      rollback: [
        "Stop the group again, --reset-offsets --to-offset back to the recorded values, restart.",
        "Only the Kafka position is reversible — records already processed downstream during a wrong window cannot be un-processed.",
      ],
      escalation: [
        "__consumer_offsets itself is damaged (from a compaction outage) rather than just holding a wrong value — that is a broker-side recovery, not an offset reset.",
      ],
    },
  },
  {
    title: "Handling a full disk",
    category: "Incident response",
    summary:
      "A broker log directory has filled, or is about to, and gone offline — buy back capacity without losing data or silently skipping consumers past deleted records.",
    when: "A disk-free alert on a broker, or OfflineLogDirectoryCount going non-zero.",
    steps: {
      prechecks: [
        "Identify the broker and log directory and whether it is already offline (OfflineLogDirectoryCount, broker logs).",
        "Check the other brokers' free space — are they about to follow?",
        "Confirm the affected partitions still have an in-sync replica elsewhere: reads and acks=1 writes continue; acks=all fails only if the remaining ISR drops below min.insync.replicas.",
      ],
      execution: [
        "Lower retention.ms or retention.bytes on the largest topics, in steps, via kafka-configs.sh --alter (no restart), and let retention delete closed segments.",
        "Lower it gradually and watch consumer offsets — a lagging consumer pushed past the new log start hits OffsetOutOfRange and auto.offset.reset then skips data.",
        "If a log directory is already offline: free space, then restart the broker (or bring the directory back online) so it re-syncs.",
        "Add disk or another log directory if the topic genuinely needs the space.",
      ],
      validation: [
        "Free space is back above the alert threshold with headroom.",
        "Any offline log directory is back online and UnderReplicatedPartitions returns to 0 as it catches up.",
        "retention.bytes (a per-partition cap — size it as retention.bytes × partitions × RF) is now set on the large topics as a standing backstop.",
      ],
      rollback: [
        "Restore the original retention values once capacity is genuinely fixed — do not leave an emergency short retention in place and forget it.",
      ],
      escalation: [
        "Multiple brokers are near-full at once — a cluster-wide capacity problem, not a single-broker incident.",
        "Lowering retention would violate a compliance or contractual retention requirement.",
      ],
    },
  },
  {
    title: "Handling broker and availability-zone failures",
    category: "Incident response",
    summary:
      "One or more brokers, or a whole availability zone, are down — keep the cluster serving, avoid a reflexive data-loss decision, and bring capacity back safely.",
    when: "A broker or AZ outage: brokers unreachable, UnderReplicatedPartitions climbing, or partitions offline.",
    steps: {
      prechecks: [
        "Scope it: one broker, or a correlated whole-AZ failure? Check per-broker status, UnderReplicatedPartitions, and OfflinePartitionsCount.",
        "Identify offline partitions (no leader) — those are unavailable for reads and writes and are the priority.",
        "For acks=all topics, identify partitions whose ISR is now below min.insync.replicas — those reject writes.",
      ],
      execution: [
        "Do not enable unclean.leader.election.enable reflexively — it trades data loss for availability. Consider it only for an offline partition with no recoverable in-sync replica, as a conscious call.",
        "Let the healthy brokers carry the extra leadership; watch their disk, NIC, and CPU headroom (this is what capacity planning budgets for).",
        "Hold off on partition reassignment while brokers are still flapping — wait for them to recover or be declared dead.",
      ],
      validation: [
        "Bring brokers back one at a time; each catches up and rejoins every ISR before the next.",
        "If a broker is permanently gone, replace it — same node.id if its data volume survived, otherwise a new id plus a reassignment.",
        "OfflinePartitionsCount and UnderReplicatedPartitions both back to 0, ISRs full, leadership rebalanced across brokers and AZs.",
        "If unclean election was used, identify which partitions truncated and reconcile downstream.",
      ],
      rollback: [
        "Not applicable — you cannot roll back an outage. The reversible decision is whether to use unclean leader election; prefer waiting for a replica if the data matters more than the downtime.",
      ],
      escalation: [
        "Any offline partition with no in-sync replica anywhere.",
        "Loss of controller quorum.",
        "A correlated multi-AZ failure.",
      ],
    },
  },
];

export const runbooks: Runbook[] = seeds.map((s) => ({ slug: toSlug(s.title), ...s }));

export function getRunbook(slug: string): Runbook | undefined {
  return runbooks.find((r) => r.slug === slug);
}
