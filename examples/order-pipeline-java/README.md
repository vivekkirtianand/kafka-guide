# order-pipeline-java

A tiny Kafka producer and consumer in plain Java, built for **Module 3 — Build a producer
and consumer**. It is the smallest thing that is still a real client: it connects to a
broker, sends structured events to a topic, reads them back in a poll loop, and commits
offsets deliberately.

```
ProducerApp ──▶  orders topic  ──▶ ConsumerApp
   OrderEvent  →  JSON bytes    →  OrderEvent
              key = customerId
```

Everything runs against the broker you already start in **[Lab A](../../local-cluster-lab/)
or Lab B** — this project adds no infrastructure of its own.

## What's here

| Path | What it is |
|--|--|
| `shared/OrderEvent.java` | The event: an immutable `record` with a compact constructor that rejects bad data. |
| `shared/OrderEventJson.java` | JSON ⇄ `OrderEvent`. One definition of the wire format, used by both sides. |
| `producer/OrderProducer.java` | Wraps a `KafkaProducer`, keys each event by `customerId`, `acks=all` + idempotence. |
| `producer/ProducerApp.java` | `main()` — sends demo orders and exits (4 by default; pass a count as the 2nd arg). |
| `consumer/OrderConsumer.java` | The poll-process-commit loop. Manual commit, at-least-once. Logs rebalances; routes un-parseable records to a `PoisonPolicy`. |
| `consumer/PoisonPolicy.java` | What to do with a record that won't parse: `propagate` (stop), `skip`, or `deadLetter`. |
| `consumer/ConsumerApp.java` | `main()` — prints each order until Ctrl-C. 3rd arg picks the poison policy. |
| `producer/PoisonProducerApp.java` | `main()` — sends good orders plus one malformed record, to exercise the policies. |
| `src/test/**` | Unit tests using `MockProducer` / `MockConsumer` — **no broker required**. |

## Prerequisites

- **A JDK to launch the Gradle wrapper.** The pinned Gradle (9.1.0) runs on Java 17–25;
  any JDK in that range works. The build then *compiles and tests* against a **Java 21**
  toolchain — if you don't have a JDK 21, Gradle downloads one the first time (via the
  `foojay-resolver` plugin). The `.java-version` file pins 21 for tools that read it
  (jenv, asdf), and CI installs Temurin 21.
- **A running broker** for the `run` tasks (not for `build`/`test`). Start one with Lab A:

  ```bash
  docker run -d --name kafka-lab-a -p 9092:9092 apache/kafka:4.0.2
  docker exec kafka-lab-a /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1
  ```

## Build and test

```bash
./gradlew build
```

Compiles both apps and runs all unit tests. This needs **no Kafka broker** — the tests
drive `MockProducer` and `MockConsumer` in memory.

## Run it against a broker

Two terminals, broker already up with an `orders` topic:

```bash
# terminal 1 — start the consumer (Ctrl-C to stop it)
./gradlew runConsumer

# terminal 2 — send the demo orders
./gradlew run
```

The consumer prints four orders. It's a fresh group, so it reads from the start of the
topic whether you start it before or after producing; run it first to watch them arrive
live. Two orders are for `alice`; because the key is the customer id, both `alice` records
are on the same partition and always print in send order.

### Point at Lab B instead

Lab B's brokers publish `localhost:29092`, `29093`, `29094`:

```bash
./gradlew run          --args="localhost:29092"
./gradlew runConsumer  --args="localhost:29092 order-pipeline-demo"
```

### See a consumer group split the work

Run **two** consumers with the **same** group id (`--args="localhost:9092 team-a"`) in two
terminals, then produce again: the three partitions are divided between the two instances
(each logs `rebalance: … assigned`), and each partition is read by exactly one of them. Give
them **different** group ids and both get every record.

## Failure drills

`OrderConsumer` takes a `PoisonPolicy` for records it can't parse. `PoisonProducerApp` sends
a good order, then a malformed record, then another good order (all keyed `alice`, so on one
partition in that order) to trigger it:

```bash
./gradlew runProducerPoison                                     # good, poison, good

./gradlew runConsumer                                           # propagate (default): stops on the bad record, stays stuck on restart
./gradlew runConsumer --args="localhost:9092 team-a skip"       # logs and drops it, commits past it
./gradlew runConsumer --args="localhost:9092 team-a deadletter" # copies it to orders.DLT (with dlt.origin.* headers), commits past it
```

`deadletter` **waits** for the `orders.DLT` write to be acknowledged before it lets the
source offset advance — if that write fails, the poison record is redelivered, not lost. An
unknown policy name is rejected rather than silently treated as `propagate`. A `null` value
and the JSON literal `null` both count as poison (they parse, but there's no event).

To see **at-least-once** redelivery, slow the handler so the batch is still in flight when
you interrupt it:

```bash
./gradlew run --args="localhost:9092 200"     # a batch to chew through
SLOW_MS=200 ./gradlew runConsumer             # 200 ms per record
# kill -9 it (or close the terminal) after a few print, then re-run — the whole poll batch
# is redelivered: the orders you'd already handled print again, the rest for the first time
```

## Design choices (and where they change later)

| Choice | Why | Later |
|--|--|--|
| Value is JSON in a `String` | Keeps serialization visible — you can `kafka-console-consumer.sh` the topic and read it. | **Module 5** swaps in Avro + Schema Registry. |
| `acks=all` + `enable.idempotence=true` | The safe default for a pipeline you care about; no silent loss, no duplicates on retry. | Module 4 covers the delivery-guarantee trade-offs. |
| Manual `commitSync()` after the batch | At-least-once: a crash mid-batch reprocesses, never skips. | The **Failure drills** above make the trade-off bite. |
| `PoisonPolicy` is `propagate` by default | The naive "no handling" behaviour, so you feel why `skip` / `deadLetter` exist. | A real service picks one deliberately and alerts on the dead-letter topic. |
| `customerId` as the key | Per-customer ordering; different customers stay parallelisable. | Module 4 goes deeper on keys and partitioning. |

## Troubleshooting

| Symptom | Fix |
|--|--|
| `./gradlew` downloads a JDK on first run | Expected — the Java 21 toolchain isn't on your machine. One-time. |
| `Could not determine Java version` / Gradle refuses to start | Your launch JDK is newer than Gradle 9.1.0 supports (Java > 25). Run the wrapper with a JDK 17–25 (`JAVA_HOME=… ./gradlew …`, or let `.java-version` select it). |
| `Connection to node -1 could not be established` | No broker on that address. Start Lab A / Lab B, or pass the right `--args`. |
| Consumer prints nothing | Either the `orders` topic doesn't exist (create it, then re-run), or the group id you passed has already committed past those records — a **new** group id reads from the start (`auto.offset.reset=earliest`). |
| `UnknownTopicOrPartitionException` | The topic doesn't exist yet — create it first. |
