package com.example.orderpipeline.producer;

import com.example.orderpipeline.shared.OrderEvent;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import org.apache.kafka.clients.producer.RecordMetadata;

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
 *
 * <p>{@code producer.send(...)} is asynchronous — it hands back a {@link Future} and returns
 * before the broker has acknowledged anything. This app blocks on every {@code Future} after
 * flushing so a rejected record fails the run loudly instead of printing "Sent 4 orders".
 */
public final class ProducerApp {

    private ProducerApp() {
    }

    public static void main(String[] args) throws InterruptedException {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";

        List<OrderEvent> demo = List.of(
                new OrderEvent(orderId(), "alice", "coffee-beans-1kg", 2, 2_400, Instant.now()),
                new OrderEvent(orderId(), "bob", "oat-milk-1l", 6, 9_000, Instant.now()),
                new OrderEvent(orderId(), "alice", "ceramic-mug", 1, 1_800, Instant.now()),
                new OrderEvent(orderId(), "carol", "pour-over-filter", 3, 1_500, Instant.now()));

        int sent = 0;
        try (OrderProducer producer = new OrderProducer(bootstrapServers)) {
            List<Future<RecordMetadata>> acks = new ArrayList<>();
            for (OrderEvent event : demo) {
                acks.add(producer.send(event));
            }
            producer.flush();

            for (Future<RecordMetadata> ack : acks) {
                try {
                    ack.get();
                    sent++;
                } catch (ExecutionException e) {
                    System.err.println("send failed: " + e.getCause());
                }
            }
        }

        System.out.printf("Sent %d/%d orders to %s%n", sent, demo.size(), bootstrapServers);
        if (sent != demo.size()) {
            System.exit(1);
        }
    }

    private static String orderId() {
        return "ord-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
