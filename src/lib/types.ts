export type DeploymentType = "kraft" | "zookeeper" | "managed";

export const KAFKA_VERSIONS = ["4.0", "3.9", "3.7", "3.5"] as const;
export type KafkaVersion = (typeof KAFKA_VERSIONS)[number];

// Kafka 4.0 removed ZooKeeper mode (KIP-833) — only KRaft and managed services remain valid.
export function availableDeployments(version: KafkaVersion): DeploymentType[] {
  if (version === "4.0") return ["kraft", "managed"];
  return ["kraft", "zookeeper", "managed"];
}

export type RiskLevel = "safe" | "caution" | "high-risk";

// How a config change actually takes effect — these are different mechanisms, not degrees of one "dynamic" axis.
export type ChangeMechanism =
  | "dynamic-cluster" // kafka-configs.sh --alter against brokers/cluster-wide defaults, no restart
  | "topic-alter" // kafka-configs.sh --alter against a topic, no restart
  | "recreate-client" // producer/consumer configs: only take effect for a newly constructed client
  | "broker-restart"; // static broker config, requires a process restart

export interface Module {
  slug: string;
  index: number;
  title: string;
  summary: string;
  topics: string[];
  // Full lesson prose for a topic, keyed by the exact string in `topics`. Paragraphs are
  // separated by a blank line. Omitted (or partial) where the topic is still an outline
  // entry with no explanatory content written yet.
  topicNarrative?: Record<string, string>;
  activities: string[];
  // "external" = built, but as content outside this app (e.g. the local cluster lab)
  // rather than an embedded React demo.
  status: "available" | "planned" | "external";
}

export interface ConfigEntry {
  key: string;
  scope: "broker" | "topic" | "producer" | "consumer";
  goal: string;
  controls: string;
  defaultValue: string;
  // Only set when the default differs for that version; falls back to defaultValue otherwise.
  defaultValueByVersion?: Partial<Record<KafkaVersion, string>>;
  changeMechanism: ChangeMechanism;
  riskOfChange: RiskLevel;
  managedAvailability: "full" | "limited" | "unavailable";
  whenToChange: string;
  performanceImpact: string;
  reliabilityImpact: string;
  relatedConfigs: string[];
  failureModes: string[];
}

export function getDefaultValue(entry: ConfigEntry, version: KafkaVersion): string {
  return entry.defaultValueByVersion?.[version] ?? entry.defaultValue;
}

export interface Incident {
  slug: string;
  title: string;
  briefing: string;
  symptoms: string[];
  clues: string[];
  scoring: string[];
  status: "available" | "planned";
}

export interface TroubleshootingEntry {
  slug: string;
  symptom: string;
  causes: string[];
  resolutionFlow: string[];
}

export interface Runbook {
  slug: string;
  title: string;
  category: string;
  steps: {
    prechecks: string[];
    execution: string[];
    validation: string[];
    rollback: string[];
    escalation: string[];
  };
}
