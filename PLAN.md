# Kafka, Operationally — Build Plan & Status

Tracks work against the guide plan referenced in [README.md](README.md). Statuses: ✅ Done · 🚧 In progress · ⭕ Planned (not started) · ❓ Open question.

---

# v2 — beginner course redesign

A second plan reworks the reference-first guide below into a linear beginner course: a path
from "what is an event" to an unassisted capstone, with progress tracking, real hands-on
labs, a Java producer/consumer project, a schema module, Connect/Streams, assessments, and
version awareness. It **reorganizes, not rewrites**, the existing material. Delivered one PR
per unit, each with external review rounds — same pattern as v1.

Target outcome: a learner with no Kafka experience can explain when/why Kafka is used, run it
locally and inspect a topic, build a producer and consumer, design keys/partitions/schemas
safely, reason about delivery guarantees and consumer recovery, use Connect and Streams at an
intro level, operate a production-style cluster, and complete an end-to-end capstone.

## Roadmap — all 11 phases

### Target module map (v2's 0–12 vs. v1's 1–7)

| v2 | Module | Source | Phase |
|--|--|--|--|
| 0 | Why Kafka and when to use it | new | 2 |
| 1 | Events, topics, partitions, brokers | rework `mental-model` | 6 |
| 2 | First local Kafka workflow (Lab A) | rework `local-cluster-lab` | 3 |
| 3 | Build a producer and consumer (Java) | new | 4 |
| 4 | Keys, ordering, delivery guarantees | split from `mental-model` / `producer-configuration` | 6 |
| 5 | Schemas and data contracts | new | 5 |
| 6 | Consumer groups and resilient processing | rework `consumer-configuration` | 6 |
| 7 | Kafka Connect and Kafka Streams | new | 7 |
| 8 | Broker, topic and security configuration | `broker-topic-configuration` | 8/9 |
| 9 | Observability | `observability` | — (mostly done) |
| 10 | Troubleshooting and incidents | `troubleshooting-scenarios` + incident simulator | — (mostly done) |
| 11 | Production operations | runbooks | 8 |
| 12 | Capstone project | new | 10 |

### Phase → PR breakdown

Execution order follows the plan's own "Suggested priority". Each row is one reviewable PR
unless noted.

| # | Phase | PRs | Depends on | Milestone |
|--|--|--|--|--|
| **1** | **Course framework** | 1a data model + metadata + IA + computed duration; 1b progress tracking (localStorage); 1c glossary | — | M1 |
| 2 | Module 0 — Why Kafka? | 2a topic content; 2b 4 interactive activities; 2c 10-Q knowledge check + "should this use Kafka?" exercise | 1a, 1c | M1 |
| 3 | Rework local lab | 3a Lab A single-broker walkthrough as **in-app** lesson (10 steps × command/output/observe/error/recovery/checkbox); 3b Lab B = existing 3-broker lab + OS matrix + `verify-lab` script + volume-delete warning + in-app instructions | 1a, 1b | M1 |
| 4 | Java producer/consumer module | 4a `examples/order-pipeline-java/` scaffold (producer/consumer/shared/tests) + CI; 4b Module 3 lessons 1–11; 4c multi-consumer + tests + intentional-failure exercises | 3a | M2 |
| 5 | Schemas & serialization | 5a Module 5 topic content (bytes, JSON/Avro/Protobuf, Schema Registry, compatibility modes, poison records); 5b labs — evolve `order-event` schema while an old consumer runs | 4 | M2 |
| 6 | Re-sequence core material | 6a beginner/intermediate/advanced **level** on topics + Module 1/4/6 split + renumber (`index` 0-based, nav + tests); 6b a "basic explanation" preface before each advanced mechanical topic | 1a, 2 | M2 |
| 7 | Connect & Streams | 7a Module 7 Connect content + file/DB↔Kafka lab (lab stack already has `cp-kafka-connect`); 7b Streams content + order-total aggregation lab | 4, 5 | M2 |
| 8 | Version & deployment awareness | 8a add Kafka 4.1/4.2/4.3 to `KAFKA_VERSIONS`, mark archived releases, bump lab image; 8b `applicableVersions` on lessons/configs/runbooks + selected version affects content + "Reviewed against Kafka X on DATE"; 8c rename "version + deployment aware" → "configuration context", "Every setting" → "Curated configurations" (do first, cheap) | 1a | M3 |
| 9 | Expand config explorer | 9a ~15 beginner client configs (`bootstrap.servers`, serializers/deserializers, `compression.type`, fetch tuning, …); 9b add `ConfigEntry` fields — example config, safe baseline, verification, rollback, version applicability, managed caveat, official doc link — and backfill | 8b | M3 |
| 10 | Assessments & capstone | 10a per-lesson knowledge checks (content for all modules); 10b per-module practical verification; 10c capstone brief + 11-step spec + scoring rubric (correctness / reliability / observability / operational safety) | 4, 5, 7 | M3 |
| 11 | UX, a11y, QA | 11a accessible names on every filter/form control + `axe` checks; 11b Playwright browser-journey + keyboard-only tests; 11c broken-link + mobile-viewport + content-schema validation; 11d reduced-motion for demos + printable views; 11e full quality-gate list in CI | all content phases | M3 |

### Milestones

- **M1 — Beginner MVP**: Phases 1, 2, 3. First point the course is credibly beginner-friendly.
- **M2 — Complete developer path**: Phases 4, 5, 6, 7 + assessments from 10a/10b.
- **M3 — Production-ready**: Phases 8, 9, 10c, 11.

### Cross-cutting risks

- **Java toolchain in CI** (Phase 4): the repo is Node-only today. `examples/order-pipeline-java/`
  needs its own Gradle/Maven build + a separate CI job. Decide Gradle vs Maven at 4a.
- **Renumber timing** (Phase 6): doing it before Module 0 exists means a throwaway 0-based
  shuffle — Module 0 (Phase 2) is sequenced before the renumber so there's an anchor. Slugs
  are already semantic, so the renumber is the `index` field + array order + nav, not routes.
- **Lab content moving in-app** (Phase 3): today Module 2 links out to GitHub. Lab A becomes a
  real in-app lesson type — a new render path, not just data.

### Phase-1 acceptance criteria

1. Every module page shows objectives, prerequisites, difficulty, and estimated time.
2. Module completion survives a browser refresh.
3. Learner can tell lessons / labs / reference / advanced material apart.
4. The home-page course-length estimate is computed from per-module estimates, not hardcoded.

## Phase 1 — course framework

| PR | Scope | Status |
|---|---|---|
| 1a | Course data model + per-module metadata + beginner/reference IA + computed course length | ✅ Done |
| 1b | Progress tracking (localStorage): completion state, resume, progress %, reset | ✅ Done |
| 1c | Glossary route + data + inline term component | ✅ Done |

### PR 1a — data model + metadata + IA

- `src/lib/types.ts` — `Module` gains optional `difficulty`, `estimatedMinutes`,
  `prerequisites`, `objectives`, `completionCriteria`, `furtherReading`, `applicableVersions`,
  `lastReviewed`, `track`; new `KnowledgeCheck` / `Exercise` types + `knowledgeChecks` /
  `exercises` fields (content authored in Phase 10, slot lands now).
- `src/lib/course.ts` (new) — `courseHours`, `courseWeeks`, `beginnerPath`,
  `referenceModules`, `advancedModules`. `course.test.ts` covers the math + a real-list
  partition check.
- `src/lib/data/modules.ts` — all 7 modules populated: difficulty, time estimate, 3–4
  objectives, prerequisites (each resolves to an earlier module), completion criteria,
  further reading (official Apache docs, https-only), `track`, `lastReviewed`.
  Tracks: `mental-model` + `local-cluster-lab` → beginner-path; the other five → reference.
- `src/components/ModuleMeta.tsx` (new) — module-page header: difficulty/track badges,
  `~N min`, prerequisites as links, objectives list, "Reviewed against Kafka 4.0 · DATE".
- `src/app/modules/[slug]/page.tsx` — renders `<ModuleMeta>`, a "Further reading" block, and
  a **prev** link beside the existing next link.
- `src/app/page.tsx` — "Learning path" split into **Beginner path** + **Reference modules**;
  the hardcoded "7 modules · ~8 weeks" is now computed from `courseWeeks(beginnerPath(modules))`
  (currently 2 modules · ~1 week).
- `src/components/ModuleCard.tsx` — difficulty + `~N min` on the footer line.
- `src/components/Sidebar.tsx` — "Guide" split into "Beginner path" / "Reference modules".
- Tests: `modules.test.ts` +6 (metadata present, prereqs resolve to earlier modules,
  further-reading links version-pinned, track partition); `ModuleCard.test.tsx` (new);
  `course.test.ts` (new). Suite 189 → 203.

**Review findings addressed (round 1)**

| # | Finding | Fix |
|---|---|---|
| 1 | Beginner-path header showed "7 modules · ~3 weeks" over 2 modules | `courseWeeks(beginner)` + `beginner.length` — now "2 modules · ~1 week" |
| 2 | Prev/next crossed track boundaries (lab → producer-config) | new `trackNeighbors()` in `course.ts` — navigation stays within the module's track; the last beginner module has no "next" |
| 3 | "version + deployment aware" badge sat on the Reference modules heading | badge moved onto the Configuration Explorer card (the only surface that responds to those selectors); heading now reads "look up as needed" |
| 4 | `kafka.apache.org/documentation/#anchor` links redirect to the docs landing page | all `furtherReading` links repointed to version-pinned Kafka 4.0 URLs (`/40/configuration/producer-configs/`, `/40/getting-started/introduction/`, …); test rejects unversioned `kafka.apache.org` links |

### PR 1b — progress tracking (localStorage)

- `src/lib/context/ProgressContext.tsx` (new) — a `useSyncExternalStore`-backed store over
  `localStorage["kafka-guide:progress"]` (`Record<slug, {completed, completedAt?, visitedAt?}>`).
  SSR snapshot is empty; cross-tab `storage` events refresh it; every read/write is
  try/caught so a blocked store degrades to "won't persist" rather than throwing. API:
  `isComplete`, `markComplete` / `markIncomplete` / `toggleComplete`, `markVisited`,
  `resetAll`, `completedCount(slugs)`, `resumeSlug(slugs)`, `hydrated`.
- `src/app/layout.tsx` — `<ProgressProvider>` inside `<ClusterProvider>`.
- `src/components/ModuleCompletion.tsx` (new) — bottom-of-module client block: completion
  criteria + a "Mark module complete" ⇄ "Completed" toggle; `markVisited` on mount. Shown
  for every non-`planned` module.
- `src/components/ModuleProgressBadge.tsx` (new) — "✓ done" / "started" indicator, renders
  nothing until `hydrated`. Used on `ModuleCard` and in the `Sidebar` module lists.
- `src/components/BeginnerPathProgress.tsx` (new) — home-page bar: `done/total`, a
  progressbar with an accessible name, a "Resume/Start: <module>" link to `resumeSlug`, and
  a confirm-gated "Reset progress" button (both appear only once there is progress).
- Tests: `ProgressContext.test.tsx` (new, 8 — persist/restore, toggle, reset, counts, resume
  ordering, throwing-storage resilience); `ModuleCard` + `Sidebar` tests wrapped in the
  provider. `vitest.setup.ts` installs a minimal in-memory `localStorage` polyfill
  unconditionally (jsdom here provides none; probing for one made Node emit an
  ExperimentalWarning per worker). Suite 203 → 211.

### PR 1c — glossary

- `src/lib/data/glossary.ts` (new) — 35 core terms `{ slug, term, definition, seeAlso?,
  modules? }`, from `event` / `offset` / `partition` through `idempotence`, `exactly-once`,
  `schema-registry`, `dead-letter-queue`. `GlossaryTerm` type added to `types.ts`.
- `src/app/glossary/page.tsx` + `src/components/Glossary.tsx` (new) — alphabetical `<dl>`,
  each row `id`'d for `/glossary#<slug>` deep links (`scroll-mt` + a `scrollIntoView` assist),
  `type=search` filter with an `aria-label`, "See also" (anchor links) and "Appears in"
  (module links) per term.
- `src/components/GlossaryTerm.tsx` (new) — inline `<GlossaryTerm slug>` (dotted-underline
  link to the anchor; renders plain text if the slug is unknown) plus `renderGlossaryText()`,
  which turns `[[slug]]` / `[[slug|display]]` tokens in a string into those links and returns
  the string untouched when there are none.
- `src/components/TopicExplorer.tsx` — runs `summary`, each `point.detail`, and `watchOut`
  through `renderGlossaryText`. Module 1's topic summaries carry a handful of `[[…]]` tokens
  as the first real use.
- `Sidebar` + home "Practice and lookup" gain a Glossary entry.
- Tests: `glossary.test.ts` (new — unique slugs/terms, `seeAlso`/`modules` resolve, and every
  `[[slug]]` token in module content resolves to a real term); `GlossaryTerm.test.tsx` (new —
  known/unknown slug rendering, token parsing); `Glossary.test.tsx` (new — filtering,
  see-also-while-filtered). Suite 211 → 224.

**Review findings addressed (round 1)**

| # | Finding | Fix |
|---|---|---|
| 1 | A "See also" link to a term the active search filters out did nothing (dead anchor) | `Glossary` intercepts see-also clicks: if the target row isn't rendered, clear the query, then scroll to it once it re-renders (`pendingScroll` ref + an effect keyed on `query`) |
| 2 | Glossary "Controller" definition said a controller is a broker | reworded — "a server runs as a controller, as a broker, or (in small clusters) as both — set by `process.roles`", matching the Module 1 / Module 5 content |

## Phase 2 — Module 0: Why Kafka?

| PR | Scope | Status |
|---|---|---|
| 2a | Module 0 shell + Topic-explorer content for all 9 topics | ✅ Done |
| 2b | 4 interactive activities (tech-choice picker, order-event fan-out, queue-vs-log, label-the-event) | ⭕ Planned |
| 2c | 10-question beginner knowledge check + "Should this system use Kafka?" design exercise | ⭕ Planned |

### PR 2a — Module 0 shell + topic content

- `src/lib/data/modules.ts` — new first entry `why-kafka` (**`index: 0`**), `track:
  "beginner-path"`, `status: "available"`, `activities: []` (2b), full `topicDetail` for all
  9 topics: what an event is · key/value/timestamp/headers/schema · streaming vs
  request/response · Kafka vs queues / databases / object storage · common use cases · when
  Kafka is a poor choice · main components at a high level. `mental-model` now lists
  `why-kafka` as a prerequisite.
- **Module indexes are now 0-based** — the array is `why-kafka`(0) … `troubleshooting`(7),
  so `index === arrayPosition`. `modules.test.ts`'s sequential-index check updated from
  `i + 1` to `i`. Display strings already `padStart(2, "0")`, so headings read "Module 00".
  `trackNeighbors` / `ModuleMeta` / sidebar unaffected (all key off `index` order, not a
  starting value).
- `src/app/page.tsx` — hero CTA now links `beginnerPath(modules)[0]` ("Start the beginner
  path") instead of the hardcoded mental-model link.
- Tests: `modules.test.ts` +4 — Module 0 is index 0 / beginner-path / no prereqs; covers
  every topic; **acceptance criterion**: its content matches none of `/ISR|in-sync
  replica/`, `/acknowledgement|acks/`, `/KRaft|controller quorum|quorum/`; frames Kafka
  against queues / databases / "poor choice" / request-response. Suite 224 → 228.

**Review findings addressed (round 1)**

| # | Finding | Fix |
|---|---|---|
| 1 | Ordering described as topic/stream-wide | reworded to "scoped — it holds within a partition, not across a whole topic" |
| 2 | Said Kafka "pushes" records to consumers | reworded — "a consumer polls a topic and pulls each new event … Kafka doesn't push; the consumer asks"; consumer component now says "by polling the broker" |
| 3 | Replication presented as automatic | "You can also configure a partition to be copied … (its replication factor) … it is a setting, not automatic" |
| 4 | Said Kafka is "not a system of record" | "Kafka can be the system of record for events — the authoritative log … What it is not is a query database" |
| 5 | Module 0 not linked to the glossary | 13 inline `[[…]]` links added across Module 0; `why-kafka` added to `modules` on 15 glossary terms (event, topic, partition, offset, key, broker, cluster, producer, consumer, consumer-group, replication-factor, retention, log-compaction, schema-registry, serialization) |
| 6 | Acceptance test scanned only the Topic-explorer body and missed `acknowledge`/`acknowledgment` | `allText` now includes title, summary, objectives, completion criteria, topic strings, and further-reading; regex broadened to `/\backnowledg/` and `/\backs?\b/` |

**Review findings addressed (round 2)**

| # | Finding | Fix |
|---|---|---|
| 1 | Object-storage comparison still said events arrive "in order" | dropped "in order" — the point is about the poll/pull access pattern, not ordering |
| 2 | "the next topic unpacks this" was wrong (next topic is event fields) | "a later topic unpacks this" |
| 3 | Acceptance test corpus omitted `m0.activities` (populated in 2b) | `...m0.activities` added to `allText` |

## Module 1 — Kafka mental model

All four planned **activities** are built out, and all 6 topics have real Topic explorer
content (`topicDetail` — summary, mechanics points, config chips, watch-out), the same
scannable format as Modules 3–6. `status: "available"`.

| Item | Status | Notes |
|---|---|---|
| Topics — Topic explorer content (6 topics) | ✅ Done | Authored in PR #7 (`b8c7218`, "Module 1: write the mental-model topics as Topic explorer content" + one Kafka-accuracy review round `42e5bdf`): append-only log, brokers/topics/partitions/replicas, leaders/followers/ISR/controllers, producers/consumers/offsets/groups, ordering guarantees, delivery semantics. A second review pass (this PR) tightened five points — offsets aren't gapless (compaction + txn markers), `replica.lag.time.max.ms` (30s default) names the ISR-drop clock and is now a config chip, murmur2 modulo the partition count for key→partition, null-key spread is per-batch not per-record, and idempotent-producer ordering is the **producer** stamping a per-partition sequence number that the broker validates (it neither assigns the number nor reorders). `modules.test.ts` has a dedicated assertion for each. |
| Activity: animate producer → partition → consumer | ✅ Done | [RecordFlowDemo.tsx](src/components/demos/RecordFlowDemo.tsx) — includes a predict-before-reveal step (guess the partition, then produce). |
| Activity: change partition count, observe ordering | ✅ Done | [PartitionOrderingDemo.tsx](src/components/demos/PartitionOrderingDemo.tsx) — toggle 1–4 partitions, step through a fixed keyed-event sequence. |
| Activity: simulate broker failure and leader election | ✅ Done | [LeaderElectionDemo.tsx](src/components/demos/LeaderElectionDemo.tsx) — pre-existing, reworked (see Fixes below). |
| Activity: predict before reveal | ✅ Done | Folded into RecordFlowDemo rather than built as a separate standalone activity. |

## Module 2 — Local cluster laboratory

Unlike Module 1, this module's content isn't a React page — it's the actual local-cluster
deliverable README.md scopes as separate from the Next.js app: a reproducible three-broker
Kafka cluster and observability stack, built at [local-cluster-lab/](local-cluster-lab/).
The in-app `/modules/local-cluster-lab` page ([page.tsx](src/app/modules/%5Bslug%5D/page.tsx))
no longer shows the generic "planned" placeholder — it renders a "lab built" badge and links
out to the `local-cluster-lab/` folder on GitHub. `Module.status` in
[types.ts](src/lib/types.ts) gained a third value, `"external"` (built, but as content
outside this app rather than an embedded React demo), so the module index card
([ModuleCard.tsx](src/components/ModuleCard.tsx)) also shows a distinct "lab built" badge
instead of grouping this module in with the still-actually-unbuilt "planned" ones.

| Item | Status | Notes |
|---|---|---|
| Three Kafka brokers in KRaft mode | ✅ Done | [docker-compose.yml](local-cluster-lab/docker-compose.yml) — `apache/kafka:4.0.2`, each node both broker and controller (3-node KRaft quorum, no ZooKeeper, matching the app's Kafka 4.0/KRaft default in [ClusterContext.tsx](src/lib/context/ClusterContext.tsx)). |
| Kafka CLI tools | ✅ Done | No extra install — used via `docker exec` into any broker container, documented per-activity in [local-cluster-lab/README.md](local-cluster-lab/README.md). |
| Kafka UI | ✅ Done | `provectuslabs/kafka-ui` at `localhost:8080`; verified `/api/clusters` reports `status: online`, `brokerCount: 3`. |
| Metrics: Prometheus + Grafana | ✅ Done | `danielqsj/kafka-exporter` (no JMX agent needed) → Prometheus (`localhost:9090`) → Grafana (`localhost:3001`, anonymous access), with a pre-provisioned "Kafka lab overview" dashboard (broker count, under-replicated partitions, consumer lag, per-topic write rate, ISR-vs-total-replicas table). |
| Optional Schema Registry and Kafka Connect | ✅ Done | `confluentinc/cp-schema-registry` + `cp-kafka-connect`, gated behind `docker compose --profile extras up -d` so the base lab stays light. |
| Activity: create and inspect topics | ✅ Done | Verified live — created a 3-partition/RF-3 topic, `--describe` showed replicas spread across all three brokers. |
| Activity: produce with and without keys | ✅ Done | Verified live — keyed records consumed with `print.key=true` confirmed same-key-same-partition placement. |
| Activity: observe partition placement | ✅ Done | Verified live via `--describe` output (leader/replicas/ISR columns), same data Kafka UI's topic view surfaces. |
| Activity: stop and restart brokers | ✅ Done | Verified live — stopped the current partition leader, watched a follower get elected and the stopped broker drop from ISR; restarted it and confirmed it rejoined ISR without reclaiming leadership. |
| Activity: inspect consumer offsets | ✅ Done | Verified live via `kafka-consumer-groups.sh --describe`, including reset-and-replay with `--reset-offsets --to-earliest`. |
| Activity: change topic-level configuration safely | ✅ Done | Verified live — dynamic `retention.ms` override applied and removed via `kafka-configs.sh --alter`, no restart needed. |

**Fix during build:** the brokers' healthcheck originally ran `kafka-broker-api-versions.sh`
against the container's own `EXTERNAL` listener, which advertises the host-facing
`localhost:2909x` address — unreachable from inside the container, so every check failed.
Switched to the internal `BROKER` listener; that in turn revealed the JVM-per-check admin
client was too CPU-heavy running three-wide on an ordinary laptop (consistently timed out
under load even though the broker was healthy). Replaced with a plain `nc -z` TCP check on
the broker's socket — cheap and sufficient for liveness — after which the whole stack (7
containers) came up healthy end-to-end within about a minute.

**Review findings addressed** (all reproduced and independently re-verified live, not
just patched from the description):

| Finding | Status | Fix |
|---|---|---|
| Broker data written to the container filesystem, not the named volume | ✅ Done | `KAFKA_LOG_DIRS` was never set, so `log.dirs` fell back to Kafka's own built-in default (`/tmp/kafka-logs`, confirmed by inspecting a running container — not `/tmp/kraft-combined-logs` as initially suspected, but the same underlying bug), bypassing the `/var/lib/kafka/data` volume mount entirely. Added `KAFKA_LOG_DIRS: /var/lib/kafka/data` to the common environment. Re-verified end-to-end: produced a keyed record, ran a real `docker compose down` (containers removed, volumes kept) + `up`, confirmed the topic and record both survived (`kafka-dump-log.sh` showed the record on disk; console consumer read it back at its exact offset). |
| Every published port bound to all interfaces | ✅ Done | None of these services authenticate (Kafka, Kafka UI's dynamic config, Grafana's anonymous-admin access, Connect, Schema Registry). Bound every `ports:` entry to `127.0.0.1` explicitly. Verified via `docker compose ps --format json`: every service's `Publishers[].URL` now reports `127.0.0.1`. |
| Kafka 4.0.0 vulnerable to CVE-2026-35554 (producer buffer-pool race; can silently corrupt or misroute records) | ✅ Done | Bumped to `apache/kafka:4.0.2` (contains the fix, per Apache's own CVE list). Re-verified the full activity set still passes on 4.0.2. |
| Four images pinned to mutable `latest` | ✅ Done | `kafka-exporter` → `v1.9.0`, `prometheus` → `v3.14.0`, `grafana` → `13.1.4` (all pulled and confirmed working). `kafka-ui` pinned by digest instead of a version tag — upstream hasn't cut a tagged release since v0.7.2 (April 2024) and ships continuously to `latest`. |
| Three Grafana panels overstated what their queries showed | ✅ Done | "Under-replicated partitions" used `count()` over a comparison that returns empty (renders "No data") when the cluster is healthy — switched to `sum(kafka_topic_partition_under_replicated_partition)`, the exporter's own purpose-built gauge (confirmed present via `/metrics`), which returns `0` cleanly. "Partition current offset (write rate proxy)" plotted a cumulative counter as if it were a rate — wrapped in `rate(...[1m])` and retitled "Partition write rate (records/sec)" to match what it now actually computes. "ISR vs total replicas" table only queried ISR count — added `kafka_topic_partition_replicas` as a second target so both columns render. All three queries re-run directly against a live Prometheus instance to confirm correct output. |
| No CI coverage for the new deliverable | ✅ Done | Added a `verify-local-cluster-lab` job to [ci.yml](.github/workflows/ci.yml): `docker compose config --quiet` for both the base and `--profile extras` compose graphs, plus `jq empty` on the dashboard JSON. All three commands re-run locally and pass. |

## Module 3 — Producer configuration

At the time this module shipped it was the first with real lesson content: all 7 topics
written as prose, not just a bullet outline, in addition to the 4 interactive activities
below. `Module.topicNarrative` (new, optional field on `Module` in
[types.ts](src/lib/types.ts)) carries this content, rendered by
[page.tsx](src/app/modules/%5Bslug%5D/page.tsx) as full prose sections when present.
(Every module was later moved to the scannable `topicDetail` Topic explorer format, which
takes precedence over `topicNarrative` — so no module uses `topicNarrative` today. Module 7
embeds the troubleshooting catalog instead. The bullet-outline layout is now only the
fallback for an unbuilt module.)

| Item | Status | Notes |
|---|---|---|
| Topic narrative (all 7 topics) | ✅ Done | Written directly into `modules.ts`'s `producer-configuration` entry; verified rendering in-browser against the real page, not just the data. |
| New config entries (9) | ✅ Done | [configs.ts](src/lib/data/configs.ts) gained `retries`, `buffer.memory`, `max.block.ms`, `max.request.size`, `request.timeout.ms`, `delivery.timeout.ms`, `max.in.flight.requests.per.connection`, `transactional.id`, `transaction.timeout.ms` — closing gaps that existing entries' `relatedConfigs` already referenced but didn't define. Verified in Config Explorer: 21/21 entries render, new goal categories populate the filter automatically, expanding `transactional.id` shows all fields correctly cross-referenced. |
| Activity: compare acks=0/1/all + kill the partition leader during production | ✅ Done | [AcksDurabilityDemo.tsx](src/components/demos/AcksDurabilityDemo.tsx) — one demo covers both activities, since the interesting behavior only shows up when a leader crash is combined with an acks setting. Verified live: acks=1 + crash → "acknowledged — data lost"; acks=all + crash → "not acknowledged — outcome unknown" (the record actually survives on both followers — verified via the broker panel — but the producer can't tell that from a timeout); acks=0 never shows "acknowledged" at all, success or failure. |
| Activity: introduce latency and measure batching/throughput | ✅ Done | [BatchingThroughputDemo.tsx](src/components/demos/BatchingThroughputDemo.tsx) — a fixed 10-record arrival sequence, linger.ms/batch.size pickers, batches computed deterministically (flush on size or linger, whichever first). Verified live: default (linger=5, size=5) → 4 simulated batch flushes, 3.4ms avg added latency; linger=100 → 2 flushes but one record waits 82ms for the batch to fill. Output is labeled "simulated batch flushes," not requests. |
| Activity: fill the producer buffer + trigger record-size/delivery-timeout failures | ✅ Done | [BufferAndTimeoutDemo.tsx](src/components/demos/BufferAndTimeoutDemo.tsx) — one demo, three scenario tabs (buffer/oversize/timeout), since all three are producer-side limits with the same shape (synchronous rejection vs. blocking vs. delayed timeout). Verified live: 6th produce into a 5-slot buffer blocks send(); draining while blocked resolves it immediately; waiting past max.block.ms throws; an oversized record is rejected synchronously regardless of buffer state; 4 retry attempts (4×30000ms) exhaust the 120000ms delivery.timeout.ms budget exactly. |
| Activity: send duplicates with and without idempotence | ✅ Done | [IdempotenceDemo.tsx](src/components/demos/IdempotenceDemo.tsx) — produce leaves the outcome unresolved until the user picks "ack received normally" or "ack lost in transit" (ground truth: the write already landed either way); idempotent retry after a lost ack is discarded, non-idempotent retry appends a genuine duplicate with no sequence number shown at all. Toggling the setting recreates the simulated producer's identity (sequence numbers restart at 0), since enable.idempotence can't change on a live producer — existing broker entries are untouched by the toggle, only producer-scoped state resets. |

**Tests**: 28 new tests across the four demo test files (53 total in the suite, up from
25), following Module 1's pattern — `data-testid` for structural containers, exact-string
assertions on log/outcome text, one test per distinct behavior branch. All passing, plus
`typecheck`, `lint`, and `next build` clean.

**Review findings addressed** (6 findings from a review of the merged PR; all reproduced
against real Kafka semantics — not just patched from the descriptions — and re-verified
live):

| Finding | Status | Fix |
|---|---|---|
| acks=0 shown as "acknowledged" (it requests no acknowledgment at all) | ✅ Done | Replaced the shared `{acked, dataSafe}` model with a 5-way `OutcomeKind` discriminated union so acks=0 can never render the word "acknowledged" — success is "acknowledgment not requested — delivery unknown," failure is "producer considered sent — record lost." |
| acks=all's crash outcome implied certainty ("safe to retry") that a real timeout doesn't have | ✅ Done | Re-modeled the acks=all crash case as the leader replicating to both followers (ground truth: safe) but crashing before its ack reaches the producer — badge now reads "not acknowledged — outcome unknown," with the broker panel showing the record actually survived. Log text explicitly states that `enable.idempotence=true` is what makes retrying that ambiguous outcome safe. |
| Batching demo equated "batch" with "request" and called linger.ms=0 "no batching" | ✅ Done | Output relabeled "simulated batch flushes" throughout (not requests); dropped the "vs. N requests with no batching" comparison entirely; disclaimer now states linger.ms=0 disables intentional waiting, not batching itself, and that one real produce request can carry batches for multiple partitions. |
| Idempotence demo logged "ack received" then later claimed that same ack was lost; allowed toggling/retrying across an impossible producer identity; showed sequence numbers on non-idempotent sends; said the broker issues sequence numbers | ✅ Done | Rebuilt as a 3-phase flow: send leaves the outcome *unresolved* until the user picks "ack received normally" or "ack lost in transit" (which appends the ground-truth write immediately and only *then* offers "producer retries"). Toggling `enable.idempotence` resets producer-scoped state (new identity, sequence numbers restart at 0) — see the round-2 fix below for a correction to this. `LogEntry.seq` is `number \| null` — non-idempotent entries render with no sequence number at all, not an unused one. Disclaimer corrected: the broker issues the producer ID; the producer itself assigns the per-partition sequence number. |
| `transaction.timeout.ms` marked `safe`; wrong exception on timeout; timeout clock said to start at `beginTransaction()` | ✅ Done | Risk changed to `caution`. `controls`/`reliabilityImpact` now say the clock starts when the first partition is added, not at `beginTransaction()`. `failureModes` corrected to `InvalidTxnTimeoutException` on init if this exceeds the broker's `transaction.max.timeout.ms`, and a general fencing failure (not a specific exception guaranteed) on continuing a proactively-aborted transaction. Also fixed the "Use transactions" topic narrative's claim that idempotence "only guarantees exactly-once writes to a single partition" — it dedupes independently *per partition*, across as many partitions as the producer writes to; transactions add cross-partition atomicity, not multi-partition support itself. |
| PLAN.md stale counts (said 8 new configs, not 9; said 25 tests across 4 files, not 53 across 8) | ✅ Done | Corrected both counts in this file. |

**Review findings addressed (round 2)** (3 findings from a follow-up review of the same
PR; all reproduced and re-verified live):

| Finding | Status | Fix |
|---|---|---|
| Toggling `enable.idempotence` cleared `entries` — the simulated broker partition log, not producer state. Recreating a producer resets its own identity; it doesn't delete records the broker already has | ✅ Done | `toggleIdempotent` now resets only `nextSeq` and `pending`; `entries` persists across the toggle. Verified live: a record written before toggling is still present after, and the newly "recreated" producer's next send appends alongside it rather than replacing it. Test updated to assert persistence instead of clearing. |
| "Improve batching" topic narrative still said every produce request is per-partition and a batch is sent as one request, contradicting the demo's own (already-corrected) disclaimer | ✅ Done | Reworded to explain batch accumulation (per partition) and request bundling (one request can carry batches for multiple partitions on the same broker) as two separate things, plus the linger.ms=0 clarification (records arriving together can still batch; only intentional waiting is disabled). |
| PLAN.md's Verification section still said "25/25 passing" after the suite grew to 53 tests | ✅ Done | Corrected to 53/53. |

## Module 4 — Consumer configuration

Built to the same bar as Module 3: real lesson prose for all 7 topics (not a bullet
outline) plus one interactive demo per listed activity (6 demos). `Module.status` is now
`"available"` and [page.tsx](src/app/modules/%5Bslug%5D/page.tsx) renders the six demos
below the topic narrative.

| Item | Status | Notes |
|---|---|---|
| Topic narrative (all 7 topics) | ✅ Done | Written into `modules.ts`'s `consumer-configuration` entry (`topicNarrative`). Covers group assignment and the partition-count ceiling, the two separate liveness clocks (heartbeat vs. max.poll.interval.ms), committed offset vs. read position, eager vs. cooperative rebalance cost, static membership's failure-detection tradeoff, the cooperative-assignor migration, poison-message handling, and — from the round-2 review — the classic vs. new (KIP-848) group protocol distinction woven through the assignment, polling, and rebalance topics. Verified rendering in-browser. |
| New config entries (10) | ✅ Done | [configs.ts](src/lib/data/configs.ts) gained `group.id`, `partition.assignment.strategy`, `group.instance.id`, `heartbeat.interval.ms`, `max.poll.records`, `enable.auto.commit`, `auto.commit.interval.ms`, `isolation.level`, `fetch.max.bytes`, `group.protocol` — closing dangling `relatedConfigs` references (`group.id`, `group.instance.id`, `heartbeat.interval.ms`, `max.poll.records`, `enable.auto.commit`, `fetch.max.bytes`) plus topical ones (`group.protocol` and the classic-only qualifiers came out of the PR review). Three new goal categories ("Consumer group scaling", "Read transactional data", "Tune consumer fetching"). Verified in Config Explorer: 31 entries on Kafka 4.0 (30 on 3.5, where `group.protocol` is hidden), new categories populate the filter. |
| Activity: make processing exceed max.poll.interval.ms | ✅ Done | [PollIntervalDemo.tsx](src/components/demos/PollIntervalDemo.tsx) — max.poll.records × per-record processing time vs. a (scaled 1000ms) interval budget; shows the healthy poll loop vs. the rebalance loop, and that raising the interval or lowering max.poll.records both fix it. |
| Activity: add and remove consumer instances | ✅ Done | [ConsumerGroupScalingDemo.tsx](src/components/demos/ConsumerGroupScalingDemo.tsx) — 6 partitions, 1–8 consumers, contiguous RangeAssignor-style assignment, rebalance log on every join/leave, a 7th+ consumer shown explicitly idle. |
| Activity: compare automatic and manual commits | ✅ Done | [CommitStrategyDemo.tsx](src/components/demos/CommitStrategyDemo.tsx) — a loop clock plus auto.commit.interval.ms: auto-commit fires only when the interval has elapsed since the last commit, so fast polls (picker: 1000/2000/6000 ms per poll) trail several batches and slow polls keep to one. Polling continues past the end of the partition so the final position can commit on a later empty poll(). The read-vs-committed gap is labeled "redelivered on crash now" (mostly-but-not-all duplicates). Manual commitSync() advances the offset exactly when called. |
| Activity: crash a consumer before and after committing | ✅ Done | [CommitCrashDemo.tsx](src/components/demos/CommitCrashDemo.tsx) — one batch of 3, explicit ordering of "commit offset 3" and "crash consumer," plus a commit-before-processing toggle whose policy the buttons enforce. Tracks processed vs. committed separately: a partial crash reports duplicates (already processed) vs. first-time deliveries, not a blanket "reprocessed." Commit-before-processing + crash → skipped records (at-most-once); commit-after-processing + clean crash → clean handoff. New owner always resumes from the committed offset. |
| Activity: reset offsets and replay data | ✅ Done | [OffsetResetDemo.tsx](src/components/demos/OffsetResetDemo.tsx) — a 12-record log with committed offset 8; `--to-earliest` / `--to-latest` / `--to-offset` / `--shift-by` buttons. Per-offset `consumed / replay / pending / skipped` status derived from a persistent consumption history and the movable bookmark: a backward reset marks previously-consumed records `replay` (not "new"), a forward reset marks jumped-over records `skipped` (reversible by a later reset). Disclaimer notes the CLI refuses to run against an active group and needs `--execute`. |
| Activity: process a poison message using retry and dead-letter topics | ✅ Done | [PoisonMessageDemo.tsx](src/components/demos/PoisonMessageDemo.tsx) — offset 2 is poison; all three strategies assume a seek-back error handler. Tabs: "unbounded retry" (seek back forever, partition stuck, lag grows), "dead-letter topic" (bounded in-place retries → produce to `orders.DLT` → commit past), "retry topics" (forward to `orders.retry.5s`, escalating to `.30s` then DLT). |

**Tests**: 34 new tests (six Module 4 demo test files plus `configs.test.ts` for config
version gating), bringing the suite to 87 (up from 53). Follows the Module 1/3 pattern —
`data-testid` for structural containers, exact-string assertions on log/outcome text, one
test per distinct behavior branch. All passing, plus `typecheck`, `lint`, and `next build`
clean.

**Review findings addressed** (8 findings from a review of PR #4; all reproduced against
real Kafka 4.0 consumer semantics and re-verified live):

| Finding | Status | Fix |
|---|---|---|
| Poison records aren't auto-returned by the next `poll()` — redelivery needs a `seek()`, a framework error handler, or a crash/rebalance | ✅ Done | `PoisonMessageDemo`'s seek-back strategy log now states the error handler seeks back to the failed offset (Spring Kafka's default); disclaimer explains poll() has already advanced the in-memory position, so a raw exception skips the record rather than retrying it. "Poison messages" narrative rewritten as a two-step failure: raw propagation skips, then a rebalance/restart/seek brings it back and it stays stuck. (Round 2 renamed that strategy tab from "no handling" to "unbounded retry".) |
| `CooperativeStickyAssignor` is not the effective default — the default list is headed by `RangeAssignor` | ✅ Done | "Cooperative assignment" narrative no longer calls it "the default in modern Kafka"; adds an explicit "It is not automatically active" paragraph (first common assignor wins = RangeAssignor). `partition.assignment.strategy` config `controls`/`whenToChange`/`performanceImpact` corrected to say the same. |
| Kafka 4's new consumer group protocol (KIP-848) is missing | ✅ Done | Added `group.protocol` config entry (classic vs. consumer, server-side assignment, `group.remote.assignor`). "Polling and heartbeats", "Rebalance behavior", and "Cooperative assignment" narratives each gained a paragraph on the new protocol. `session.timeout.ms`, `heartbeat.interval.ms`, `partition.assignment.strategy` now flagged "classic group protocol only" and noted as ignored under `group.protocol=consumer`. |
| Partial crashes counted every redelivered record as "reprocessed" | ✅ Done | `CommitCrashDemo` now tracks processed vs. committed separately: `redelivered = BATCH − committed`, `duplicates = max(0, processed − committed)`, first-time = the rest. Processing 1 of 3 then crashing reports "1 duplicate, 2 never processed before." Subtitle and badge reworded (redelivered ≠ reprocessed). |
| Auto-commit modeled as always exactly one batch behind | ✅ Done | `CommitStrategyDemo` rebuilt with a loop clock and `auto.commit.interval.ms` (5000ms): auto-commit fires only when the interval has elapsed since the last commit, so fast polls trail several batches and slow polls (`6000ms/poll` picker) keep to one. The read−committed metric relabeled "redelivered on crash now," subtitle notes those are mostly-but-not-all duplicates. |
| Commit-order policy selector wasn't enforced | ✅ Done | `CommitCrashDemo` now disables "commit offset 3" until all records are processed in "after" mode, and disables "process one record" until the commit has happened in "before" mode. |
| Forward offset resets described as permanent; skipped offsets rendered as "consumed" | ✅ Done | `OffsetResetDemo` tracks per-offset status with a legend. A forward reset marks jumped-over records `skipped`, not `consumed`; a later backward reset picks them back up. Log and disclaimer say "another reset can always move the bookmark back." (Round 2 added a persistent consumption history so backward resets over already-consumed records show as `replay`, not `pending`.) |
| `fetch.max.bytes` was a dangling `relatedConfigs` reference | ✅ Done | Added a `fetch.max.bytes` `ConfigEntry` (new "Tune consumer fetching" goal). (Round 2: corrected the default to 50 MiB and the soft-limit wording — if the first record batch in the first non-empty partition exceeds it, that batch is still returned so the consumer can progress.) |

**Review findings addressed (round 2)** (8 more findings from a follow-up review; all
re-verified live):

| Finding | Status | Fix |
|---|---|---|
| Auto-commit could never commit the final batch — polling was disabled once all records were read | ✅ Done | `CommitStrategyDemo` `poll()` now keeps running past the end of the partition in auto mode (empty polls that only run the auto-commit check and advance the clock) until `committed` reaches `read`; the poll button disables only then. Subtitle tells the reader to keep clicking past the end. New test covers it. |
| `fetch.max.bytes` default was wrong (55 MiB) and the soft-limit exception was described as a single record | ✅ Done | Corrected to `52428800` (50 MiB). The soft-limit wording now says the *first record batch* in the first non-empty partition, not an individual record. |
| Assignment described as leader-computed without qualification | ✅ Done | "Consumer groups and partition assignment" narrative now splits it: classic protocol → coordinator picks a leader that computes the assignment; `group.protocol=consumer` → the broker computes it, no leader. |
| Cooperative migration always described as two rolling bounces | ✅ Done | "Cooperative assignment" narrative and `partition.assignment.strategy` config corrected: from the default `[RangeAssignor, CooperativeStickyAssignor]` list it's a single bounce removing RangeAssignor; two bounces only when migrating from an eager-only assignor. |
| `group.protocol` shown in the Config Explorer for Kafka 3.5/3.7/3.9 | ✅ Done | Added `availableFromVersion?` and `earlyAccessUntilVersion?` to `ConfigEntry` plus `versionAtLeast` / `configAvailable` / `configIsEarlyAccess` helpers in `types.ts`. The Config Explorer hides entries below `availableFromVersion` and shows an "early access in Kafka N" badge + expanded warning for versions in the `[availableFromVersion, earlyAccessUntilVersion)` window. `group.protocol` is `availableFromVersion: "3.7"`, `earlyAccessUntilVersion: "4.0"` — hidden on 3.5, flagged early access on 3.7/3.9, normal on 4.0. (Round 3 correction: it was briefly gated to 4.0 only.) |
| Offset-reset status lost consumption history — a backward reset relabeled previously-consumed records "not yet consumed" | ✅ Done | `OffsetResetDemo` rebuilt around a persistent `everConsumed[]` history plus the movable bookmark; status is derived as `consumed / replay / pending / skipped`. A backward reset over consumed records shows them as `replay`, and the count line separates "replayed" from "new." |
| Poison strategy mislabeled "no handling" — it models an explicit seek-back retry handler | ✅ Done | Tab renamed "unbounded retry"; disclaimer states all three strategies assume a seek-back handler and that this one is Spring Kafka's original default (seek back on every failure, no limit, no routing). |
| PLAN.md still described auto-commit as "one batch behind" and the poison strategy as "no handling" | ✅ Done | Updated the Module 4 activity rows above to match the reworked demos. |

## Module 5 — Broker and topic configuration

Topic explorer content for all 11 topics landed in PR #9 (`status: "available"`, 4 content-review
rounds on the Kafka accuracy — acks/ISR, replication amplification, KRaft quorum, SCRAM, log
cleaner). PR #10 added the interactive demos, wired into
[page.tsx](src/app/modules/%5Bslug%5D/page.tsx) under `mod.slug === "broker-topic-configuration"`.

| Item | Status | Notes |
|---|---|---|
| Activity: shrink the ISR below min.insync.replicas | ✅ Done | [ReplicationFloorDemo.tsx](src/components/demos/ReplicationFloorDemo.tsx) — one partition, RF 3, a min.insync.replicas picker; stop/start brokers to shrink the ISR and watch acks=all flip between "durable" and NOT_ENOUGH_REPLICAS while acks=1 keeps working off the leader. Leader election on leader loss; a restarted broker replicates the backlog before rejoining the ISR and never reclaims leadership; after a full outage only a last-ISR replica can lead without `unclean.leader.election.enable` (a separately labelled, danger-styled action). |
| Activity: compare delete and compact cleanup | ✅ Done | [RetentionCompactionDemo.tsx](src/components/demos/RetentionCompactionDemo.tsx) — a keyed partition log; toggle `cleanup.policy` between `delete` (whole closed segments age out, blind to keys) and `compact` (latest value per key survives; a tombstone propagates a delete then expires on the next pass). Shows what a full replay reads. |
| Activity: spread replicas across racks, then fail a rack | ✅ Done | [RackPlacementDemo.tsx](src/components/demos/RackPlacementDemo.tsx) — six brokers across three racks, RF 3, a rack-C consumer. `broker.rack` on = one replica per rack, survives any single rack failure; off = two replicas stack in one rack, losing it drops below the floor. Rack-aware fetching needs `replica.selector.class` AND `client.rack`, and only helps with an in-sync replica in the consumer's rack. Changing `broker.rack` doesn't move an existing partition — a reassignment does. |
| Activity: push a client past its byte-rate quota | ✅ Done | [QuotaThrottleDemo.tsx](src/components/demos/QuotaThrottleDemo.tsx) — `producer_byte_rate` and `request_percentage` tabs; push a client over quota and watch throughput cap, throttle latency rise, and errors stay at zero. A throttle pause longer than `request.timeout.ms` makes each attempt time out and retry — `delivery.timeout.ms` is the final verdict. |

**Tests**: 20 new tests (four demo test files), bringing the suite to 114. **Review**: PR #10 went
through five review rounds (commits `3bc11ff`, `ab53633`, `3224c37`, `3de651f`, `b7ce8bf`) —
demo election safety, ISR-membership-needs-a-leader, and the late `unclean.leader.election.enable`
toggle path.

## Module 6 — Observability

Topic explorer content for all 11 signals landed in PR #9 alongside Module 5. This module's demos
are wired into [page.tsx](src/app/modules/%5Bslug%5D/page.tsx) under `mod.slug === "observability"`.
The module lists one scoped activity (the unlabeled-dashboard bottleneck game); the demo set was
built out to four to match Module 5's depth, and the `activities` list in `modules.ts` was expanded
to name all four.

| Item | Status | Notes |
|---|---|---|
| Activity: read an unlabeled dashboard, name the bottleneck | ✅ Done | [BottleneckDiagnosis.tsx](src/components/demos/BottleneckDiagnosis.tsx) — six deterministic dashboards, each a still snapshot of nine signals (produce p99, producer buffer/retry, consumer lag, poll processing vs. `max.poll.interval.ms`, request-queue/handler-idle, Local/RemoteTimeMs, disk await/free, network vs. line rate, downstream call latency) with the SLA breach flagged. Pick one of six causes (producer / broker / consumer / disk / network / downstream); a wrong pick explains that cause's real signature. The consumer-vs-downstream pair is deliberately near-identical except the sink-call panel. The producer dashboard shows a *near-empty* send buffer (the app isn't feeding `send()`) — a full buffer would point at the sender thread / network / a throttle instead. |
| Activity: split a request-latency total into its phases | ✅ Done | [RequestLatencyBreakdown.tsx](src/components/demos/RequestLatencyBreakdown.tsx) — a pure function of four toggles (acks=all, one slow follower, slow disk, too few I/O threads) over the five TotalTimeMs phases. A phase is called "dominant" only at ≥50% of a total that is itself elevated; the slow-follower toggle is disabled (and has no effect) unless acks=all is on. Diagnosis text maps each dominant phase to its cause (queue → `num.io.threads`, local → disk, remote → slow follower). Disclaimer notes a fetch's RemoteTimeMs is the benign long-poll wait. |
| Activity: runaway lag slope vs. flat-but-breaching backlog | ✅ Done | [LagSlopeVsAbsolute.tsx](src/components/demos/LagSlopeVsAbsolute.tsx) — three partitions, one consumer each at a fixed 120 rec/s ceiling (consume = min(produce, ceiling), so a group that keeps pace holds a steady backlog rather than draining it). Partition 2 starts at 2,000 lag → flat slope, still past a 15s time-lag SLA. Time lag is a constant-rate estimate (lag ÷ produce rate), so the rate is **locked once the clock starts** — changing it mid-run would rewrite the age of existing records. A "partition 0 stuck (unbounded retry on a bad record)" toggle makes p0 run away while the healthy partitions sit flat; the disclaimer notes a raw exception would skip the record instead (as in Module 4). Combined with an over-ceiling rate, the verdict calls out **two distinct slopes** (p0 at the full produce rate, p1/p2 at produce − ceiling). Enough steps push a stuck partition past the ~6,000-record retention window → data-loss verdict that also notes `auto.offset.reset` resumes consumption automatically. Producing over the ceiling climbs every partition — verdict says adding consumers can't help (can't split a partition); raise per-partition throughput or add partitions + consumers. |
| Activity: localize ISR churn | ✅ Done | [IsrChurnDemo.tsx](src/components/demos/IsrChurnDemo.tsx) — four brokers, a fixed partition layout, a hand-stepped one-minute clock. The core lesson: `IsrShrinks`/`IsrExpands` are **leader-side** meters, so a slow follower lights up its *leaders'* counters — the demo shows the per-broker `IsrShrinks Count` next to a separate "replica removed from the ISR" tally, labelled as a **derived signal** (ISR-snapshot diffs / shrink log lines), not a live partition field. Scenarios: `healthy` (one first-minute blip, then quiet — not an incident), `one slow broker` (meters fire on the leaders of broker-3's partitions, but broker-3 is the replica removed every time → localized), `saturated fabric` (removed replica spread across the cluster → shared cause). A `min.insync.replicas=2` toggle surfaces the "a shrink drops the ISR to the floor; a second lagging replica drops it to 1 and rejects the write with NOT_ENOUGH_REPLICAS" warning. |

**Tests**: 27 new tests (four demo test files) with the standard pattern — unique `data-testid`
on structural containers, exact-string assertions on verdict/feedback text, one test per distinct
behaviour branch — bringing the suite to 148. `typecheck`, `lint`, and `next build` clean; demos
verified rendering and interacting in-browser.

**Review findings addressed (round 1)** (six Kafka-accuracy findings from a review of PR #11):

| Finding | Status | Fix |
|---|---|---|
| [P1] ISR churn attributed to the wrong broker — `IsrShrinksPerSec`/`IsrExpandsPerSec` are incremented by the partition *leader*, not the follower that lagged | ✅ Done | `IsrChurnDemo` reworked around a fixed leader/follower topology. Per-broker `IsrShrinks Count` is now leader-attributed; a separate "replica removed from the ISR" tally is the localizing signal. The "one slow broker" verdict explicitly says the meters fire on the leaders and the removed replica is the tell. |
| [P1] Producer diagnosis contradicted `buffer-available-bytes` — a near-zero buffer is *full*, not the signature of synchronous `send().get()` / too few threads | ✅ Done | `BottleneckDiagnosis` dashboard 4 now shows an 89%-free send buffer; the explain text and the `producer` signature string both key off a near-empty buffer + idle broker, and note a near-full buffer points at the sender thread / network / a throttle. |
| [P1] The produce-rate slider retroactively rewrote the age of existing records (`time lag = lag ÷ current rate`) | ✅ Done | `LagSlopeVsAbsolute` locks the produce-rate slider once `step > 0` ("reset to change"), and the disclaimer frames time lag as a constant-rate estimate. |
| [P1] A poison record doesn't inherently stop a raw Kafka partition — that needs an unbounded seek/retry handler | ✅ Done | `LagSlopeVsAbsolute`'s toggle relabelled "partition 0 stuck (unbounded retry on a bad record)"; disclaimer and verdict say a raw exception would skip the record and move on, consistent with Module 4. |
| [P1] "Add consumers" can't fix the modelled under-provisioning — every partition already has its own consumer at the ceiling | ✅ Done | `LagSlopeVsAbsolute`'s over-ceiling verdict now says adding consumers can't split a partition; recommends raising per-partition throughput or adding partitions and consumers together. |
| [P2] Manual offset reset described as the only recovery path after records age out — `auto.offset.reset` also resumes consumption (`earliest`/`latest`/duration, or throws with `none`) | ✅ Done | `LagSlopeVsAbsolute`'s retention verdict now notes `auto.offset.reset` moves the group on its own (or throws with `none`); the skipped records are still unrecoverable. |
| Nit: `IsrShrinksPerSec (cumulative)` conflated a per-second meter with a running count | ✅ Done | Relabelled to `IsrShrinks Count` (the meter's actual cumulative `Count`), per-broker and aggregate. |

**Review findings addressed (round 2)** (3 findings from a follow-up review of PR #11):

| Finding | Status | Fix |
|---|---|---|
| [P1] Combined lag controls gave a false diagnosis — with "stuck retrying" on *and* produce over the ceiling, p0 grows at the full produce rate while p1/p2 grow by `produce − ceiling`, but the `overCap` verdict still claimed a uniform slope | ✅ Done | Added a dedicated `stuck && overCap` branch to `LagSlopeVsAbsolute`: the verdict names the two different slopes and says fixing one problem doesn't touch the other. Regression test covers p0 at 1,600 / p1 at 400 after one 10s step at 160 rec/s. |
| [P2] The removed-replica tally read as directly observable — Kafka exposes only the *current* ISR; `kafka-topics --describe` after a replica rejoins shows a full ISR and can't reconstruct the removal | ✅ Done | `IsrChurnDemo`'s section header, disclaimer, and source comment now label it a derived signal: diff frequent ISR snapshots, or parse the controller/broker shrink log lines. |
| [P2] The consumer diagnosis assumed dynamic membership — exceeding `max.poll.interval.ms` doesn't immediately reassign a *static* member's partitions; they hold until the session timeout | ✅ Done | `BottleneckDiagnosis` dashboard 5's explain now splits the two paths (dynamic member dropped and rebalancing every cycle vs. static member holding its partitions to the session timeout), consistent with Module 4; either way the consumer isn't polling. |

## Module 7 — Troubleshooting scenarios

Module 7's plan describes it as "a searchable symptom → evidence → cause → resolution
catalog" — which is exactly what the standalone [/troubleshooting](src/app/troubleshooting/page.tsx)
page already was, in skeleton form. Rather than duplicate that content as module prose, PR
#12 **enriched the shared catalog** and pointed the module page at it, so both surfaces
improve together and there's one source of truth.

| Item | Status | Notes |
|---|---|---|
| `TroubleshootingEntry` enriched | ✅ Done | [types.ts](src/lib/types.ts) — each cause is now a `{ cause, evidence }` pair (the specific metric, log line, or command output that confirms or rules it out, not "check the logs"), plus an `overview` framing sentence, optional `keyConfigs` chips, and a `watchOut` — the durability setting you could lower to make the error vanish while making the system worse. |
| All 10 entries written to full depth | ✅ Done | [troubleshooting.ts](src/lib/data/troubleshooting.ts) — consumer lag, frequent rebalances, NOT_ENOUGH_REPLICAS (incl. the before-append vs. `_AFTER_APPEND` distinction), under-replicated partitions (incl. the stale-replication-throttle cause), timeout errors (each timeout named by its config + exception), disk usage growth, large-message failures (the four independent size limits), hot partitions, data/duplicates/ordering (three separate diagnostic paths), connectivity/auth (bootstrap vs. after-bootstrap split). |
| `TroubleshootingCatalog` component | ✅ Done | [TroubleshootingCatalog.tsx](src/components/TroubleshootingCatalog.tsx) — renders the overview, cause→evidence pairs, resolution flow, monospace config chips, and the watch-out callout (styled like the Topic explorer's). Search now matches symptom, overview, cause, evidence, and config-key text. `data-testid` on the container and each entry row. |
| Module 7 page | ✅ Done | [page.tsx](src/app/modules/%5Bslug%5D/page.tsx) — `mod.slug === "troubleshooting-scenarios"` renders a short orientation paragraph + the embedded `<TroubleshootingCatalog />` instead of the bullet-outline fallback. `Module.status` flipped `planned` → `available`. `activities` stays empty by design — the catalog is the interaction. |
| Tests | ✅ Done | `troubleshooting.test.ts` (data shape: 10 entries, unique slugs, every cause has evidence, slug lookup, the NOT_ENOUGH_REPLICAS "repair the follower first" ordering, large-message fetch-limit framing, retention.bytes per-partition) + `TroubleshootingCatalog.test.tsx` (default-open first entry, toggle, evidence + chip rendering, filter by symptom/cause/evidence/resolution/config/watch-out, no-match state). Suite 148 → 161. |

**Review findings addressed (round 1)** (PR #12):

| Finding | Status | Fix |
|---|---|---|
| Large-message guidance was wrong for Kafka 4.0 — replica and modern consumer fetch limits are *soft* (an over-sized first batch is returned to guarantee progress), so they don't wedge the ISR or stall consumers; only producer / broker / topic admission limits reject the batch | ✅ Done | `large-message-failures` rewritten around exactly three admission limits (`max.request.size`, `message.max.bytes`, `max.message.bytes`). The former "replica fetch limit" / "consumer fetch limits" causes are replaced by one "Not the fetch limits" entry that states they are soft and to rule them out as a hard failure. `replica.fetch.max.bytes` dropped from `keyConfigs`; resolution flow no longer tells you to line up four limits. |
| `retention.bytes` described as a topic-wide cap — Kafka enforces it per partition (topic size ≈ `retention.bytes` × partitions × RF) | ✅ Done | `disk-usage-growth` cause evidence and resolution step 1 corrected. (This misconception also appeared in PR #14's runbooks — fixed there too.) |
| `watchOut` was rendered but not searchable, contradicting the stated enrichment | ✅ Done | `TroubleshootingCatalog` filter now also matches `resolutionFlow` steps and `watchOut` text (both are rendered content). Module 7 intro and a new test updated to match. |

## Incident simulator — the remaining 9 scenarios

The "slow broker" incident was the only one built out; the other 9 rendered a "planned"
stub listing their scoped clue categories. This PR builds all 9 to the same shape as slow
broker: a concrete `investigation` — three clues with real evidence, and three candidate
root causes (one correct, two plausible-but-wrong, each with feedback that explains the
right answer or what the wrong cause's real signature would look like).

| Item | Status | Notes |
|---|---|---|
| `Incident` type | ✅ Done | [types.ts](src/lib/types.ts) gained `IncidentClue`, `IncidentDiagnosisOption`, and an optional `Incident.investigation` (`{ clues, options }`). `IncidentDiagnosis.tsx` now imports those shared types instead of redefining them locally. |
| Clue + diagnosis data moved into `incidents.ts` | ✅ Done | The slow-broker clue/option constants were hardcoded in the page; they and the 9 new scenarios now live in [incidents.ts](src/lib/data/incidents.ts). The `[slug]` page just reads `incident.investigation`. |
| 9 scenarios written | ✅ Done | full-broker-disk (traffic + time-only retention → full disk → offline log dir), bad-advertised-listener (bootstrap OK, per-broker names NXDOMAIN from a new region), poison-message (unbounded seek-back on a deserialization failure, frozen committed offset), rebalance-storm (no static membership + eager RangeAssignor → 2 rebalances per pod × 12), hot-partition (one merchant = 55% of traffic, one consumer at 100% CPU), replica-out-of-isr (oversized 24 GB heap → multi-second GC pauses → replica ages past `replica.lag.time.max.ms`), compaction-not-reclaiming (broker-3's only `log.cleaner` thread OOMed 9 days ago), producer-timeouts-unavailable-partition (RF 2, both replicas in the same maintenance window, unclean election off), tls-certificate-expiration (broker keystore cert expired at 00:00 UTC, inter-broker PLAINTEXT listener unaffected). |
| `[slug]` page | ✅ Done | [page.tsx](src/app/incident-simulator/%5Bslug%5D/page.tsx) renders `IncidentDiagnosis` + a "scored on" panel when `investigation` is present, and keeps the "planned" stub as the fallback for any future un-built incident. All 10 are now `status: "available"`. |
| Tests | ✅ Done | `incidents.test.ts` (10 unique slugs, every incident built + available, each investigation has evidence-bearing clues and exactly one correct option, clue labels map to a scoped category, compaction-failure is broker-scoped) + `IncidentDiagnosis.test.tsx` (clue reveal, correct/wrong feedback, "N of M clues checked", option lock + reset). Adds 10 tests (161 → 171). |

**Review findings addressed (round 1)** (PR #13):

| Finding | Status | Fix |
|---|---|---|
| `compaction-not-reclaiming` presented a dead cleaner thread as cluster-wide — `log.cleaner.threads` creates cleaner workers *on each broker*, so losing the only cleaner on one broker stops cleaning *that broker's local replicas*, not every compacted topic across the cluster | ✅ Done | Reworked the scenario around broker-3: briefing, symptoms, and all three clues now localize the growth to one broker; the correct-option feedback states `log.cleaner.threads` is per broker and that every other broker keeps compacting the same partitions normally. The two wrong options now also lean on the "one broker, not all" distinction. |

## Production operations runbooks

The 14 runbooks were slug + category stubs with empty `steps` and a "planned" badge on the
index. This PR writes all 14 to full content and gives each its own page.

| Item | Status | Notes |
|---|---|---|
| `Runbook` type | ✅ Done | [types.ts](src/lib/types.ts) gained `summary` (what the procedure achieves and the risk it manages) and `when` (the trigger that leads you here). `steps` is unchanged — `prechecks` / `execution` / `validation` / `rollback` / `escalation`. |
| All 14 runbooks written | ✅ Done | [runbooks.ts](src/lib/data/runbooks.ts) — topic creation review, increasing partitions, adding/removing brokers, partition reassignment, rolling app deployments, rolling broker restarts, certificate/credential rotation, capacity planning, backup & DR, cluster migration, Kafka upgrades, consumer offset recovery, handling a full disk, handling broker/AZ failures. KRaft-era throughout (controller quorum, `kafka-features.sh` metadata-version bump, no ZooKeeper). Each section is 3–6 concrete steps with the real commands and metric names. `getRunbook(slug)` helper added. |
| `/runbooks/[slug]` detail route | ✅ Done | [page.tsx](src/app/runbooks/%5Bslug%5D/page.tsx) — `generateStaticParams` over all 14; renders the summary, a "when to use this" callout, and the five step sections each behind a colour-coded `Badge` (prechecks/execution/validation → accent/stream/success, rollback → neutral, escalation → danger). Mirrors the async-`params` pattern from `incident-simulator/[slug]` and `modules/[slug]`. |
| Index page | ✅ Done | [runbooks/page.tsx](src/app/runbooks/page.tsx) — category-grouped cards are now links to the detail pages and show the `summary`; the "planned" badge and the "ready to write" description are gone. |
| Tests | ✅ Done | `runbooks.test.ts` — 14 unique slugs, every runbook has a summary/when/category and all five step sections non-empty, slugs are url-safe and resolve via `getRunbook`, categories from the known set, retention.bytes framed per-partition, no cross-partition compaction claim. Adds 7 tests (171 → 178). |

**Review findings addressed (round 1)** (PR #14):

| Finding | Status | Fix |
|---|---|---|
| "Increasing partitions" claimed compaction would eventually remove a key's stale value from its old partition — compaction operates independently *within* each partition, so under compact-only cleanup the old value stays there indefinitely unless a newer record or a tombstone is written to that same partition | ✅ Done | The execution step now states compaction is per-partition and the stale copy persists forever on a compact-only topic without a tombstone; `cleanup.policy=delete` (or `delete,compact`) ages it out with retention. The ordering-impact precheck reworded to match (brief with time/size retention, indefinite compact-only). |
| `retention.bytes` described as a topic-wide cap — Kafka enforces it per partition; topic footprint ≈ `retention.bytes` × partitions × replication factor | ✅ Done | Corrected in all four runbooks that reference it as a sizing limit: topic-creation review, capacity planning, handling a full disk (validation), and the precheck wording. |

## Test infrastructure

| Item | Status | Notes |
|---|---|---|
| Vitest + React Testing Library setup | ✅ Done | [vitest.config.mts](vitest.config.mts), [vitest.setup.ts](vitest.setup.ts), `npm test` / `npm run test:watch`. |
| Component + data tests | ✅ Done | 189 tests across 30 files. Component: 3 Module 1 demos + `Sidebar`; 4 Module 3 demos; 6 Module 4 demos; 4 Module 5 demos; 4 Module 6 demos; `TopicExplorer`, `TroubleshootingCatalog`, `IncidentDiagnosis`. Data: `configs` (version gating), `troubleshooting` (catalog shape + Kafka-accuracy asserts), `incidents` (10 built scenarios), `runbooks` (14 filled), `modules` (topicDetail shape + Module 1 accuracy asserts). |
| Dev preview config | ✅ Done | [.claude/launch.json](.claude/launch.json) for local dev-server preview. |
| Node version pinned/declared | ✅ Done | `engines.node` in `package.json` (floor set by `jsdom`), [.nvmrc](.nvmrc). |
| CI | ✅ Done | [.github/workflows/ci.yml](.github/workflows/ci.yml) — `npm run typecheck`, lint, test, build on push/PR to `main`. |

## Review findings addressed

Findings surfaced via manual code review across six passes; all fixes verified with `npm run typecheck`, `eslint`, `vitest run`, and (except where noted) live browser checks.

| Finding | File | Status | Fix |
|---|---|---|---|
| Demo teaches incorrect partitioning as if it were real Kafka behavior | RecordFlowDemo.tsx | ✅ Done | Added explicit "simplified for teaching" disclaimer; relabeled "round-robin" → "spread across partitions" to stop overclaiming real Kafka semantics. |
| Invalid version/deployment combinations selectable (Kafka 4.0 + ZooKeeper) | TopBar.tsx, ClusterContext.tsx | ✅ Done | Added `availableDeployments(version)`; ZooKeeper excluded for 4.0; context auto-corrects an now-invalid deployment on version change. |
| Config defaults not versioned (linger.ms wrong for 4.0) | configs.ts, types.ts | ✅ Done | Added `defaultValueByVersion` + `getDefaultValue()` helper; `linger.ms` now shows `5` on Kafka 4.0, `0` on earlier versions. |
| Restart skips replica catch-up (immediately in-sync, can become leader) | LeaderElectionDemo.tsx | ✅ Done | Added a `recovering` broker state; ISR admission and leader eligibility now require an explicit catch-up step. |
| Sidebar navigation disappears below `lg` breakpoint, no mobile fallback | Sidebar.tsx, layout.tsx | ✅ Done | Added mobile hamburger + slide-in drawer; fixed outer layout stacking so the mobile bar renders above content instead of beside it. |
| Config mutability model flattened to one `dynamic` boolean | ConfigExplorer.tsx, types.ts, configs.ts | ✅ Done | Replaced with explicit `ChangeMechanism` enum (`dynamic-cluster` / `topic-alter` / `recreate-client` / `broker-restart`); producer/consumer configs correctly read "recreate client" instead of borrowing broker/topic semantics. |
| `num.partitions` marked as requiring a broker restart | configs.ts | ✅ Done | Changed to `dynamic-cluster` — it only supplies a default consulted at topic-creation time. `default.replication.factor` was checked against the same question and confirmed correct as `broker-restart` — Kafka documents it as `read-only`. |
| Mobile drawer lacks modal focus management | Sidebar.tsx | ✅ Done | Added focus trap (Tab wraps within the drawer), Escape-to-close, `inert` on background content, body scroll lock, and focus restore to the trigger button on close. |
| Record controls overflow the mobile viewport | RecordFlowDemo.tsx | ✅ Done | Controls row now wraps (`flex-wrap`); produce button is full-width below `sm`, inline with `ml-auto` at `sm`+. |
| Recovery without a leader treated as a normal (clean) catch-up | LeaderElectionDemo.tsx | ✅ Done | Split into `catchUp` (only valid with a leader present) and `uncleanElect` (only valid with no leader) — the no-leader path is a separately labeled, danger-styled action with an explicit data-loss warning, not an automatic outcome of "catch up." |
| Resizing past `lg` with the mobile drawer open leaves the desktop app locked (inert background, scroll lock, trapped focus persist since the overlay is only CSS-hidden, not unmounted) | Sidebar.tsx | ✅ Done | Added a `matchMedia("(min-width: 1024px)")` listener that closes the drawer as soon as the desktop breakpoint starts matching. Regression test in `Sidebar.test.tsx` (mocked `MediaQueryList`) confirms the drawer closes and `inert`/scroll-lock/dialog are all cleared. |
| Test stack silently requires a newer Node than the project declares (`jsdom@30` needs `^22.22.2 \| ^24.15.0 \| >=26.0.0`; no `engines`, `.nvmrc`, or CI existed) | package.json | ✅ Done | Added `engines.node` (matching jsdom's floor, which subsumes Next's `>=20.9` and Vite's `^20.19 \|\| >=22.12`), `.nvmrc` pinned to the verified working version, a GitHub Actions CI workflow (`tsc`, lint, test, build), and a note in README's Getting started. |
| CI type-check fails on a clean checkout: `LayoutProps` (from `layout.tsx`) is generated by Next into `.next/types`, which only existed locally because `next build`/`next dev` had already run there | package.json, .github/workflows/ci.yml | ✅ Done | Added `"typecheck": "next typegen && tsc --noEmit"` script; CI and these docs now run that instead of bare `tsc --noEmit`. Reproduced the failure locally by deleting `.next` before `tsc --noEmit`, confirmed `next typegen` fixes it. |
| README still said Module 1 was "fully built out" with "one working interactive activity," contradicting this file | README.md | ✅ Done | Reworded to match: all four activities built, topic content still an outline. Also updated the `demos/` file listing to include `RecordFlowDemo.tsx` and `PartitionOrderingDemo.tsx`, which weren't mentioned. |

## Bonus fix (scoped in alongside the version/deployment finding)

| Item | Status | Notes |
|---|---|---|
| ConfigExplorer ignores the selected deployment context | ✅ Done | Now reads `deployment` from `ClusterContext` and surfaces the previously-unused `managedAvailability` field — banner + per-row "limited/unavailable on managed" badges when "Managed service" is selected. |

## Open questions / follow-ups

Everything the guide plan scoped is now built — this table is a closed log, no items remain open.

| Item | Status | Notes |
|---|---|---|
| Module 7 content/interactivity | ✅ Done | Enriched the shared troubleshooting catalog (per-cause evidence, key configs, watch-outs) and embedded it on the Module 7 page; `status: "available"`. See the Module 7 section above. |
| Module 3 (Producer configuration) | ✅ Done | Full topic narrative + 4 interactive activities. See the Module 3 section above. |
| Module 4 (Consumer configuration) | ✅ Done | Full topic narrative (7 topics) + 6 interactive activities. See the Module 4 section above. |
| Module 5 (Broker and topic configuration) | ✅ Done | Topic explorer content (11 topics) + 4 interactive demos. See the Module 5 section above. |
| Module 6 (Observability) | ✅ Done | Topic explorer content (11 signals) + 4 interactive demos. See the Module 6 section above. |
| Module 1's topic content | ✅ Done | All 6 topics have Topic explorer content (PR #7) plus a second accuracy review pass. See the Module 1 section above. |
| Module 2 in-app page | ✅ Done | Detail page and index card both show a "lab built" badge (new `Module.status: "external"` value) with a link out to `local-cluster-lab/` on GitHub, instead of grouping with the actually-unbuilt "planned" modules. |
| 9 remaining incident-simulator scenarios | ✅ Done | All 10 incidents now have a full `investigation` (clues + diagnosis options) and are `status: "available"`. See the Incident simulator section above. |
| 14 production runbooks | ✅ Done | All 14 written to full content (prechecks/execution/validation/rollback/escalation) with a `/runbooks/[slug]` detail page each. See the Production operations runbooks section above. |
| Local cluster lab (docker-compose, 3-broker KRaft + Kafka UI + Prometheus/Grafana) | ✅ Done | Built at [local-cluster-lab/](local-cluster-lab/) — explicitly out of scope for the Next.js app per README, a separate deliverable. See Module 2 section below for what was built and verified. |

## Verification

Every item in the guide plan is built:

- **Modules 1–7** — all have Topic explorer content (`topicDetail`) for every topic and are
  `status: "available"` (Module 2 is `"external"` — the local cluster lab). Modules 1 and
  3–6 also carry their interactive demos; Module 7 embeds the troubleshooting catalog.
- **Incident simulator** — all 10 scenarios have a full `investigation` (clues + diagnosis
  options), `status: "available"`.
- **Troubleshooting catalog** — all 10 symptom entries at full depth (overview, cause →
  evidence, resolution flow, key configs, watch-out).
- **Production runbooks** — all 14 written to full content, each with a `/runbooks/[slug]`
  page.
- **Local cluster lab** — the separate Docker Compose deliverable at `local-cluster-lab/`.

Checks (re-run on `main` after PR #15):

- `npm run typecheck` (`next typegen && tsc --noEmit`) — clean, including from a clean checkout with no `.next` directory
- `npx eslint .` — clean
- `npx vitest run` — 189/189 passing across 30 test files (25 component tests under `src/components/`, plus 5 data tests: `configs`, `troubleshooting`, `incidents`, `runbooks`, `modules`)
- `npm run build` — clean production build
- Manual browser verification (desktop + mobile viewports) for every UI-facing fix above,
  except the drawer's breakpoint-crossing close: the available browser automation tool's
  viewport resize doesn't dispatch `resize` or `matchMedia` "change" events at all (confirmed
  by direct test — `.matches` updates but no event fires), so that fix is verified by a unit
  test that fires the listener directly, plus standard `MediaQueryList` behavior in real
  browsers, rather than an end-to-end browser resize.
