# Kafka, Operationally

An interactive Kafka guide for developers, platform engineers, and SREs — built from the
guide plan: concepts, hands-on labs, configuration experiments, failure simulations, and
troubleshooting playbooks.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (CSS-first config, see `src/app/globals.css` for design tokens)
- `next/font/google`: Fraunces (display), Inter (body), JetBrains Mono (data/config)

## Getting started

Requires Node `^22.22.2 || ^24.15.0 || >=26.0.0` (the floor is set by `jsdom`, a test
dependency; see `package.json`'s `engines` field). `.nvmrc` pins the exact version this repo
is tested against — run `nvm use` if you use nvm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first `dev`/`build` run needs network access to fetch the
Google Fonts used (`fonts.googleapis.com`) — after that they're cached locally by Next.js.

## Project structure

```
src/
  app/
    page.tsx                        Dashboard / home
    modules/                        Module index + dynamic module pages (Module 0 "Why Kafka?" + the v1 core modules)
    glossary/                       Core Kafka vocabulary, linked to the modules that teach each term
    config-explorer/                Filterable configuration reference
    troubleshooting/                Symptom → evidence → cause → resolution catalog
    runbooks/                       Production operations runbook index + dynamic runbook pages
    incident-simulator/             Incident list + interactive diagnosis pages
  components/
    Sidebar.tsx, TopBar.tsx         App shell (nav + persistent version/deployment context)
    LogStrip.tsx                    Signature append-only-log motif (used in the top bar)
    LabWalkthrough.tsx             In-app hands-on lab: setup, per-step command/output/observe/recovery, persisted checkboxes; collapsible for secondary labs
    CodeWalkthrough.tsx           Guided read of a real example project: per-lesson file-labelled snippet, key-line notes, "try it" command, persisted checkbox
    demos/
      TechnologyChoiceDemo.tsx     Module 0 activity: pick Kafka / queue / DB / object store / API call per scenario
      OrderEventFanoutDemo.tsx     Module 0 activity: one order-placed event → billing, email, warehouse, analytics
      QueueVsLogDemo.tsx           Module 0 activity: queue (deliver once) vs. Kafka topic (retained, replayable)
      LabelTheEventDemo.tsx        Module 0 activity: label the key, value, timestamp, and headers of sample events
      RecordFlowDemo.tsx            Module 1 activity: producer → partition → consumer, predict-before-reveal
      PartitionOrderingDemo.tsx     Module 1 activity: partition count vs. ordering guarantees
      LeaderElectionDemo.tsx        Module 1 activity: broker failure, catch-up, and leader election
      AcksDurabilityDemo.tsx        Module 5 activity: acks=0/1/all vs. a leader crash mid-produce
      BatchingThroughputDemo.tsx    Module 5 activity: linger.ms/batch.size vs. request count and latency
      BufferAndTimeoutDemo.tsx      Module 5 activity: buffer fill, oversized records, delivery.timeout.ms
      IdempotenceDemo.tsx           Module 5 activity: duplicate sends with and without idempotence
      PollIntervalDemo.tsx          Module 6 activity: processing time vs. max.poll.interval.ms
      ConsumerGroupScalingDemo.tsx  Module 6 activity: adding/removing consumers, partition assignment, rebalances
      CommitStrategyDemo.tsx        Module 6 activity: automatic vs. manual offset commits
      CommitCrashDemo.tsx           Module 6 activity: crashing before vs. after a commit
      OffsetResetDemo.tsx           Module 6 activity: offset reset (--to-earliest/--shift-by/…) and replay
      PoisonMessageDemo.tsx         Module 6 activity: poison messages, retry topics, dead-letter topics
      ReplicationFloorDemo.tsx      Module 7 activity: shrink the ISR below min.insync.replicas
      RetentionCompactionDemo.tsx  Module 7 activity: delete vs. compact cleanup on a keyed log
      RackPlacementDemo.tsx         Module 7 activity: spread replicas across racks, then fail a rack
      QuotaThrottleDemo.tsx         Module 7 activity: a client past its byte-rate quota slows, not errors
      BottleneckDiagnosis.tsx       Module 8 activity: read an unlabeled dashboard, name the bottleneck
      RequestLatencyBreakdown.tsx   Module 8 activity: split a request-latency total into its phases
      LagSlopeVsAbsolute.tsx        Module 8 activity: runaway lag slope vs. flat-but-breaching backlog
      IsrChurnDemo.tsx              Module 8 activity: localize ISR churn to one broker vs. a shared cause
      IncidentDiagnosis.tsx         Reveal-clues-then-diagnose flow used by the incident simulator
  lib/
    types.ts                        Shared content types (incl. per-module course metadata)
    course.ts                       Computed course length + beginner/reference/advanced splits
    data/                           Seed content for modules, labs, configs, incidents, troubleshooting, runbooks
    data/labs.ts                    In-app hands-on lab walkthroughs (Lab A single-broker, Lab B three-broker, Lab C schema evolution)
    data/walkthroughs.ts            Module 3 code walkthrough — 16 lessons (build it / break it), each a verbatim snippet of an order-pipeline-java file
    context/ClusterContext.tsx      Kafka version + deployment type, selectable in the top bar
    context/ProgressContext.tsx     Per-module completion + resume state + lab/walkthrough step checkboxes, persisted to localStorage

examples/
  order-pipeline-java/              Java producer/consumer for Module 3 — own Gradle build + CI job
    src/main/java/…/shared/         OrderEvent record + JSON serialization
    src/main/java/…/producer/       OrderProducer (keyed by customerId, acks=all) + ProducerApp
    src/main/java/…/consumer/       OrderConsumer (manual commit, at-least-once) + ConsumerApp
    src/test/java/…                 MockProducer / MockConsumer unit tests — no broker needed
```

`ModuleMeta.tsx` renders the per-module header (difficulty, estimated time, prerequisites,
objectives, last-reviewed date). The home page and sidebar split modules into a linear
**Beginner path** and lookup-as-needed **Reference** material; the course-length estimate is
computed from each module's `estimatedMinutes`, not hardcoded.

**Progress tracking** (`ProgressContext`) records which modules a learner has completed and
last visited, in `localStorage` (`kafka-guide:progress`). It drives the completion toggle at
the bottom of each module, the "✓ done" markers on cards and in the sidebar, and the
beginner-path progress bar + "Resume" link on the home page. A blocked/unavailable store
degrades gracefully — progress just doesn't persist.

**Glossary** (`/glossary`, data in `src/lib/data/glossary.ts`) defines the core Kafka
vocabulary, each term linking to the modules that teach it. `GlossaryTerm.tsx` exports both
an inline `<GlossaryTerm slug>` link and `renderGlossaryText()`, which the Topic explorer
uses to turn `[[slug]]` / `[[slug|display]]` tokens in lesson content into dotted-underline
links back to the glossary.

## What's scaffolded vs. what's next

- **Module 0 (Why Kafka?)** is built: Topic explorer content for all 9 topics — what an
  event is, streaming vs. request/response, Kafka vs. queues / databases / object storage,
  common use cases, when Kafka is the wrong tool, and the components at a high level. It
  deliberately stops short of ISR / acks / KRaft. Four interactive activities — a
  technology-choice picker, an order-event fan-out walkthrough, a queue-vs-retained-log
  comparison, and a label-the-event exercise — plus a 10-question knowledge check and a
  "should this system use Kafka?" design exercise.
- **Module 1 (Kafka mental model)** is built: scannable Topic explorer content for all 6
  topics (append-only log, brokers/partitions/replicas, leaders/ISR/controllers,
  producers/consumers/offsets/groups, ordering guarantees, delivery semantics) plus the
  four interactive activities — producer → partition → consumer flow, partition-count vs.
  ordering, broker failure and leader election, and predict-before-reveal. See
  [PLAN.md](PLAN.md) for the detailed status.
- **Module 3 (Build a producer and consumer)** is built: a 16-lesson in-app code
  walkthrough (`CodeWalkthrough`, data in `src/lib/data/walkthroughs.ts`) over the
  `examples/order-pipeline-java/` scaffold, in two phases. **Build the happy path** —
  dependencies, the event record, producer config, async `send()`, confirming the write,
  serialization, consumer config, the poll loop, offset commits, consumer groups, graceful
  shutdown. **Break it on purpose** — watching a rebalance, a poison record stalling the
  partition, then `skip` / dead-letter policies, and a hard-kill drill that proves
  at-least-once redelivery. Every snippet is a verbatim slice of a real source file, checked
  by `walkthroughs.test.ts`; each lesson has a persisted "read it" checkbox and, where
  relevant, a "try it" command against Lab A.
- **Module 4 (Schemas and data contracts)** is built: Topic explorer content for all 8
  topics — the serializer/deserializer boundary and the implicit data contract, JSON vs.
  Avro vs. Protobuf, what the Schema Registry adds (schema id in the wire format, register
  on write / fetch on read), subjects and naming strategies, the compatibility modes
  (BACKWARD / FORWARD / FULL / NONE and their transitive variants) and the deploy order
  each forces, the safe schema changes, deserialization failures as poison records, and
  when a registry is actually worth running. Ships **Lab C** — an in-app walkthrough that
  registers a closed JSON Schema on the Lab B stack's Schema Registry (`--profile extras`),
  keeps a consumer running while the schema evolves, and watches the registry accept an
  added optional field under BACKWARD, reject a type change under every mode, and reject
  that same kind of add once the subject is switched to FORWARD.
- **Module 5 (Producer configuration)** is fully built: real lesson prose for all 7
  topics (not just an outline) plus all 6 planned activities, covered by 4 interactive
  demos (acks vs. a leader crash, batching/throughput, buffer/size/delivery-timeout
  failures, idempotence and duplicates).
- **Module 6 (Consumer configuration)** is fully built: real lesson prose for all 7
  topics plus one interactive demo per activity (6 demos): processing vs.
  max.poll.interval.ms, consumer-group scaling and rebalances, automatic vs. manual
  commits, crashing before/after a commit, offset reset and replay, and poison-message
  handling with retry and dead-letter topics.
- **Module 7 (Broker and topic configuration)** is built: scannable Topic explorer content
  for all 11 topics plus 4 interactive demos (ISR floor vs. min.insync.replicas, delete vs.
  compact cleanup, rack placement and rack failure, client quota throttling).
- **Module 8 (Observability)** is built: Topic explorer content for all 11 signals plus 4
  interactive demos (unlabeled-dashboard bottleneck diagnosis, request-latency phase
  breakdown, lag slope vs. absolute value, ISR-churn localization).
- **The incident simulator** has all 10 scenarios built out (reveal clues, pick a
  diagnosis, get scored feedback): slow broker, full broker disk, incorrect advertised
  listener, poison message, rebalance storm, hot partition, replica falling out of ISR,
  compaction not reclaiming space, producer timeouts from an unavailable partition, and TLS
  certificate expiration. Each wrong answer explains what that cause's real signature would
  look like.
- **Config explorer** ships with real settings across producer/consumer/broker/topic
  scope, filterable by scope and goal, seeded from the plan's configuration priorities.
- **Module 9 (Troubleshooting scenarios)** and the **troubleshooting catalog** are the same
  content: all 10 symptom entries, each with an overview, cause → evidence pairs (the
  specific metric/log/command that confirms or rules out each cause), a resolution flow,
  key config chips, and a "watch out" — the durability setting you could lower to make the
  error disappear while making the system worse. Searchable by symptom, cause, evidence, or
  config key. The Module 9 page embeds the catalog; `/troubleshooting` is the standalone
  reference view.
- **Production runbooks** ships all 14 written to full content — prechecks, execution,
  validation, rollback, and escalation criteria — each on its own `/runbooks/[slug]` page:
  topic creation review, increasing partitions, adding/removing brokers, partition
  reassignment, rolling app and broker restarts, certificate/credential rotation, capacity
  planning, backup & DR, cluster migration, Kafka upgrades, consumer offset recovery,
  handling a full disk, and broker/AZ failures.
- **In-app hands-on labs** (`LabWalkthrough`, data in `src/lib/data/labs.ts`), each step
  showing the exact command, the expected output, a "what did you observe?" prompt, a common
  error with recovery, and a checkbox that persists via `ProgressContext`:
  - **Lab A** (Module 2) — one broker via a single `docker run`, 10 steps: create-topic →
    produce (keyed and unkeyed) → consume → partition placement → consumer group + lag →
    reset offsets and replay.
  - **Lab B** (Module 2, renders collapsed below Lab A) — the three-broker cluster, 9 steps:
    replication factor 3 → leader election when a broker stops → ISR shrink and recovery →
    `acks=all` admission control below `min.insync.replicas` → the Grafana dashboard →
    dynamic topic config. Carries an OS matrix (macOS / Windows-WSL / Linux), a Docker
    memory floor, and lab-level troubleshooting.
  - **Lab C** (Module 4) — schema evolution on Lab B's stack with the Schema Registry
    (`--profile extras`), 9 steps: register a closed JSON Schema → start a consumer and
    leave it running → add an optional field (BACKWARD accepts it, consumer keeps reading
    with no restart) → change a field's type (409 `TYPE_CHANGED`, no mode allows it) → flip
    the subject to FORWARD and watch the same kind of optional-field add get rejected →
    restore BACKWARD and register it as v3. All `curl` against `localhost:8081` plus the
    JSON-Schema console producer/consumer; no new code.
- The **local cluster lab** at [`local-cluster-lab/`](local-cluster-lab/) is the Docker
  Compose project Lab B drives — its own `docker-compose.yml`, a `verify-lab.sh` health
  check, and a README with the service inventory, per-OS setup, and troubleshooting. CI
  (`verify-local-cluster-lab`) validates the compose graphs, the dashboard JSON, and
  `verify-lab.sh` (`bash -n` + `shellcheck`).
- The code Module 3 walks through lives at
  [`examples/order-pipeline-java/`](examples/order-pipeline-java/): a plain-Java Kafka
  producer and consumer (`OrderEvent` → JSON → `orders` topic, keyed by customer id,
  `acks=all` + idempotence on the producer, manual at-least-once commit on the consumer,
  a rebalance-logging listener, and a `PoisonPolicy` — propagate / skip / dead-letter —
  for records that won't parse), with `MockProducer` / `MockConsumer` unit tests that need
  no broker. Its own Gradle build (wrapper pinned by SHA-256, Java 21 toolchain, Kafka 4.0
  clients) runs in a dedicated CI job (`verify-order-pipeline-java`).
