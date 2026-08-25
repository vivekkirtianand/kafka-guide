import { TroubleshootingEntry } from "@/lib/types";

export const troubleshooting: TroubleshootingEntry[] = [
  {
    slug: "consumer-lag",
    symptom: "Consumer lag",
    causes: [
      "Slow processing",
      "Too few partitions or consumers",
      "Rebalance loops",
      "Large backlogs",
      "Fetch settings",
      "Downstream dependency latency",
      "Hot partitions",
    ],
    resolutionFlow: [
      "Determine whether lag is stable or growing",
      "Compare per-partition lag",
      "Check processing time and poll frequency",
      "Inspect rebalances and consumer errors",
      "Check broker fetch latency",
      "Scale only after locating the actual bottleneck",
    ],
  },
  {
    slug: "frequent-rebalances",
    symptom: "Frequent consumer rebalances",
    causes: [
      "Processing longer than the poll interval",
      "Heartbeat or session timeouts",
      "Unstable instances",
      "Rolling deployments",
      "Membership and assignment strategy",
      "Network pauses or long garbage collection",
    ],
    resolutionFlow: [
      "Correlate rebalance timestamps with deploys and GC logs",
      "Compare max.poll.interval.ms against real processing time",
      "Check session.timeout.ms and heartbeat.interval.ms",
      "Consider static membership for rolling deployments",
      "Move to cooperative assignment if using eager rebalancing",
    ],
  },
  {
    slug: "not-enough-replicas",
    symptom: "NOT_ENOUGH_REPLICAS",
    causes: ["ISR size", "min.insync.replicas", "Producer acks", "Offline or slow followers", "Disk and network health"],
    resolutionFlow: [
      "Check current ISR size per affected partition",
      "Compare against min.insync.replicas",
      "Identify which replicas are out of sync and why",
      "Restore follower health rather than lowering durability settings",
      "Only reduce min.insync.replicas as a last resort, understanding the data-loss tradeoff",
    ],
  },
  {
    slug: "under-replicated-partitions",
    symptom: "Under-replicated partitions",
    causes: ["Broker outage", "Replica fetch latency", "Disk pressure", "Network saturation", "Oversized records", "Uneven partition distribution"],
    resolutionFlow: [
      "Identify which brokers host the under-replicated partitions",
      "Check broker health, disk, and network metrics",
      "Check replica fetch latency and throttle settings",
      "Restore the affected broker or rebalance partitions",
      "Confirm ISR returns to full size before considering it resolved",
    ],
  },
  {
    slug: "timeout-errors",
    symptom: "Timeout errors",
    causes: ["Metadata timeout", "Request timeout", "Delivery timeout", "Poll interval expiration", "Transaction timeout", "Network or DNS failure"],
    resolutionFlow: [
      "Identify which specific timeout fired from the exception type",
      "Check whether it's isolated to one partition/broker or cluster-wide",
      "Check network and DNS health between client and broker",
      "Compare configured timeout values against observed latency",
      "Address the underlying latency rather than only raising the timeout",
    ],
  },
  {
    slug: "disk-usage-growth",
    symptom: "Disk usage growth",
    causes: ["Retention settings", "Unexpected ingestion", "Partition imbalance", "Compaction lag", "Tombstone behavior", "Failed cleanup", "Incorrect timestamps"],
    resolutionFlow: [
      "Check retention and segment settings against actual growth",
      "Compare ingestion rate to expected baseline",
      "Check log-cleaner metrics on compacted topics",
      "Verify record timestamps aren't preventing segment expiry",
      "Rebalance partitions if disk usage is uneven across brokers",
    ],
  },
  {
    slug: "large-message-failures",
    symptom: "Large-message failures",
    causes: ["Producer max.request.size", "Broker message-size limits", "Topic-level overrides", "Replica fetch limits", "Consumer fetch limits"],
    resolutionFlow: [
      "Trace the specific limit that rejected the record",
      "Check producer, broker, topic, and consumer limits together",
      "Decide whether raising limits or chunking/using object storage is safer",
      "Apply the change consistently across producer, topic, and consumer",
    ],
  },
  {
    slug: "hot-partitions",
    symptom: "Hot partitions",
    causes: ["Poor record-key distribution", "A dominant customer or key", "Partition count", "Consumer assignment", "Broker placement"],
    resolutionFlow: [
      "Compare per-partition throughput to find the skew",
      "Check key cardinality and distribution",
      "Evaluate whether partition count matches key cardinality",
      "Consider a better partitioning key or a salting strategy",
    ],
  },
  {
    slug: "data-integrity-issues",
    symptom: "Data loss, duplicates, and out-of-order records",
    causes: [
      "Data loss: low replication, acks, or unclean leader election",
      "Duplicates: retries without idempotence, at-least-once reprocessing",
      "Out-of-order: multiple in-flight requests without idempotence, repartitioning",
    ],
    resolutionFlow: [
      "Treat each symptom as a separate diagnostic path — do not conflate causes",
      "For data loss: check acks, min.insync.replicas, and unclean leader election history",
      "For duplicates: check idempotence and consumer commit behavior",
      "For ordering: check in-flight request limits and partitioning consistency",
    ],
  },
  {
    slug: "connectivity-and-auth",
    symptom: "Connectivity and authentication failures",
    causes: [
      "Incorrect advertised.listeners",
      "DNS and routing",
      "TLS hostname or certificate failures",
      "SASL mechanism mismatch",
      "ACL denial",
      "Clock skew",
      "Cloud security rules",
    ],
    resolutionFlow: [
      "Determine whether the failure is at bootstrap or after (points to listener config)",
      "Check DNS resolution and routing from the client network",
      "Check certificate validity and hostname match",
      "Check SASL mechanism and ACLs for the specific principal",
      "Check clock skew for Kerberos/SASL failures",
    ],
  },
];

export function getTroubleshootingEntry(slug: string): TroubleshootingEntry | undefined {
  return troubleshooting.find((t) => t.slug === slug);
}
