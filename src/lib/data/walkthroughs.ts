import { Walkthrough } from "@/lib/types";

// Module 3 — "Build a producer and consumer". A guided walk through
// examples/order-pipeline-java/, the scaffold built in Phase 4a. Every `code` block is a
// verbatim slice of the file it names; walkthroughs.test.ts reads the sources and fails the
// build if any snippet drifts.
export const producerConsumerWalkthrough: Walkthrough = {
  slug: "order-pipeline-java-walkthrough",
  title: "Build a producer and consumer",
  summary:
    "Read the smallest Kafka client that is still real: a producer that sends keyed order events to a topic, and a consumer that reads them back in a poll–process–commit loop. The code is in examples/order-pipeline-java/; each lesson points at the lines that matter.",
  repoPath: "examples/order-pipeline-java",
  cloneNote:
    "Open examples/order-pipeline-java/ in your editor (it ships in this repo) and `cd` into it — every `./gradlew` command below is run from that directory. You can follow every lesson by reading; lessons marked “Try it” also need Lab A running: one broker via `docker run -d --name kafka-lab-a -p 9092:9092 apache/kafka:4.0.2`, with an `orders` topic created (`docker exec kafka-lab-a /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1`).",
  lessons: [
    {
      id: "the-project",
      title: "The project and its dependencies",
      intro:
        "The whole client is one Gradle module. It needs surprisingly little: the Kafka client library, something to turn objects into JSON, and a logging binding.",
      file: "build.gradle.kts",
      code: `    implementation("org.apache.kafka:kafka-clients:$kafkaVersion")
    implementation("com.fasterxml.jackson.core:jackson-databind:$jacksonVersion")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:$jacksonVersion")
    implementation("org.slf4j:slf4j-api:$slf4jVersion")
    // A no-config SLF4J binding so the CLI apps print Kafka's client logs. Swap for
    // logback in a real service.
    runtimeOnly("org.slf4j:slf4j-simple:$slf4jVersion")`,
      points: [
        {
          term: "kafka-clients",
          detail:
            "The only Kafka dependency. It is the producer, consumer, and admin client — there is no server here. You point it at a broker someone else is running.",
        },
        {
          term: "jackson",
          detail:
            "Turns an OrderEvent into JSON text and back. Kafka itself never sees the object — only the bytes the serializer produces.",
        },
        {
          term: "slf4j-api vs slf4j-simple",
          detail:
            "The code compiles against the slf4j API; the binding (which decides where logs go) is chosen at runtime. slf4j-simple prints to stderr; a real service swaps in logback.",
        },
      ],
      run: "cd examples/order-pipeline-java && ./gradlew build",
      watchOut:
        "`./gradlew build` compiles everything and runs the unit tests — with no broker. The tests drive MockProducer / MockConsumer in memory. You only need a broker for the `run` tasks. Run this and every later `./gradlew` command from `examples/order-pipeline-java/`.",
    },
    {
      id: "the-event",
      title: "The event you'll send",
      intro:
        "An order pipeline moves order events. This record is the payload: it is serialized to JSON on the way onto the topic and parsed back on the way off.",
      file: "src/main/java/com/example/orderpipeline/shared/OrderEvent.java",
      code: `public record OrderEvent(
        String orderId,
        String customerId,
        String item,
        int quantity,
        long amountCents,
        Instant occurredAt) {

    public OrderEvent {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required");
        }`,
      points: [
        {
          term: "an immutable record",
          detail:
            "The value that goes on the topic. Records are a natural fit — an event happened, it does not change afterwards.",
        },
        {
          term: "customerId",
          detail:
            "This field becomes the Kafka message key (next lessons). Every event for one customer then lands on the same partition and is read back in order.",
        },
        {
          term: "the compact constructor",
          detail:
            "Rejects obviously-bad data (blank id, non-positive quantity) at construction, so a malformed event fails in the producer rather than sitting unreadable on the topic.",
        },
      ],
      watchOut:
        "This is a hand-written check, not a schema. Nothing stops a different producer writing a differently-shaped JSON object to `orders`. Module 5 (schemas) closes that gap.",
    },
    {
      id: "producer-config",
      title: "Configuring the producer",
      intro:
        "A KafkaProducer is built from a Properties map. Four settings matter here; the rest have sensible defaults.",
      file: "src/main/java/com/example/orderpipeline/producer/OrderProducer.java",
      code: `        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        // Wait for all in-sync replicas before a send is considered done. Lab A has one
        // broker so "all" is just that broker; Lab B has three.
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        // No duplicates on retry. Default in Kafka 4.0, set explicitly so the lesson can point at it.
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);`,
      points: [
        {
          term: "bootstrap.servers",
          detail:
            "A seed list, not the whole cluster. The client connects to one, learns the full broker list and partition leaders, then talks to the right broker directly.",
        },
        {
          term: "key.serializer / value.serializer",
          detail:
            "Kafka sends bytes. These classes convert your key and value to `byte[]`. Here both are StringSerializer — the value is already a JSON string by the time it reaches the producer.",
        },
        {
          term: "acks=all",
          detail:
            "The send is not acknowledged until every in-sync replica has the record. The durable choice. `acks=1` (leader only) or `acks=0` (fire and forget) trade safety for latency.",
        },
        {
          term: "enable.idempotence=true",
          detail:
            "The default in Kafka 4.0. The broker de-duplicates retries, so a network blip during send does not produce a double-write.",
        },
      ],
    },
    {
      id: "sending",
      title: "Sending a record",
      intro:
        "One method turns an OrderEvent into a ProducerRecord and hands it to the client. Note what it returns — and what it does not wait for.",
      file: "src/main/java/com/example/orderpipeline/producer/OrderProducer.java",
      code: `        ProducerRecord<String, String> record =
                new ProducerRecord<>(TOPIC, event.customerId(), OrderEventJson.toJson(event));
        return producer.send(record, (metadata, exception) -> {
            if (exception != null) {
                log.error("send failed for order {}", event.orderId(), exception);
            } else {
                log.info("order {} -> {}-{} @ offset {}",
                        event.orderId(), metadata.topic(), metadata.partition(), metadata.offset());
            }
        });`,
      points: [
        {
          term: "ProducerRecord(topic, key, value)",
          detail:
            "The key is `event.customerId()`. Same customer → same partition → read back in send order. Different customers spread across partitions and are processed in parallel.",
        },
        {
          term: "send() is asynchronous",
          detail:
            "It appends the record to an in-memory batch and returns a `Future<RecordMetadata>` right away. A background sender thread transmits batches on its own schedule — one may already be in flight, or none — so a returning send() tells you nothing about delivery. The Future is how you find out.",
        },
        {
          term: "the callback",
          detail:
            "Runs on the background thread when the broker acks (or the send finally fails). RecordMetadata tells you the partition and offset the record landed at.",
        },
      ],
    },
    {
      id: "making-sends-reliable",
      title: "Making sure the sends actually landed",
      intro:
        "Because send() is asynchronous, a program that just calls it in a loop and prints “done” can be lying. ProducerApp blocks on every ack before it claims success.",
      file: "src/main/java/com/example/orderpipeline/producer/ProducerApp.java",
      code: `            producer.flush();

            for (Future<RecordMetadata> ack : acks) {
                try {
                    ack.get();
                    sent++;
                } catch (ExecutionException e) {
                    System.err.println("send failed: " + e.getCause());
                }
            }`,
      points: [
        {
          term: "flush()",
          detail:
            "Blocks until every buffered record has been sent and acknowledged or has failed. After flush() returns, every Future is done.",
        },
        {
          term: "Future.get()",
          detail:
            "Returns the RecordMetadata on success, or throws ExecutionException wrapping the broker's error. This is where an authorization failure or an unknown topic actually surfaces.",
        },
        {
          term: "the exit code",
          detail:
            "ProducerApp prints `Sent N/4` and exits non-zero if N < 4 — so a failed send fails the command instead of scrolling past.",
        },
      ],
      run: "./gradlew run",
      watchOut:
        "Ignoring the Future is the single most common producer bug: the JVM exits before the background thread flushes, and records you “sent” were never written.",
    },
    {
      id: "serialization",
      title: "Serialization: object to bytes and back",
      intro:
        "The producer's value serializer is StringSerializer, so something has to turn an OrderEvent into a String first. That is this class — the one definition of the wire format, shared by both sides.",
      file: "src/main/java/com/example/orderpipeline/shared/OrderEventJson.java",
      code: `    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            // Write Instant as an ISO-8601 string, not a numeric epoch, so the records are
            // readable with \`kafka-console-consumer.sh\`.
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            // A newer producer may add fields; an older consumer should not fall over.
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();`,
      points: [
        {
          term: "two layers of conversion",
          detail:
            "OrderEventJson does OrderEvent ↔ String; Kafka's StringSerializer does String ↔ byte[]. The producer and consumer both go through OrderEventJson so the format has exactly one home.",
        },
        {
          term: "WRITE_DATES_AS_TIMESTAMPS disabled",
          detail:
            "occurredAt serializes as \"2026-01-02T03:04:05Z\", not 1767326645. You can read the raw records straight off the topic with the console consumer.",
        },
        {
          term: "FAIL_ON_UNKNOWN_PROPERTIES disabled",
          detail:
            "If a newer producer adds a `discountCode` field, this consumer ignores it instead of throwing. Forward compatibility, by hand.",
        },
      ],
      run: "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 4",
      watchOut:
        "Plain JSON has no enforced contract — a typo in a field name is a runtime surprise for the consumer. Module 5 puts a registered schema in front of this.",
    },
    {
      id: "consumer-config",
      title: "Configuring the consumer",
      intro:
        "The consumer's config mirrors the producer's, with two additions that define how a group reads: the group id and the reset policy.",
      file: "src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java",
      code: `        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        // First run of a brand-new group: start at the oldest record. After that the group
        // resumes from its committed offset and this setting is not consulted.
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        // Commit explicitly, after the batch is handled (see runOnce).
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);`,
      points: [
        {
          term: "group.id",
          detail:
            "Names the consumer group. It is the unit of both parallelism (partitions are split across the group) and progress tracking (offsets are committed per group).",
        },
        {
          term: "key/value deserializer",
          detail:
            "The exact mirror of the producer's serializers. Bytes → String; OrderEventJson then does String → OrderEvent inside the loop.",
        },
        {
          term: "auto.offset.reset=earliest",
          detail:
            "Only consulted when the group has no committed offset for a partition — a brand-new group, or one whose offsets aged out. An existing group always resumes from its commit and never rewinds because of this.",
        },
        {
          term: "enable.auto.commit=false",
          detail:
            "Turns off the background “commit on a timer” behaviour so the loop can commit deliberately, after processing.",
        },
      ],
    },
    {
      id: "the-poll-loop",
      title: "The poll loop",
      intro:
        "A consumer does its work in one shape: subscribe once, then call poll() over and over. poll() returns records and, just as importantly, keeps the consumer alive in its group.",
      file: "src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java",
      code: `        ConsumerRecords<String, String> records = consumer.poll(timeout);
        for (ConsumerRecord<String, String> record : records) {
            OrderEvent event = OrderEventJson.fromJson(record.value());
            handler.accept(event);
            log.info("processed {} (partition {}, offset {})",
                    event.orderId(), record.partition(), record.offset());
        }`,
      points: [
        {
          term: "poll(timeout)",
          detail:
            "Returns whatever records are ready, up to a batch (max.poll.records, 500 by default). An empty batch after `timeout` is normal, not an error.",
        },
        {
          term: "poll does more than fetch",
          detail:
            "It is where the consumer completes a rebalance, takes up new partition assignments, and runs your rebalance-listener callbacks. Heartbeats are separate — a background thread sends them (heartbeat.interval.ms). poll()'s own deadline is max.poll.interval.ms (5 min): miss it and the coordinator treats your handler as stuck and revokes your partitions.",
        },
        {
          term: "deserialize per record",
          detail:
            "record.value() is the JSON string; OrderEventJson.fromJson turns it back into an OrderEvent before your handler sees it.",
        },
      ],
      run: "./gradlew runConsumer",
    },
    {
      id: "offsets-and-commit",
      title: "Offsets and committing",
      intro:
        "An offset is the consumer's bookmark in a partition. When you commit it, you are telling Kafka “this group has processed everything up to here.” When you commit decides your delivery guarantee.",
      file: "src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java",
      code: `        if (!records.isEmpty()) {
            consumer.commitSync();
        }
        return records.count();`,
      points: [
        {
          term: "commit after processing",
          detail:
            "This code processes the whole batch, then commits. If it crashes mid-batch, the uncommitted records are redelivered next run — at-least-once. Nothing is skipped.",
        },
        {
          term: "the other order is at-most-once",
          detail:
            "Commit first, then process, and a crash loses the in-flight batch forever. Rarely what you want.",
        },
        {
          term: "commitSync blocks",
          detail:
            "It waits for the broker to confirm the commit and retries on retriable errors. commitAsync is faster but you handle failures yourself.",
        },
      ],
      watchOut:
        "The default (enable.auto.commit=true) commits inside poll(), and it commits the batch the *previous* poll() returned. In this loop that batch is already fully handled, so nothing is skipped — auto-commit would be safe here. It stops being safe once processing outlives one loop turn: hand a record to another thread or another poll() and auto-commit can mark it done before that work finishes, and a crash then skips it. Committing by hand keeps “processed” and “committed” in lockstep and lets you choose the moment.",
    },
    {
      id: "consumer-groups",
      title: "Consumer groups: scaling the read side",
      intro:
        "ConsumerApp takes the group id as an argument so you can run the same program several ways and watch how the group behaves.",
      file: "src/main/java/com/example/orderpipeline/consumer/ConsumerApp.java",
      code: `        OrderConsumer consumer = new OrderConsumer(bootstrapServers, groupId);`,
      points: [
        {
          term: "same group id → split the partitions",
          detail:
            "Run two instances with group `team-a` against a 3-partition topic and Kafka gives one instance two partitions and the other one. Each partition has exactly one reader in the group at a time — but delivery is still at-least-once, so a crash or a rebalance can hand a record to whichever instance picks the partition up next.",
        },
        {
          term: "more instances than partitions",
          detail:
            "A 4th instance in the same group sits idle — a partition has exactly one owner within a group.",
        },
        {
          term: "different group id → everyone gets everything",
          detail:
            "Group `reporting` and group `fulfilment` each receive every record. This is how one topic feeds several independent consumers (fan-out).",
        },
        {
          term: "rebalance",
          detail:
            "Adding or removing an instance makes the group pause and redistribute partitions. Brief, but real — your handler should tolerate seeing a partition again after one.",
        },
      ],
      run: './gradlew runConsumer --args="localhost:9092 team-a"',
    },
    {
      id: "graceful-shutdown",
      title: "Graceful shutdown",
      intro:
        "A consumer that is killed abruptly leaves its group without telling anyone, and the group stalls until a timeout. One shutdown hook avoids that.",
      file: "src/main/java/com/example/orderpipeline/consumer/ConsumerApp.java",
      code: `        Runtime.getRuntime().addShutdownHook(new Thread(consumer::stop));`,
      points: [
        {
          term: "stop() calls consumer.wakeup()",
          detail:
            "wakeup() is the one KafkaConsumer method that is safe to call from another thread. It makes the in-progress poll() throw WakeupException.",
        },
        {
          term: "run() catches WakeupException",
          detail:
            "When the flag says “stopping”, the loop swallows the exception, breaks, and closes the consumer in its finally block.",
        },
        {
          term: "close() leaves the group cleanly",
          detail:
            "It sends a leave-group request, so Kafka rebalances the partitions to the other instances immediately — instead of waiting ~45s (session.timeout.ms) for a missing heartbeat.",
        },
      ],
      run: "./gradlew runConsumer",
      watchOut:
        "Without the hook, Ctrl-C kills the JVM mid-poll. The other consumers in the group can't take over that partition until the coordinator times the dead member out.",
    },
  ],
};
