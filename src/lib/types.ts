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
  // How much prior context this topic assumes — rendered as a small badge on the row so a
  // learner can tell the foundational topics from the deep mechanical ones at a glance.
  level?: Difficulty;
  // One sentence of framing, shown even while the topic is collapsed.
  summary: string;
  // A plain-language paragraph shown first inside the expanded panel, before the mechanics
  // — why this exists and why a beginner would care, ahead of the configs and edge cases.
  // Reserved for `level: "advanced"` topics, where the summary alone assumes too much.
  preface?: string;
  // Config keys this topic turns on — rendered as monospace chips.
  configs?: string[];
  // The mechanics, one point at a time. `term` is the knob or concept; `detail` explains it.
  points: { term: string; detail: string }[];
  // The failure mode that actually bites people — rendered as a callout.
  watchOut?: string;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

// Which part of the guide a module belongs to. The "beginner path" is the linear course a
// newcomer follows in order; "reference" material is looked up as needed; "advanced" is
// deeper mechanical detail that assumes the beginner path.
export type ModuleTrack = "beginner-path" | "reference" | "advanced";

// A single multiple-choice knowledge check. `answerIndex` points into `options`.
export interface KnowledgeCheck {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

// A hands-on task with observable success criteria — graded by the learner against the list,
// not auto-checked.
export interface Exercise {
  prompt: string;
  successCriteria: string[];
}

// One step in a guided code walkthrough — a module built around a real example project
// (`examples/<repo>/`) rather than around concepts. The learner reads `code` (a verbatim
// excerpt of `file`), works through the `points`, optionally runs `run`, and ticks the
// lesson off — the checkbox is persisted per walkthrough in the progress store.
export interface WalkthroughLesson {
  // Stable id, unique within the walkthrough. The progress-store key for this lesson's
  // checkbox — must not change once learners have progress saved.
  id: string;
  // Optional group heading rendered before this lesson (and until the next one that sets
  // it). Used to split a long walkthrough into phases, e.g. "Build it" / "Break it".
  section?: string;
  title: string;
  // One to three sentences of framing before the code.
  intro: string;
  // Path of the excerpted file, relative to the walkthrough's `repoPath`.
  file: string;
  // A verbatim slice of `file`. A data test asserts this string still occurs in the source,
  // so a rename or a config change in the example breaks the build rather than drifting.
  code: string;
  // The lines that matter, one point at a time. `term` is the concept or the identifier.
  points: { term: string; detail: string }[];
  // An optional command the learner can run at this point (needs the lab broker running).
  run?: string;
  // The mistake this step most commonly hides — rendered as a callout.
  watchOut?: string;
}

// A guided walk through a real example project, rendered above (in place of) the usual
// topic content on a module page.
export interface Walkthrough {
  // Stable id; also the progress-store namespace for the lesson checkboxes.
  slug: string;
  title: string;
  // One or two sentences: what the project is and what the walkthrough builds toward.
  summary: string;
  // The example's directory, relative to the repo root — e.g. "examples/order-pipeline-java".
  repoPath: string;
  // How to get the code in front of you before starting.
  cloneNote: string;
  lessons: WalkthroughLesson[];
}

// One command in a lab's setup or teardown: what to run and why it is there.
export interface LabCommand {
  command: string;
  note: string;
}

// A single hands-on step in an in-app lab walkthrough. The learner runs `command`, compares
// what they see against `expected`, answers `observe` for themselves, and ticks the step off
// — the checkbox state is persisted per lab in the progress store.
export interface LabStep {
  // Stable id, unique within the lab. Used as the progress-store key for this step's checkbox,
  // so it must not change once learners have progress saved against it.
  id: string;
  title: string;
  // One or two sentences of framing before the command.
  intro: string;
  // The exact command to run, rendered as a copyable block.
  command: string;
  // What a correct run prints — the whole thing, or the lines that matter.
  expected: string;
  // A "what did you observe?" question that forces the learner to read the output.
  observe: string;
  // The mistake that most commonly bites at this step, and how to recover from it.
  commonError?: {
    symptom: string;
    cause: string;
    recovery: string;
  };
}

// A per-platform setup note — the OS matrix shown before a lab's prerequisites.
export interface LabPlatformNote {
  // "macOS" | "Windows (WSL 2)" | "Linux"
  platform: string;
  note: string;
}

// A lab-level failure mode (as opposed to a per-step one) — environment problems that can
// hit at any point: too little memory, a port clash, a stale container.
export interface LabTroubleshootingEntry {
  symptom: string;
  cause: string;
  fix: string;
}

// An in-app, step-by-step lab the learner works through against a real Kafka broker.
export interface Lab {
  // Stable id; also the progress-store namespace for the step checkboxes.
  slug: string;
  title: string;
  // One or two sentences: what the learner builds and why it is the smallest useful setup.
  summary: string;
  // Per-OS setup differences. Omitted for a lab with no meaningful OS variation.
  platformNotes?: LabPlatformNote[];
  // The memory / disk floor and what happens below it.
  resourceFloor?: string;
  // What must be true before starting — tooling, resources.
  prerequisites: string[];
  // Commands that bring the environment up, before the numbered steps.
  setup: LabCommand[];
  // An automated health check the learner can run to confirm setup worked.
  verify?: LabCommand;
  steps: LabStep[];
  // Environment-level failure modes and their fixes.
  troubleshooting?: LabTroubleshootingEntry[];
  // Commands that bring the environment down. Carries the destructive-cleanup warning.
  teardown: LabCommand[];
  // The one thing to be careful about when tearing down — rendered as a callout.
  teardownWarning: string;
}

export interface Module {
  slug: string;
  index: number;
  title: string;
  summary: string;
  // Learner-facing course metadata. Optional so a module that is still an outline (or an
  // older test fixture) still typechecks; the data tests require them on real modules.
  difficulty?: Difficulty;
  // Learner-facing minutes to work through the module. Feeds the computed course length.
  estimatedMinutes?: number;
  // Module slugs a learner should have done first.
  prerequisites?: string[];
  // "By the end of this module you can …" — 3–5 entries.
  objectives?: string[];
  // What "done" means for this module — the bar for marking it complete.
  completionCriteria?: string[];
  // External links for going deeper, typically official Apache Kafka docs.
  furtherReading?: { label: string; url: string }[];
  // Kafka versions this module's content has been checked against. Full version-gating is a
  // later phase; the field lands here so metadata has one home.
  applicableVersions?: KafkaVersion[];
  // ISO date (YYYY-MM-DD) the content was last checked against real Kafka behavior.
  lastReviewed?: string;
  track?: ModuleTrack;
  // Assessment content is authored in a later phase; the fields exist now so the render slot
  // and types are stable.
  knowledgeChecks?: KnowledgeCheck[];
  exercises?: Exercise[];
  // In-app, step-by-step hands-on labs rendered above the topic content. The first renders
  // expanded; any others render collapsed.
  labs?: Lab[];
  // A guided walk through a real example project. When set, it replaces the topic content
  // on the module page (the module is built around code, not concepts).
  walkthrough?: Walkthrough;
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

export interface GlossaryTerm {
  // URL-safe id used for the `/glossary#<slug>` anchor and for `[[slug]]` inline links.
  slug: string;
  // The term as it reads in a heading.
  term: string;
  // One or two sentences. Plain text.
  definition: string;
  // Slugs of related glossary terms.
  seeAlso?: string[];
  // Module slugs where this term is taught or used.
  modules?: string[];
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
