package com.example.orderpipeline.consumer;

import java.time.Duration;
import java.util.Properties;
import java.util.Set;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.ByteArraySerializer;
import org.apache.kafka.common.serialization.StringSerializer;

/**
 * Consumes the {@code orders} topic and prints each order until interrupted:
 *
 * <pre>
 *   ./gradlew runConsumer                                                # localhost:9092, group "order-pipeline-demo"
 *   ./gradlew runConsumer --args="localhost:29092 reporting"             # different broker and group
 *   ./gradlew runConsumer --args="localhost:9092 team-a skip"            # skip records that won't parse
 *   ./gradlew runConsumer --args="localhost:9092 team-a deadletter"      # route them to orders.DLT instead
 * </pre>
 *
 * Run it in two terminals with the same group to watch partitions split between the two
 * instances (each logs its `rebalance: … assigned`); run it with different groups to watch
 * both get every record.
 */
public final class ConsumerApp {

    private static final Set<String> POLICIES = Set.of("propagate", "skip", "deadletter");

    private ConsumerApp() {
    }

    public static void main(String[] args) {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";
        String groupId = args.length > 1 ? args[1] : "order-pipeline-demo";
        String policyName = args.length > 2 ? args[2] : "propagate";

        if (!POLICIES.contains(policyName)) {
            System.err.printf("unknown poison policy '%s' — expected one of %s%n", policyName, POLICIES);
            System.exit(2);
        }

        Producer<String, byte[]> deadLetters =
                "deadletter".equals(policyName) ? new KafkaProducer<>(deadLetterConfig(bootstrapServers)) : null;
        PoisonPolicy poisonPolicy = switch (policyName) {
            case "skip" -> PoisonPolicy.skip();
            case "deadletter" -> PoisonPolicy.deadLetter(deadLetters, OrderConsumer.TOPIC + ".DLT");
            default -> PoisonPolicy.propagate();
        };

        OrderConsumer consumer = new OrderConsumer(bootstrapServers, groupId, poisonPolicy);
        // Ctrl-C -> stop() -> the poll loop unblocks and the consumer leaves the group cleanly.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            consumer.stop();
            if (deadLetters != null) {
                deadLetters.close();
            }
        }));

        System.out.printf("Consuming '%s' from %s as group '%s' (poison policy: %s) - Ctrl-C to stop%n",
                OrderConsumer.TOPIC, bootstrapServers, groupId, policyName);

        consumer.run(Duration.ofSeconds(1), event ->
                System.out.printf("  %-14s  %-8s  x%-3d  $%.2f%n",
                        event.orderId(), event.customerId(), event.quantity(), event.amountCents() / 100.0));
    }

    private static Properties deadLetterConfig(String bootstrapServers) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        return props;
    }
}
