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
    runbooks/                       Production operations runbook index
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
      IncidentDiagnosis.tsx         Reveal-clues-then-diagnose flow used by the incident simulator
  lib/
    types.ts                        Shared content types
    data/                           Seed content for modules, configs, incidents, troubleshooting, runbooks
    context/ClusterContext.tsx      Kafka version + deployment type, selectable in the top bar
```

## What's scaffolded vs. what's next

- **Module 1 (Kafka mental model)**'s four planned interactive activities are all built
  (producer → partition → consumer flow, partition-count/ordering, broker failure/leader
  election), as the pattern to repeat for the rest of the modules. The topic list itself
  is still just a bullet outline, though — the explanatory lesson content for each topic
  hasn't been written yet. See [PLAN.md](PLAN.md) for the detailed status.
- **Module 3 (Producer configuration)** is fully built: real lesson prose for all 7
  topics (not just an outline) plus all 6 planned activities, covered by 4 interactive
  demos (acks vs. a leader crash, batching/throughput, buffer/size/delivery-timeout
  failures, idempotence and duplicates).
- **The incident simulator's "slow broker" incident** is fully built out (reveal clues,
  pick a diagnosis, get scored feedback) as the pattern for the other 9 incidents.
- **Config explorer** ships with 21 real settings across producer/consumer/broker/topic
  scope, filterable by scope and goal, seeded from the plan's configuration priorities.
- **Troubleshooting catalog** ships with all 10 symptom → cause → resolution entries from
  the plan, searchable.
- Modules 4–7, the remaining 9 incidents, and the 14 runbooks are scoped (titles, topics,
  clues, categories) but their content/interactivity is not yet written — they render a
  "planned" state so the whole app is navigable today. Module 2's page is the exception: it
  links out to the local cluster lab below instead of showing that placeholder, since the
  content itself lives outside the Next.js app.
- The **local cluster lab** (three-broker KRaft + Kafka UI + Prometheus/Grafana via
  containers) described in the plan is a separate, non-web deliverable — not part of this
  Next.js app. It's built out at [`local-cluster-lab/`](local-cluster-lab/) (its own
  `docker-compose.yml` and README) with a walkthrough for all six Module 2 activities.
