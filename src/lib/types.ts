export type DeploymentType = "kraft" | "zookeeper" | "managed";

// Newest first. Apache actively supports the three most recent minor lines (4.1–4.3);
// 4.0 and 3.9 are kept as selectable reference points — 4.0 is what the course content and
// labs are written against, and 3.9 is the last 3.x line (the "before KRaft-only" case).
export const KAFKA_VERSIONS = ["4.3", "4.2", "4.1", "4.0", "3.9"] as const;
export type KafkaVersion = (typeof KAFKA_VERSIONS)[number];

// An "x.y" Kafka release line. NOT constrained to KAFKA_VERSIONS: content data records real
// release boundaries (the version a config was introduced, a version a default changed at),
// and those can be lines the picker no longer offers. Every KafkaVersion is a KafkaRelease.
// Compared numerically by `versionAtLeast` — never by position in KAFKA_VERSIONS.
export type KafkaRelease = `${number}.${number}`;

// Sortable integer for an "x.y" line: 4.0 → 4000, 4.1 → 4001, 3.9 → 3009. Minor stays well
// under 1000, so this orders correctly and is not lexicographic (4.10 > 4.9).
function releaseRank(release: KafkaRelease): number {
  const [major, minor] = release.split(".").map(Number);
  return major * 1000 + minor;
}

// True when `version` is the same release line as `min` or a newer one. Both are compared as
// numbers, so `min` may be any historical boundary — it does not need to be selectable.
export function versionAtLeast(version: KafkaRelease, min: KafkaRelease): boolean {
  return releaseRank(version) >= releaseRank(min);
}

// Compact label for a set of selectable Kafka versions: a run that is contiguous in
// KAFKA_VERSIONS collapses to "4.0–4.3" — including across the major boundary ("3.9–4.0"),
// since Kafka's minor numbering restarts per major and only the release list knows what
// follows what. A gap stays listed ("4.0, 4.2–4.3"). Input order does not matter.
export function versionRangeLabel(versions: readonly KafkaVersion[]): string {
  const present = new Set<string>(versions);
  const oldestFirst = [...KAFKA_VERSIONS].reverse().filter((v) => present.has(v));
  if (oldestFirst.length === 0) return "";
  const runs: [KafkaVersion, KafkaVersion][] = [];
  for (const v of oldestFirst) {
    const run = runs[runs.length - 1];
    // adjacent in KAFKA_VERSIONS (which is newest-first, so the next-older line is index + 1)
    if (run && KAFKA_VERSIONS.indexOf(v) === KAFKA_VERSIONS.indexOf(run[1]) - 1) run[1] = v;
    else runs.push([v, v]);
  }
  return runs.map(([lo, hi]) => (lo === hi ? lo : `${lo}–${hi}`)).join(", ");
}

// "current" = Apache still ships bugfix releases for this line; "archived" = end of life,
// no further patches (Apache supports only the three most recent minor lines).
export type VersionSupport = "current" | "archived";

export interface KafkaVersionInfo {
  // Date of the x.y.0 release.
  released: string;
  // Newest patch in the line.
  latestPatch: string;
  support: VersionSupport;
  // One line of context — why it is archived, or what is notable about the line.
  note?: string;
}

export const KAFKA_VERSION_INFO: Record<KafkaVersion, KafkaVersionInfo> = {
  "4.3": {
    released: "2026-05-22",
    latestPatch: "4.3.1",
    support: "current",
    note: "Latest release line.",
  },
  "4.2": {
    released: "2026-02-17",
    latestPatch: "4.2.1",
    support: "current",
    note: "First .0 release clear of CVE-2026-35554 (the producer buffer-pool race).",
  },
  "4.1": {
    released: "2025-09-02",
    latestPatch: "4.1.2",
    support: "current",
    note: "4.1.0 and 4.1.1 carry CVE-2026-35554 (producer buffer-pool race) — 4.1 users need 4.1.2, the patch shown here.",
  },
  "4.0": {
    released: "2025-03-18",
    latestPatch: "4.0.2",
    support: "archived",
    note: "First ZooKeeper-free release (KIP-833). No longer receives bugfix releases. The course content and every lab are written and verified against 4.0.2 — run 4.0.0 or 4.0.1 and you are exposed to CVE-2026-35554.",
  },
  "3.9": {
    released: "2024-11-06",
    latestPatch: "3.9.2",
    support: "archived",
    note: "Final Kafka 3.x line and the last that supports ZooKeeper mode. Archived by Apache in 2026 — stay on it only while a KRaft migration is still pending.",
  },
};

export function versionIsArchived(version: KafkaVersion): boolean {
  return KAFKA_VERSION_INFO[version].support === "archived";
}

// The lines Apache still ships bugfix releases for, newest first.
export const SUPPORTED_KAFKA_VERSIONS = KAFKA_VERSIONS.filter(
  (v) => KAFKA_VERSION_INFO[v].support === "current",
);

// ZooKeeper mode was removed in Kafka 4.0 (KIP-833) — from 4.0 on, only KRaft and managed
// services remain valid.
export function availableDeployments(version: KafkaVersion): DeploymentType[] {
  if (versionAtLeast(version, "4.0")) return ["kraft", "managed"];
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
  // The selectable Kafka versions this module's content is accurate for, rendered as a range
  // (`versionRangeLabel`). When the reader has a version outside this set selected, the
  // module page shows a caveat.
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
  // "client" = a common client property that behaves identically on a producer and a consumer
  // (connection, security, timeouts). Producer- or consumer-only properties use those scopes.
  scope: "broker" | "topic" | "producer" | "consumer" | "client";
  goal: string;
  controls: string;
  defaultValue: string;
  // Keyed at the release where the default CHANGED to that value; it holds for every newer
  // release. `getDefaultValue` picks the newest key the selected version has reached and
  // falls through to `defaultValue` below every key. Keys are real release boundaries and
  // need not be selectable versions (e.g. "3.6").
  defaultValueByVersion?: Partial<Record<KafkaRelease, string>>;
  // The release the config was introduced in — its true historical boundary, not clamped to
  // the selectable list. The entry is hidden in the Config Explorer for older selected
  // versions.
  availableFromVersion?: KafkaRelease;
  // Set when the config existed but only as an early-access/preview feature before a given
  // release — the Config Explorer flags it as early access for versions below this one
  // (and at or above availableFromVersion).
  earlyAccessUntilVersion?: KafkaRelease;
  changeMechanism: ChangeMechanism;
  riskOfChange: RiskLevel;
  managedAvailability: "full" | "limited" | "unavailable";
  whenToChange: string;
  performanceImpact: string;
  reliabilityImpact: string;
  relatedConfigs: string[];
  failureModes: string[];
  // The following are optional enrichment, populated for the configs a beginner meets first
  // and the highest-traffic operational ones. Omitted where a field would only restate
  // something above (e.g. rollback for a two-value boolean).
  //
  // A concrete value to copy, in the unit/format the setting expects.
  exampleValue?: string;
  // The value to set — or leave — when there is no specific reason to tune it: the
  // known-good posture for a typical production workload.
  safeBaseline?: string;
  // How to confirm the change took effect and did what you wanted — a command, a metric,
  // or an observable behaviour.
  verification?: string;
  // How to undo the change if it goes wrong, and what to expect while reverting.
  rollback?: string;
  // What is different about this setting on a managed service, beyond the coarse
  // managedAvailability flag — typically "the provider sets it" or "raise a support request".
  managedCaveat?: string;
}

// The version-pinned Apache Kafka 4.0 documentation anchor for a config. Derived from the
// scope so there is no per-entry URL to drift: the generated config reference uses
// `#<scope>configs_<key>` anchors, and `client`-scope common properties are documented on the
// producer-configs page.
export function kafkaDocUrl(entry: ConfigEntry): string {
  const page =
    entry.scope === "consumer"
      ? "consumer-configs"
      : entry.scope === "broker"
        ? "broker-configs"
        : entry.scope === "topic"
          ? "topic-configs"
          : "producer-configs";
  const anchorScope = entry.scope === "client" ? "producer" : entry.scope;
  return `https://kafka.apache.org/40/configuration/${page}/#${anchorScope}configs_${entry.key}`;
}

export function getDefaultValue(entry: ConfigEntry, version: KafkaVersion): string {
  const byVersion = entry.defaultValueByVersion;
  if (!byVersion) return entry.defaultValue;
  // Take the value keyed at the newest boundary the selected version has reached. Keys are
  // compared numerically, so a boundary older than any selectable version still resolves.
  let value = entry.defaultValue;
  let rank = -1;
  for (const [release, v] of Object.entries(byVersion) as [KafkaRelease, string][]) {
    if (versionAtLeast(version, release) && releaseRank(release) > rank) {
      value = v;
      rank = releaseRank(release);
    }
  }
  return value;
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
  // The selectable Kafka versions these steps apply to, rendered as a range on the detail
  // page with a caveat when the reader has something else selected.
  applicableVersions?: KafkaVersion[];
  // ISO date (YYYY-MM-DD) the procedure was last checked against real Kafka behavior.
  lastReviewed?: string;
  steps: {
    prechecks: string[];
    execution: string[];
    validation: string[];
    rollback: string[];
    escalation: string[];
  };
}
