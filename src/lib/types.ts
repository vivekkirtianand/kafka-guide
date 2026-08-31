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

// A topic broken into scannable pieces for the expand/collapse Topic explorer, as an
// alternative to the prose in `topicNarrative`. Keyed by the exact string in `topics`.
export interface TopicDetail {
  // One sentence of framing, shown even while the topic is collapsed.
  summary: string;
  // Config keys this topic turns on — rendered as monospace chips.
  configs?: string[];
  // The mechanics, one point at a time. `term` is the knob or concept; `detail` explains it.
  points: { term: string; detail: string }[];
  // The failure mode that actually bites people — rendered as a callout.
  watchOut?: string;
}

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
  // Structured, collapsible version of the same lesson content. Takes precedence over
  // `topicNarrative` when present. Keyed by the exact string in `topics`.
  topicDetail?: Record<string, TopicDetail>;
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
  // Set when the config did not exist before a given release — the entry is hidden in the
  // Config Explorer for older selected versions.
  availableFromVersion?: KafkaVersion;
  // Set when the config existed but only as an early-access/preview feature before a given
  // release — the Config Explorer flags it as early access for versions below this one
  // (and at or above availableFromVersion).
  earlyAccessUntilVersion?: KafkaVersion;
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

// KAFKA_VERSIONS is ordered newest-first, so a lower index means a newer release.
export function versionAtLeast(version: KafkaVersion, min: KafkaVersion): boolean {
  return KAFKA_VERSIONS.indexOf(version) <= KAFKA_VERSIONS.indexOf(min);
}

export function configAvailable(entry: ConfigEntry, version: KafkaVersion): boolean {
  return !entry.availableFromVersion || versionAtLeast(version, entry.availableFromVersion);
}

// True when the config is available in this version but only reached production readiness
// in a later one.
export function configIsEarlyAccess(entry: ConfigEntry, version: KafkaVersion): boolean {
  return (
    configAvailable(entry, version) &&
    !!entry.earlyAccessUntilVersion &&
    !versionAtLeast(version, entry.earlyAccessUntilVersion)
  );
}

// A piece of evidence the operator can choose to reveal during an incident. `label` is the
// investigation step (matches one of the incident's `clues` categories); `evidence` is what
// that check turns up in this scenario.
export interface IncidentClue {
  label: string;
  evidence: string;
}

// One candidate root cause. Exactly one option per incident has `correct: true`. `feedback`
// explains why it is right, or — for the wrong options — what that cause's real signature
// would look like and why the evidence doesn't match it.
export interface IncidentDiagnosisOption {
  label: string;
  correct: boolean;
  feedback: string;
}

export interface Incident {
  slug: string;
  title: string;
  briefing: string;
  symptoms: string[];
  // High-level categories of evidence available, shown even before the scenario is built.
  clues: string[];
  scoring: string[];
  // The built-out fault: the concrete clue evidence and the diagnosis choices. Present once
  // the scenario is playable; absent while it is still `status: "planned"`.
  investigation?: {
    clues: IncidentClue[];
    options: IncidentDiagnosisOption[];
  };
  status: "available" | "planned";
}

export interface TroubleshootingCause {
  // The candidate cause, short.
  cause: string;
  // The specific metric, log line, or command output that confirms this cause or rules it
  // out — what to look at, not just "check the logs".
  evidence: string;
}

export interface TroubleshootingEntry {
  slug: string;
  symptom: string;
  // One or two sentences of framing: what the symptom actually means and the trap to avoid.
  overview: string;
  causes: TroubleshootingCause[];
  resolutionFlow: string[];
  // Config keys that show up in the diagnosis or the fix — rendered as monospace chips.
  keyConfigs?: string[];
  // The mistake that makes the symptom disappear while making the system worse.
  watchOut?: string;
}

export interface Runbook {
  slug: string;
  title: string;
  category: string;
  // One or two sentences: what the procedure achieves and the main risk it manages.
  summary: string;
  // When this runbook applies — the trigger or the decision that leads you here.
  when: string;
  steps: {
    prechecks: string[];
    execution: string[];
    validation: string[];
    rollback: string[];
    escalation: string[];
  };
}
