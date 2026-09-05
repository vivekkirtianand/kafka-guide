# Local cluster lab

**Lab B** of Module 2 ([`../README.md`](../README.md), [`../PLAN.md`](../PLAN.md)). A
reproducible three-broker Kafka cluster in KRaft mode, plus the tooling to observe it: a
web UI, and a Prometheus/Grafana stack for metrics. This is a standalone Docker Compose
project — it has no dependency on the Next.js app in the repo root and isn't served by it.

The Module 2 page has a **step-by-step in-app walkthrough** of this lab (bring the cluster
up, create a replicated topic, stop a broker and watch leader election, drop the ISR below
`min.insync.replicas`, read the Grafana dashboard). This README is the reference the
walkthrough points at — service inventory, per-OS setup, and troubleshooting.

## What's in the cluster

- **`kafka-1` / `kafka-2` / `kafka-3`** — three [Apache Kafka 4.0.2](https://kafka.apache.org/)
  brokers, each also acting as a KRaft controller (no ZooKeeper — Kafka 4.0 removed it).
  Pinned to 4.0.2, not 4.0.0/4.0.1: those are affected by
  [CVE-2026-35554](https://kafka.apache.org/community/cve-list/), a producer buffer-pool
  race that can silently corrupt or misroute records.
  Reachable from the host at `localhost:29092`, `localhost:29093`, `localhost:29094`.
  Default topic settings: 3 partitions, replication factor 3, `min.insync.replicas=2`.
- **Kafka UI** ([provectuslabs/kafka-ui](https://github.com/provectus/kafka-ui)) —
  http://localhost:8080. Browse topics, partitions, messages, and consumer groups without
  the CLI.
- **kafka-exporter** ([danielqsj/kafka-exporter](https://github.com/danielqsj/kafka-exporter))
  — translates cluster/consumer-group state into Prometheus metrics (no JMX agent needed).
- **Prometheus** — http://localhost:9090. Scrapes kafka-exporter every 10s.
- **Grafana** — http://localhost:3001. Anonymous access enabled (admin role) for a local
  lab; ships with a pre-provisioned "Kafka lab overview" dashboard (broker count,
  under-replicated partitions, consumer group lag, partition throughput, ISR table).
- **Schema Registry** and **Kafka Connect** (optional, behind the `extras` profile — see
  below) — for the "Optional Schema Registry and Kafka Connect" topic in the plan.

## Prerequisites

Docker and Docker Compose (v2 — the `docker compose` subcommand, not the standalone
`docker-compose` binary). No other local tooling required; the Kafka CLI is used via
`docker exec` into the broker containers.

### Resources

Give Docker **at least 4 GB of memory** (6 GB is comfortable) and keep **~5 GB of free
disk**. The stack is three Kafka JVMs plus kafka-ui, Prometheus, and Grafana. Below ~4 GB
the brokers can't allocate their heap and the containers restart in a loop — the most
common "the lab won't start" cause. On Docker Desktop the limit is under
**Settings → Resources → Advanced**.

### By platform

| Platform | Notes |
|---|---|
| **macOS** | Docker Desktop. Raise the memory limit as above (the default is often 2 GB). Apple Silicon needs nothing special — every image here is multi-arch. |
| **Windows** | Use the **WSL 2** backend and work entirely inside a WSL 2 (Ubuntu) shell. Clone this repo into the Linux home directory (`~`), **not** `/mnt/c/...` — Compose bind mounts onto the Windows filesystem are slow enough to fail the broker health checks. |
| **Linux** | Docker Engine plus the Compose plugin. Your user must be in the `docker` group, or prefix commands with `sudo`. |

## Quick start

```bash
cd local-cluster-lab
docker compose up -d
```

First run pulls several images and can take a few minutes. Once up:

| Service | URL |
|---|---|
| Kafka UI | http://localhost:8080 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Kafka bootstrap (from host) | `localhost:29092,localhost:29093,localhost:29094` |

Check the whole lab at once:

```bash
./verify-lab.sh
```

`verify-lab.sh` confirms all three brokers report `healthy` and that every host port
(29092–29094, 8080, 9090, 3001) is accepting connections. It exits non-zero if anything is
wrong and points you at the [Troubleshooting](#troubleshooting) section below. Re-run it any
time the lab seems off. To check just the containers:

```bash
docker compose ps
```

All three `kafka-*` services should report `healthy` within about 30–60 seconds of
starting.

Everything below uses `kafka-1` as the CLI entry point — any healthy broker works
equally well.

## Activities

These match the activities scoped for this module in
[`../src/lib/data/modules.ts`](../src/lib/data/modules.ts).

### 1. Create and inspect topics

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-1:19092 \
  --create --topic orders --partitions 3 --replication-factor 3

docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-1:19092 --describe --topic orders
```

The `--describe` output shows each partition's leader, full replica set, and in-sync
replica (ISR) set — the same three columns you'll watch change in activity 4. You can also
create/browse topics from Kafka UI at http://localhost:8080.

### 2. Produce records with and without keys

Without keys — records spread across partitions round-robin-ish (batch-wise) with no
ordering guarantee between them:

```bash
docker exec -it kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server kafka-1:19092 --topic orders
```

With keys — same key always maps to the same partition, so records sharing a key stay
ordered relative to each other:

```bash
docker exec -it kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server kafka-1:19092 --topic orders \
  --property "parse.key=true" --property "key.separator=:"
```

Then type lines like `customer-42:first order` / `customer-42:second order` and
`customer-7:another order`. Consume and watch key/partition placement:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka-1:19092 --topic orders --from-beginning \
  --property print.key=true --property print.partition=true \
  --max-messages 3 --timeout-ms 20000
```

`--max-messages` makes the consumer exit as soon as it has read that many records, so there
is no timeout to sit through; `--timeout-ms 20000` is only a backstop if fewer were produced
(a short 5s timeout can expire during the cold consumer-group coordinator setup and look
like a failed produce).

### 3. Observe partition placement

Re-run the `--describe` command from activity 1. Note how leadership is spread across all
three brokers rather than concentrated on one — Kafka assigns replicas (and picks a
"preferred leader") to balance load across the cluster. Kafka UI's topic detail view shows
the same information visually, including which broker each partition's leader is currently
on.

### 4. Stop and restart brokers

Describe the topic, then stop `kafka-2` — with three partitions across three brokers it
leads one of them — and describe again:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-1:19092 --describe --topic orders

docker compose stop kafka-2

docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka-1:19092 --describe --topic orders
```

The partition kafka-2 was leading gets a new `Leader` (a surviving in-sync replica) and
kafka-2 drops out of every `Isr`. Stopping one of three brokers keeps the KRaft controller
quorum, so the rest of the cluster is unaffected. Restart it and re-describe after a few
seconds — it rejoins `Isr` once it's caught up, but does *not* automatically reclaim
leadership (expected KRaft behavior; a later "preferred leader" election would move it back):

```bash
docker compose start kafka-2
```

### 5. Inspect consumer offsets

Consume with a named group, then describe it:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka-1:19092 --topic orders --group order-processors \
  --from-beginning --timeout-ms 20000

docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:19092 --describe --group order-processors
```

`CURRENT-OFFSET`, `LOG-END-OFFSET`, and `LAG` per partition are the same numbers the
Grafana dashboard's "Consumer group lag" panel plots over time. Reset and replay:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka-1:19092 --group order-processors \
  --topic orders --reset-offsets --to-earliest --execute
```

### 6. Change topic-level configuration safely

Dynamic topic configs (like `retention.ms`) apply immediately with no restart:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server kafka-1:19092 --entity-type topics --entity-name orders \
  --alter --add-config retention.ms=3600000

docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server kafka-1:19092 --entity-type topics --entity-name orders --describe
```

Remove the override to fall back to the broker/cluster default:

```bash
docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server kafka-1:19092 --entity-type topics --entity-name orders \
  --alter --delete-config retention.ms
```

## Optional: Schema Registry and Kafka Connect

Off by default to keep the base lab light. Bring them up with the `extras` profile:

```bash
docker compose --profile extras up -d              # both extras services
docker compose --profile extras up -d schema-registry   # just the registry
docker compose --profile extras up -d kafka-connect     # just Connect
```

- Schema Registry: http://localhost:8081
- Kafka Connect REST API: http://localhost:8083

The Connect worker's `CONNECT_PLUGIN_PATH` includes `/usr/share/filestream-connectors` so
the built-in `FileStreamSourceConnector` / `FileStreamSinkConnector` are loadable — they
aren't on Connect's default plugin path in recent Confluent images. Connect is a second
heavy JVM; give Docker **6 GB** when running it alongside the three brokers.

### Lab C — evolving a schema under a running consumer

Module 5 ("Schemas and data contracts") drives an in-app walkthrough against the Schema
Registry above. Run every command from the lab directory — `cd "$(git rev-parse
--show-toplevel)/local-cluster-lab"` works from anywhere in the checkout. It registers a
**closed** JSON Schema (`additionalProperties: false`) for an `order-events` topic, starts a
`kafka-json-schema-console-consumer` and leaves it running, then evolves the schema:

1. **Compatible** — add an optional `discountCode` (in `properties`, not `required`). The
   registry accepts version 2 under the default `BACKWARD` mode: a consumer *on the v2
   schema* can still read a v1 record, so you roll v2 consumers out first. (The generic
   console consumer reads the v2 record too, but that is dynamic schema lookup, not a
   BACKWARD guarantee — BACKWARD does not promise a v1-pinned reader can read a v2 record.)
2. **Always broken** — change `amountCents` from an integer to a string. The producer fails
   to register it: `RestClientException ... errorType:"TYPE_CHANGED" ... error code: 409`. A
   type change breaks readers both ways, so `BACKWARD`, `FORWARD`, and `FULL` all reject it —
   only `NONE` would let it through, because `NONE` disables the check.
3. **Direction matters** — `curl -X PUT .../config/order-events-value` to `FORWARD`, then try
   to add another optional field, `giftMessage`. Now it is *rejected*
   (`PROPERTY_REMOVED_FROM_CLOSED_CONTENT_MODEL`) — FORWARD asks whether an old, closed
   schema can read the new data, and it can't. Set the mode back to `BACKWARD` and the same
   add registers as version 3.

The console consumer is **generic** — it deserializes each record with whatever schema its
id points at, and has no pinned "reader" schema. It would happily print an incompatible
record too, so it demonstrates dynamic lookup, not compatibility. Be precise about the
direction the default `BACKWARD` mode protects: a consumer *moved onto the new schema* can
still read the old data (hence "upgrade consumers first"). Keeping a consumer still on the
old schema safe against new-schema records is `FORWARD`'s guarantee, not `BACKWARD`'s. The JSON-Schema console producer/consumer ship in
the `kafka-lab-schema-registry` image, not the broker image — run them with `docker exec
... kafka-lab-schema-registry`. Everything schema-side is plain `curl` against
`http://localhost:8081`. To re-run the lab from scratch, use `docker compose --profile
extras down -v` — it wipes the `_schemas` topic and the `order-events` topic together,
keeping schema ids and records consistent. A soft `DELETE /subjects/order-events-value`
alone is not enough, and a *permanent* delete (`?permanent=true`) makes the records already
on the topic undecodable.

### Lab D — moving a file in and out of Kafka with Connect

Module 8 ("Kafka Connect and Kafka Streams") drives an in-app walkthrough against the Connect
worker above (`docker compose --profile extras up -d kafka-connect`). Everything is `curl`
against `http://localhost:8083` plus `docker exec` for the files:

1. **Source** — `curl -X PUT .../connectors/file-source/config` with a
   `FileStreamSourceConnector` reading `/tmp/connect-source.txt` into `connect-file-topic`.
   The connector tails the file: appending a line produces one more record, and it doesn't
   re-read what it already sent (`.../connectors/file-source/offsets` shows the byte
   position it resumes from, flushed every `offset.flush.interval.ms` — 60 s).
2. **Sink** — a `FileStreamSinkConnector` reading `connect-file-topic` back out to
   `/tmp/connect-sink.txt`. A sink is just a managed consumer group named
   `connect-file-sink` — `kafka-consumer-groups.sh --describe --group connect-file-sink`
   shows an ordinary committed offset and lag.
3. **Delete** — `curl -X DELETE .../connectors/<name>` (204). The topic and its records
   stay; only the connector stops.

No producer or consumer code. Connect keeps every connector's config, offsets, and status in
the internal topics `_connect-configs` / `_connect-offsets` / `_connect-status`, so
`docker compose --profile extras down -v` wipes all your connectors along with the cluster
data; plain `down` keeps them.

## Metrics and dashboards

The Grafana dashboard reads from kafka-exporter via Prometheus — no JMX setup needed. It
covers broker count, under-replicated partitions, per-topic write rate, consumer group lag,
and an ISR-vs-total-replicas table. Open Grafana (anonymous access, no login needed) and the
dashboard is provisioned under Dashboards → "Kafka lab overview". Prometheus's own UI
(http://localhost:9090) is useful for ad hoc queries against raw `kafka_*` metrics.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A `kafka-*` container restarts in a loop or never becomes `healthy` | Docker has too little memory for three broker JVMs, so the OS kills them as they start | Raise Docker's memory to ≥ 4 GB (Docker Desktop → Settings → Resources), then `docker compose down && docker compose up -d` |
| `verify-lab.sh` or `docker compose up` reports a port is already allocated | Another process — often a local Kafka or a previous run of this lab — holds 29092–29094, 8080, 9090, or 3001 | `docker compose down`, find the process (`lsof -i :29092`), stop it, retry. Or change the published ports in `docker-compose.yml` |
| Kafka UI (`localhost:8080`) shows no cluster / an "offline" status | It connected before the brokers were ready and cached the failure | `docker compose restart kafka-ui`, then reload |
| On Windows: `docker compose up` fails on a bind mount, or brokers never pass health checks | The repo is checked out under `/mnt/c/...` and Compose bind mounts onto the Windows filesystem are too slow | Clone into the WSL 2 home directory (`~`) and run the lab from there |
| `InvalidReplicationFactorException` creating a topic | Fewer than three brokers are actually up | Wait for `docker compose ps` to show all three `(healthy)`, then retry |
| Brokers healthy but `kafka-topics.sh` from your host can't connect | You used the in-container listener (`kafka-1:19092`) from the host, or vice versa | From inside a container use `kafka-1:19092`; from your host use `localhost:29092` |
| Lab C: `curl http://localhost:8081/...` refuses the connection | The Schema Registry isn't up — `--profile extras` was omitted, or it is still waiting for the brokers to be healthy | `docker compose --profile extras up -d schema-registry`, then poll `curl -s http://localhost:8081/subjects` for ~30 s |
| Lab C: `kafka-json-schema-console-producer: executable file not found` | Ran against a broker container; the JSON-Schema tools live only in `kafka-lab-schema-registry` | `docker exec -i kafka-lab-schema-registry kafka-json-schema-console-producer ...` |
| Lab C: a produce that should fail with a 409 succeeds, or the subject has extra versions | A previous run left `order-events-value` with leftover versions or a changed compatibility mode | `docker compose --profile extras down -v && docker compose --profile extras up -d schema-registry` — the clean reset, wiping `_schemas` and `order-events` together |
| Lab C: consumer dies with `Schema N not found; error code: 40403` | A schema still referenced by records on the topic was hard-deleted (`?permanent=true`) | `docker compose --profile extras down -v`, then bring the registry back and recreate the topic. Never use `?permanent=true` on a subject whose records are still live |

## Cleaning up

```bash
docker compose stop        # stop containers, keep them and their volumes — `start` resumes
docker compose down        # remove containers + network, KEEP the data volumes
docker compose down -v     # ALSO delete the data volumes — every topic, record, and
                           # Grafana/Prometheus history is gone, next start is a new cluster
```

**`docker compose down -v` is destructive and has no undo.** The named volumes are what make
this lab's data survive a restart; `-v` deletes them. Use it only when a genuinely fresh
cluster is what you want. Plain `docker compose down` (no `-v`) is safe — the next
`docker compose up -d` brings the same cluster back with all its data.

## Notes

- `CLUSTER_ID` in `docker-compose.yml` is a fixed KRaft cluster ID (generated once via
  `kafka-storage.sh random-uuid`) so all three brokers agree on cluster identity across
  restarts. Only regenerate it if you want a genuinely fresh cluster instead of reusing
  the data volumes.
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false` is intentional — topic creation and its
  settings (partitions, replication factor, configs) stay deliberate, and a mistyped
  topic name fails loudly instead of silently spawning a topic with broker defaults.
- Ports `29092`–`29094` (not the usual `9092`) are used for the host-facing listener so the
  lab doesn't collide with a Kafka broker you might already have running locally.
- Every published port is bound to `127.0.0.1` explicitly (`"127.0.0.1:PORT:PORT"`, not
  bare `"PORT:PORT"`). None of these services authenticate — Kafka Connect, Schema
  Registry, Kafka UI's dynamic config, and Grafana's anonymous-admin access are all
  meant for local-only use, and Docker Compose binds to every network interface by
  default if you omit the host IP.
- All images are pinned (version tag, or a digest for kafka-ui, which hasn't cut a
  tagged release since April 2024) rather than `latest`, so `docker compose up` pulls
  the same software every time instead of whatever shipped since this was last run.
