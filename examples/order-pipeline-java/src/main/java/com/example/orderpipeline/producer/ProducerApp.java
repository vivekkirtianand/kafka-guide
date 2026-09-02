package com.example.orderpipeline.producer;

import com.example.orderpipeline.shared.OrderEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Sends a handful of demo orders and exits. Point it at whichever lab broker is running:
 *
 * <pre>
 *   ./gradlew run                              # localhost:9092  (Lab A)
 *   ./gradlew run --args="localhost:29092"     # Lab B external listener for kafka-1
 * </pre>
 *
 * Two of the four orders share a customer ("alice") so the consumer side can show that
 * same-key records keep their relative order.
 */
public final class ProducerApp {

    private ProducerApp() {
    }

    public static void main(String[] args) {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";

        List<OrderEvent> demo = List.of(
                new OrderEvent(orderId(), "alice", "coffee-beans-1kg", 2, 2_400, Instant.now()),
                new OrderEvent(orderId(), "bob", "oat-milk-1l", 6, 9_000, Instant.now()),
                new OrderEvent(orderId(), "alice", "ceramic-mug", 1, 1_800, Instant.now()),
                new OrderEvent(orderId(), "carol", "pour-over-filter", 3, 1_500, Instant.now()));

        try (OrderProducer producer = new OrderProducer(bootstrapServers)) {
            for (OrderEvent event : demo) {
                producer.send(event);
            }
            producer.flush();
        }

        System.out.printf("Sent %d orders to %s%n", demo.size(), bootstrapServers);
    }

    private static String orderId() {
        return "ord-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
