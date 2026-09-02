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
| `producer/ProducerApp.java` | `main()` — sends four demo orders and exits. |
| `consumer/OrderConsumer.java` | The poll-process-commit loop. Manual commit, at-least-once. |
| `consumer/ConsumerApp.java` | `main()` — prints each order until Ctrl-C. |
| `src/test/**` | Unit tests using `MockProducer` / `MockConsumer` — **no broker required**. |

## Prerequisites

- **A JDK.** The build declares a Java 21 toolchain; if your `java` is a different version
  Gradle downloads a matching JDK the first time (via the `foojay-resolver` plugin). CI
  installs Temurin 21.
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
# terminal 1 — start the consumer first so it sees every record
./gradlew runConsumer

# terminal 2 — send the demo orders
./gradlew run
```

The consumer prints four orders. Two of them are for `alice`; because the key is the
customer id, both `alice` records are on the same partition and always print in send order.

### Point at Lab B instead

Lab B's brokers publish `localhost:29092`, `29093`, `29094`:

```bash
./gradlew run          --args="localhost:29092"
./gradlew runConsumer  --args="localhost:29092 order-pipeline-demo"
```

### See a consumer group split the work

Run **two** consumers with the **same** group id (`--args="localhost:9092 team-a"`) in two
terminals, then produce again: the three partitions are divided between the two instances,
each record handled once. Give them **different** group ids and both get every record.

## Design choices (and where they change later)

| Choice | Why | Later |
|--|--|--|
| Value is JSON in a `String` | Keeps serialization visible — you can `kafka-console-consumer.sh` the topic and read it. | **Module 5** swaps in Avro + Schema Registry. |
| `acks=all` + `enable.idempotence=true` | The safe default for a pipeline you care about; no silent loss, no duplicates on retry. | Module 4 covers the delivery-guarantee trade-offs. |
| Manual `commitSync()` after the batch | At-least-once: a crash mid-batch reprocesses, never skips. | **Phase 4c** adds a poison-record exercise that makes the trade-off bite. |
| `customerId` as the key | Per-customer ordering; different customers stay parallelisable. | Module 4 goes deeper on keys and partitioning. |

## Troubleshooting

| Symptom | Fix |
|--|--|
| `./gradlew` downloads a JDK on first run | Expected — the Java 21 toolchain isn't on your machine. One-time. |
| `Connection to node -1 could not be established` | No broker on that address. Start Lab A / Lab B, or pass the right `--args`. |
| Consumer prints nothing | The `orders` topic doesn't exist yet, or you produced before subscribing. Create the topic, re-run the consumer, then produce. |
| `UnknownTopicOrPartitionException` | Same — create the topic first. |
