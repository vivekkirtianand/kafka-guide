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
    modules/                        Module index + dynamic module pages (7 modules from the plan)
    config-explorer/                Filterable configuration reference
    troubleshooting/                Symptom → evidence → cause → resolution catalog
    runbooks/                       Production operations runbook index + dynamic runbook pages
    incident-simulator/             Incident list + interactive diagnosis pages
  components/
    Sidebar.tsx, TopBar.tsx         App shell (nav + persistent version/deployment context)
    LogStrip.tsx                    Signature append-only-log motif (used in the top bar)
    demos/
      RecordFlowDemo.tsx            Module 1 activity: producer → partition → consumer, predict-before-reveal
      PartitionOrderingDemo.tsx     Module 1 activity: partition count vs. ordering guarantees
      LeaderElectionDemo.tsx        Module 1 activity: broker failure, catch-up, and leader election
      AcksDurabilityDemo.tsx        Module 3 activity: acks=0/1/all vs. a leader crash mid-produce
      BatchingThroughputDemo.tsx    Module 3 activity: linger.ms/batch.size vs. request count and latency
      BufferAndTimeoutDemo.tsx      Module 3 activity: buffer fill, oversized records, delivery.timeout.ms
      IdempotenceDemo.tsx           Module 3 activity: duplicate sends with and without idempotence
      PollIntervalDemo.tsx          Module 4 activity: processing time vs. max.poll.interval.ms
      ConsumerGroupScalingDemo.tsx  Module 4 activity: adding/removing consumers, partition assignment, rebalances
      CommitStrategyDemo.tsx        Module 4 activity: automatic vs. manual offset commits
      CommitCrashDemo.tsx           Module 4 activity: crashing before vs. after a commit
      OffsetResetDemo.tsx           Module 4 activity: offset reset (--to-earliest/--shift-by/…) and replay
      PoisonMessageDemo.tsx         Module 4 activity: poison messages, retry topics, dead-letter topics
      ReplicationFloorDemo.tsx      Module 5 activity: shrink the ISR below min.insync.replicas
      RetentionCompactionDemo.tsx  Module 5 activity: delete vs. compact cleanup on a keyed log
      RackPlacementDemo.tsx         Module 5 activity: spread replicas across racks, then fail a rack
      QuotaThrottleDemo.tsx         Module 5 activity: a client past its byte-rate quota slows, not errors
      BottleneckDiagnosis.tsx       Module 6 activity: read an unlabeled dashboard, name the bottleneck
      RequestLatencyBreakdown.tsx   Module 6 activity: split a request-latency total into its phases
      LagSlopeVsAbsolute.tsx        Module 6 activity: runaway lag slope vs. flat-but-breaching backlog
      IsrChurnDemo.tsx              Module 6 activity: localize ISR churn to one broker vs. a shared cause
      IncidentDiagnosis.tsx         Reveal-clues-then-diagnose flow used by the incident simulator
  lib/
    types.ts                        Shared content types (incl. per-module course metadata)
    course.ts                       Computed course length + beginner/reference/advanced splits
    data/                           Seed content for modules, configs, incidents, troubleshooting, runbooks
    context/ClusterContext.tsx      Kafka version + deployment type, selectable in the top bar
```

`ModuleMeta.tsx` renders the per-module header (difficulty, estimated time, prerequisites,
objectives, last-reviewed date). The home page and sidebar split modules into a linear
**Beginner path** and lookup-as-needed **Reference** material; the course-length estimate is
computed from each module's `estimatedMinutes`, not hardcoded.

## What's scaffolded vs. what's next

- **Module 1 (Kafka mental model)** is built: scannable Topic explorer content for all 6
  topics (append-only log, brokers/partitions/replicas, leaders/ISR/controllers,
  producers/consumers/offsets/groups, ordering guarantees, delivery semantics) plus the
  four interactive activities — producer → partition → consumer flow, partition-count vs.
  ordering, broker failure and leader election, and predict-before-reveal. See
  [PLAN.md](PLAN.md) for the detailed status.
- **Module 3 (Producer configuration)** is fully built: real lesson prose for all 7
  topics (not just an outline) plus all 6 planned activities, covered by 4 interactive
  demos (acks vs. a leader crash, batching/throughput, buffer/size/delivery-timeout
  failures, idempotence and duplicates).
- **Module 4 (Consumer configuration)** is fully built: real lesson prose for all 7
  topics plus one interactive demo per activity (6 demos): processing vs.
  max.poll.interval.ms, consumer-group scaling and rebalances, automatic vs. manual
  commits, crashing before/after a commit, offset reset and replay, and poison-message
  handling with retry and dead-letter topics.
- **Module 5 (Broker and topic configuration)** is built: scannable Topic explorer content
  for all 11 topics plus 4 interactive demos (ISR floor vs. min.insync.replicas, delete vs.
  compact cleanup, rack placement and rack failure, client quota throttling).
- **Module 6 (Observability)** is built: Topic explorer content for all 11 signals plus 4
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
- **Module 7 (Troubleshooting scenarios)** and the **troubleshooting catalog** are the same
  content: all 10 symptom entries, each with an overview, cause → evidence pairs (the
  specific metric/log/command that confirms or rules out each cause), a resolution flow,
  key config chips, and a "watch out" — the durability setting you could lower to make the
  error disappear while making the system worse. Searchable by symptom, cause, evidence, or
  config key. The Module 7 page embeds the catalog; `/troubleshooting` is the standalone
  reference view.
- **Production runbooks** ships all 14 written to full content — prechecks, execution,
  validation, rollback, and escalation criteria — each on its own `/runbooks/[slug]` page:
  topic creation review, increasing partitions, adding/removing brokers, partition
  reassignment, rolling app and broker restarts, certificate/credential rotation, capacity
  planning, backup & DR, cluster migration, Kafka upgrades, consumer offset recovery,
  handling a full disk, and broker/AZ failures.
- Module 2's page links out to the local cluster lab below instead of showing an in-app
  page, since that content lives outside the Next.js app.
- The **local cluster lab** (three-broker KRaft + Kafka UI + Prometheus/Grafana via
  containers) described in the plan is a separate, non-web deliverable — not part of this
  Next.js app. It's built out at [`local-cluster-lab/`](local-cluster-lab/) (its own
  `docker-compose.yml` and README) with a walkthrough for all six Module 2 activities.
