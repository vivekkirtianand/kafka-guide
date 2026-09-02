package com.example.orderpipeline.consumer;

import java.time.Duration;

/**
 * Consumes the {@code orders} topic and prints each order until interrupted:
 *
 * <pre>
 *   ./gradlew runConsumer                                     # localhost:9092, group "order-pipeline-demo"
 *   ./gradlew runConsumer --args="localhost:29092 reporting"  # different broker and group
 * </pre>
 *
 * Run it in two terminals with the same group to watch partitions split between the two
 * instances; run it with different groups to watch both get every record.
 */
public final class ConsumerApp {

    private ConsumerApp() {
    }

    public static void main(String[] args) {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";
        String groupId = args.length > 1 ? args[1] : "order-pipeline-demo";

        OrderConsumer consumer = new OrderConsumer(bootstrapServers, groupId);
        // Ctrl-C -> stop() -> the poll loop unblocks and the consumer leaves the group cleanly.
        Runtime.getRuntime().addShutdownHook(new Thread(consumer::stop));

        System.out.printf("Consuming '%s' from %s as group '%s' - Ctrl-C to stop%n",
                OrderConsumer.TOPIC, bootstrapServers, groupId);

        consumer.run(Duration.ofSeconds(1), event ->
                System.out.printf("  %-14s  %-8s  x%-3d  $%.2f%n",
                        event.orderId(), event.customerId(), event.quantity(), event.amountCents() / 100.0));
    }
}
