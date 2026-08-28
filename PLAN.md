# Kafka, Operationally — Build Plan & Status

Tracks work against the guide plan referenced in [README.md](README.md). Statuses: ✅ Done · 🚧 In progress · ⭕ Planned (not started) · ❓ Open question.

## Module 1 — Kafka mental model

All four planned **activities** are built out, as the interactive pattern to repeat for
modules 2–7. The **topic list itself is still only a bullet outline** — it names the
concepts (append-only log, controllers, consumer groups, offsets, delivery semantics) but
does not yet contain the explanatory lesson prose to actually teach them. Don't read
"activities done" as "module done."

| Item | Status | Notes |
|---|---|---|
| Topics — narrative/lesson content | ⭕ Planned | The page renders a bullet-point outline of topic names only (see [modules.ts](src/lib/data/modules.ts) `topics` array and [page.tsx](src/app/modules/%5Bslug%5D/page.tsx)); no explanatory prose has been written yet for any topic. |
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

Unlike Module 1 and 2, this module is "fully" done in the sense flagged as a gap
everywhere else in this file: all 7 topics have real lesson prose, not just a bullet
outline, in addition to the 4 interactive activities below. `Module.topicNarrative`
(new, optional field on `Module` in [types.ts](src/lib/types.ts)) carries this content,
rendered by [page.tsx](src/app/modules/%5Bslug%5D/page.tsx) as full prose sections when
present, falling back to the old bullet-outline layout otherwise — Modules 1 and 4–7
are unaffected and still render as bullets.

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
| New config entries (10) | ✅ Done | [configs.ts](src/lib/data/configs.ts) gained `group.id`, `partition.assignment.strategy`, `group.instance.id`, `heartbeat.interval.ms`, `max.poll.records`, `enable.auto.commit`, `auto.commit.interval.ms`, `isolation.level`, `fetch.max.bytes`, `group.protocol` — closing dangling `relatedConfigs` references (`group.id`, `group.instance.id`, `heartbeat.interval.ms`, `max.poll.records`, `enable.auto.commit`, `fetch.max.bytes`) plus topical ones (`group.protocol` and the classic-only qualifiers came out of the PR review). Three new goal categories ("Consumer group scaling", "Read transactional data", "Tune consumer fetching"). Verified in Config Explorer: 31/31 entries render, new categories populate the filter. |
| Activity: make processing exceed max.poll.interval.ms | ✅ Done | [PollIntervalDemo.tsx](src/components/demos/PollIntervalDemo.tsx) — max.poll.records × per-record processing time vs. a (scaled 1000ms) interval budget; shows the healthy poll loop vs. the rebalance loop, and that raising the interval or lowering max.poll.records both fix it. |
| Activity: add and remove consumer instances | ✅ Done | [ConsumerGroupScalingDemo.tsx](src/components/demos/ConsumerGroupScalingDemo.tsx) — 6 partitions, 1–8 consumers, contiguous RangeAssignor-style assignment, rebalance log on every join/leave, a 7th+ consumer shown explicitly idle. |
| Activity: compare automatic and manual commits | ✅ Done | [CommitStrategyDemo.tsx](src/components/demos/CommitStrategyDemo.tsx) — a loop clock plus auto.commit.interval.ms: auto-commit fires only when the interval has elapsed since the last commit, so fast polls (picker: 1000/2000/6000 ms per poll) trail several batches and slow polls keep to one. Polling continues past the end of the partition so the final position can commit on a later empty poll(). The read-vs-committed gap is labeled "redelivered on crash now" (mostly-but-not-all duplicates). Manual commitSync() advances the offset exactly when called. |
| Activity: crash a consumer before and after committing | ✅ Done | [CommitCrashDemo.tsx](src/components/demos/CommitCrashDemo.tsx) — one batch of 3, explicit ordering of "commit offset 3" and "crash consumer," plus a commit-before-processing toggle whose policy the buttons enforce. Tracks processed vs. committed separately: a partial crash reports duplicates (already processed) vs. first-time deliveries, not a blanket "reprocessed." Commit-before-processing + crash → skipped records (at-most-once); commit-after-processing + clean crash → clean handoff. New owner always resumes from the committed offset. |
| Activity: reset offsets and replay data | ✅ Done | [OffsetResetDemo.tsx](src/components/demos/OffsetResetDemo.tsx) — a 12-record log with committed offset 8; `--to-earliest` / `--to-latest` / `--to-offset` / `--shift-by` buttons. Per-offset `consumed / replay / pending / skipped` status derived from a persistent consumption history and the movable bookmark: a backward reset marks previously-consumed records `replay` (not "new"), a forward reset marks jumped-over records `skipped` (reversible by a later reset). Disclaimer notes the CLI refuses to run against an active group and needs `--execute`. |
| Activity: process a poison message using retry and dead-letter topics | ✅ Done | [PoisonMessageDemo.tsx](src/components/demos/PoisonMessageDemo.tsx) — offset 2 is poison; all three strategies assume a seek-back error handler. Tabs: "unbounded retry" (seek back forever, partition stuck, lag grows), "dead-letter topic" (bounded in-place retries → produce to `orders.DLT` → commit past), "retry topics" (forward to `orders.retry.5s`, escalating to `.30s` then DLT). |

**Tests**: 30 new tests across the six demo test files (83 total in the suite, up from 53),
following the Module 1/3 pattern — `data-testid` for structural containers, exact-string
assertions on log/outcome text, one test per distinct behavior branch. All passing, plus
`typecheck`, `lint`, and `next build` clean.

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
| `fetch.max.bytes` was a dangling `relatedConfigs` reference | ✅ Done | Added a `fetch.max.bytes` `ConfigEntry` (new "Tune consumer fetching" goal), including the soft-limit behavior for oversized single records. |

**Review findings addressed (round 2)** (8 more findings from a follow-up review; all
re-verified live):

| Finding | Status | Fix |
|---|---|---|
| Auto-commit could never commit the final batch — polling was disabled once all records were read | ✅ Done | `CommitStrategyDemo` `poll()` now keeps running past the end of the partition in auto mode (empty polls that only run the auto-commit check and advance the clock) until `committed` reaches `read`; the poll button disables only then. Subtitle tells the reader to keep clicking past the end. New test covers it. |
| `fetch.max.bytes` default was wrong (55 MiB) and the soft-limit exception was described as a single record | ✅ Done | Corrected to `52428800` (50 MiB). The soft-limit wording now says the *first record batch* in the first non-empty partition, not an individual record. |
| Assignment described as leader-computed without qualification | ✅ Done | "Consumer groups and partition assignment" narrative now splits it: classic protocol → coordinator picks a leader that computes the assignment; `group.protocol=consumer` → the broker computes it, no leader. |
| Cooperative migration always described as two rolling bounces | ✅ Done | "Cooperative assignment" narrative and `partition.assignment.strategy` config corrected: from the default `[RangeAssignor, CooperativeStickyAssignor]` list it's a single bounce removing RangeAssignor; two bounces only when migrating from an eager-only assignor. |
| `group.protocol` shown in the Config Explorer for Kafka 3.5/3.7/3.9 | ✅ Done | Added `availableFromVersion?: KafkaVersion` to `ConfigEntry` plus `versionAtLeast` / `configAvailable` helpers in `types.ts`; the Config Explorer hides version-gated entries and its counter reflects the version-available total. `group.protocol` gated to `4.0`. |
| Offset-reset status lost consumption history — a backward reset relabeled previously-consumed records "not yet consumed" | ✅ Done | `OffsetResetDemo` rebuilt around a persistent `everConsumed[]` history plus the movable bookmark; status is derived as `consumed / replay / pending / skipped`. A backward reset over consumed records shows them as `replay`, and the count line separates "replayed" from "new." |
| Poison strategy mislabeled "no handling" — it models an explicit seek-back retry handler | ✅ Done | Tab renamed "unbounded retry"; disclaimer states all three strategies assume a seek-back handler and that this one is Spring Kafka's original default (seek back on every failure, no limit, no routing). |
| PLAN.md still described auto-commit as "one batch behind" and the poison strategy as "no handling" | ✅ Done | Updated the Module 4 activity rows above to match the reworked demos. |

## Test infrastructure

| Item | Status | Notes |
|---|---|---|
| Vitest + React Testing Library setup | ✅ Done | [vitest.config.mts](vitest.config.mts), [vitest.setup.ts](vitest.setup.ts), `npm test` / `npm run test:watch`. |
| Component tests | ✅ Done | 83 tests across 14 files: `RecordFlowDemo.test.tsx`, `PartitionOrderingDemo.test.tsx`, `LeaderElectionDemo.test.tsx`, `Sidebar.test.tsx` (Module 1); `AcksDurabilityDemo.test.tsx`, `BatchingThroughputDemo.test.tsx`, `BufferAndTimeoutDemo.test.tsx`, `IdempotenceDemo.test.tsx` (Module 3); `PollIntervalDemo.test.tsx`, `ConsumerGroupScalingDemo.test.tsx`, `CommitStrategyDemo.test.tsx`, `CommitCrashDemo.test.tsx`, `OffsetResetDemo.test.tsx`, `PoisonMessageDemo.test.tsx` (Module 4). |
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

| Item | Status | Notes |
|---|---|---|
| Modules 5–7 content/interactivity | ⭕ Planned | Titles, topics, and activities are scoped in [modules.ts](src/lib/data/modules.ts); pages render a "planned" placeholder today. |
| Module 3 (Producer configuration) | ✅ Done | Full topic narrative + 4 interactive activities. See the Module 3 section above. |
| Module 4 (Consumer configuration) | ✅ Done | Full topic narrative (7 topics) + 6 interactive activities. See the Module 4 section above. |
| Module 1's topic narrative content | ⭕ Planned | Still a bullet outline, unlike Module 3 — see the Module 1 section above. |
| Module 2 in-app page | ✅ Done | Detail page and index card both show a "lab built" badge (new `Module.status: "external"` value) with a link out to `local-cluster-lab/` on GitHub, instead of grouping with the actually-unbuilt "planned" modules. |
| 9 remaining incident-simulator scenarios | ⭕ Planned | Only the "slow broker" incident is fully built; the rest render "planned." |
| 14 production runbooks | ⭕ Planned | Titles/categories scoped; content not written. |
| Local cluster lab (docker-compose, 3-broker KRaft + Kafka UI + Prometheus/Grafana) | ✅ Done | Built at [local-cluster-lab/](local-cluster-lab/) — explicitly out of scope for the Next.js app per README, a separate deliverable. See Module 2 section below for what was built and verified. |

## Verification

- `npm run typecheck` (`next typegen && tsc --noEmit`) — clean, including from a clean checkout with no `.next` directory
- `npx eslint .` — clean
- `npx vitest run` — 83/83 passing
- `npm run build` — clean production build
- Manual browser verification (desktop + mobile viewports) for every UI-facing fix above,
  except the drawer's breakpoint-crossing close: the available browser automation tool's
  viewport resize doesn't dispatch `resize` or `matchMedia` "change" events at all (confirmed
  by direct test — `.matches` updates but no event fires), so that fix is verified by a unit
  test that fires the listener directly, plus standard `MediaQueryList` behavior in real
  browsers, rather than an end-to-end browser resize.
