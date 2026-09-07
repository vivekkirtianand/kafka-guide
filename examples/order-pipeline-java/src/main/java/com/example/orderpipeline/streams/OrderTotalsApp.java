package com.example.orderpipeline.streams;

import java.time.Duration;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicBoolean;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.KafkaStreams;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.errors.StreamsUncaughtExceptionHandler;

/**
 * Runs {@link OrderTotalsTopology} against a real broker:
 *
 * <pre>
 *   ./gradlew runStreams                                  # localhost:9092, orders -> order-totals
 *   ./gradlew runStreams --args="localhost:29092"         # Lab B's kafka-1 listener
 *   STREAMS_STATE_DIR=/tmp/streams-2 ./gradlew runStreams  # a second instance on the same machine
 * </pre>
 *
 * <p>There is no cluster to deploy — this is a plain JVM process. Scale it by starting more
 * copies with the same {@code application.id}: they form a consumer group, split the
 * partitions, and each keeps the state for the keys it owns. Stop one and the survivors
 * rebuild its state from the changelog topic and take over.
 */
public final class OrderTotalsApp {

    /** The consumer-group id, the internal-topic prefix, and the state-dir subfolder. */
    public static final String APPLICATION_ID = "order-totals-app";

    public static void main(String[] args) {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";
        String ordersTopic = args.length > 1 ? args[1] : OrderTotalsTopology.DEFAULT_ORDERS_TOPIC;
        String totalsTopic = args.length > 2 ? args[2] : OrderTotalsTopology.DEFAULT_TOTALS_TOPIC;

        Topology topology = OrderTotalsTopology.build(ordersTopic, totalsTopic);
        KafkaStreams streams = new KafkaStreams(topology, config(bootstrapServers));

        CountDownLatch stopped = new CountDownLatch(1);
        AtomicBoolean crashed = new AtomicBoolean(false);

        // An unhandled exception on a stream thread shuts the whole client down (rather than
        // limping on with fewer threads), which surfaces as the ERROR state below.
        streams.setUncaughtExceptionHandler(
                exception -> StreamsUncaughtExceptionHandler.StreamThreadExceptionResponse.SHUTDOWN_CLIENT);
        streams.setStateListener((next, previous) -> {
            System.out.printf("state: %s -> %s%n", previous, next);
            if (next == KafkaStreams.State.ERROR) {
                crashed.set(true);
                stopped.countDown();
            }
        });
        // Ctrl-C -> close() -> the threads leave the group cleanly and flush their state.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            streams.close(Duration.ofSeconds(10));
            stopped.countDown();
        }));

        System.out.printf("Aggregating '%s' into per-customer totals on '%s' via %s "
                        + "(application.id=%s) - Ctrl-C to stop%n",
                ordersTopic, totalsTopic, bootstrapServers, APPLICATION_ID);
        streams.start();

        try {
            stopped.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // A crashed Streams client must not look like a clean shutdown to whatever ran this.
        if (crashed.get()) {
            System.err.println("Kafka Streams entered the ERROR state - see the stack trace above");
            System.exit(1);
        }
    }

    /** The Streams config this example uses. Package-private so the tests can read it. */
    static Properties config(String bootstrapServers) {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, APPLICATION_ID);
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        // The topology sets serdes per operation; these are the fallback for anything that
        // doesn't, and for internal topics.
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.StringSerde.class.getName());
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.StringSerde.class.getName());
        // Internal changelog / repartition topics: one replica is enough for a laptop lab.
        // A real cluster would use 3.
        props.put(StreamsConfig.REPLICATION_FACTOR_CONFIG, 1);
        // Emit every running total. By default a record cache plus the 30s commit interval
        // collapse repeated updates to one key into a single downstream record — good for
        // throughput, confusing when you're watching a lab. Zero cache + a short commit
        // interval gives one output record per input order.
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0);
        props.put(StreamsConfig.COMMIT_INTERVAL_MS_CONFIG, 1_000);
        // Streams appends the application.id to this path. Override it (env var, forwarded by
        // the runStreams Gradle task) to run a second instance on the same machine — each
        // needs its own RocksDB directory or the second fails to take the lock.
        String stateDir = System.getenv("STREAMS_STATE_DIR");
        if (stateDir != null && !stateDir.isBlank()) {
            props.put(StreamsConfig.STATE_DIR_CONFIG, stateDir);
        }
        return props;
    }
}
