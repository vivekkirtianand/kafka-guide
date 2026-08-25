import { Incident } from "@/lib/types";

export const incidents: Incident[] = [
  {
    slug: "slow-broker",
    title: "One slow broker",
    briefing:
      "Produce latency has climbed cluster-wide over the last twenty minutes. Only one broker shows elevated request-queue time.",
    symptoms: ["Rising p99 produce latency", "Uneven request latency across brokers", "No error rate increase yet"],
    clues: ["Disk I/O metrics", "Request queue and purgatory size", "Under-replicated partition count"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "available",
  },
  {
    slug: "full-broker-disk",
    title: "Full broker disk",
    briefing: "A broker has stopped accepting writes for several partitions it leads.",
    symptoms: ["Produce errors on affected partitions", "Broker logs show disk write failures", "Partition leadership migrating away"],
    clues: ["Disk usage per broker", "Retention and segment settings", "Recent ingestion rate changes"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "bad-advertised-listener",
    title: "Incorrect advertised listener",
    briefing: "New client deployments in one region can bootstrap but every subsequent request times out.",
    symptoms: ["Bootstrap succeeds, then timeouts", "Only affects one network/region", "Existing long-lived clients unaffected"],
    clues: ["advertised.listeners config", "DNS resolution from the client network", "Listener security protocol map"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "poison-message",
    title: "Consumer stuck on a poison message",
    briefing: "Lag on one partition is growing linearly while all others are flat.",
    symptoms: ["Single-partition lag growth", "Repeated processing exceptions in consumer logs", "No rebalances"],
    clues: ["Consumer error logs", "Offset commit history", "Dead-letter topic configuration"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "rebalance-storm",
    title: "Rebalance storm during deployment",
    briefing: "Consumer lag spikes every time the consuming service deploys, then slowly recovers.",
    symptoms: ["Lag spikes correlated with deploys", "Repeated JoinGroup requests", "Brief total processing stalls"],
    clues: ["Deployment timeline", "session.timeout.ms and max.poll.interval.ms", "Partition assignment strategy"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "hot-partition",
    title: "Hot partition",
    briefing: "Overall consumer group lag is fine, but one partition is consistently behind the rest.",
    symptoms: ["One partition's lag far exceeds others", "Uneven broker load", "Skewed key distribution in produced records"],
    clues: ["Per-partition throughput", "Record key cardinality", "Partition count relative to consumer count"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "replica-out-of-isr",
    title: "Replica falling out of ISR",
    briefing: "Under-replicated partition count is climbing on one broker.",
    symptoms: ["Rising under-replicated partitions", "Replica fetch lag on one broker", "No client-visible errors yet"],
    clues: ["Replica fetch latency", "Disk and network health on the lagging broker", "GC pause logs"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "compaction-not-reclaiming",
    title: "Compaction not reclaiming space",
    briefing: "A compacted topic's disk usage keeps growing despite a stable key set.",
    symptoms: ["Steady disk growth on compacted topics", "Log-cleaner metrics show rising backlog", "No corresponding traffic increase"],
    clues: ["Log-cleaner thread metrics", "Tombstone retention settings", "Dirty ratio thresholds"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "producer-timeouts-unavailable-partition",
    title: "Producer timeouts from an unavailable partition",
    briefing: "One service reports intermittent send timeouts while the rest of the cluster looks healthy.",
    symptoms: ["Delivery timeout exceptions on one topic", "Partition leadership recently changed", "Metadata refresh errors in producer logs"],
    clues: ["Partition leader history", "Controller logs", "Producer metadata refresh interval"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
  {
    slug: "tls-certificate-expiration",
    title: "TLS certificate expiration",
    briefing: "Clients across one listener suddenly can't establish new connections.",
    symptoms: ["New connections fail with TLS handshake errors", "Existing connections remain healthy", "Failure began at a specific timestamp"],
    clues: ["Certificate expiry dates", "Listener security protocol config", "Broker startup and handshake logs"],
    scoring: ["Correct diagnosis", "Evidence collected", "Safety of proposed change", "Time to mitigation", "Long-term corrective action", "Durability preserved"],
    status: "planned",
  },
];

export function getIncident(slug: string): Incident | undefined {
  return incidents.find((i) => i.slug === slug);
}
