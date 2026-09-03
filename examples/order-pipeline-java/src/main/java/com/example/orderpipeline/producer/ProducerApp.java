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
 * Sends demo orders and exits. Point it at whichever lab broker is running:
 *
 * <pre>
 *   ./gradlew run                              # 4 orders to localhost:9092 (Lab A)
 *   ./gradlew run --args="localhost:29092"     # 4 orders to Lab B's kafka-1 listener
 *   ./gradlew run --args="localhost:9092 500"  # 500 orders — enough to interrupt a consumer mid-stream
 * </pre>
 *
 * The orders cycle through four customers; two of the first four share a customer ("alice")
 * so the consumer side can show that same-key records keep their relative order.
 *
 * <p>{@code producer.send(...)} is asynchronous — it hands back a {@link Future} and returns
 * before the broker has acknowledged anything. This app blocks on every {@code Future} after
 * flushing so a rejected record fails the run loudly instead of printing "Sent N orders".
 */
public final class ProducerApp {

    private static final List<OrderEvent> TEMPLATES = List.of(
            new OrderEvent("t", "alice", "coffee-beans-1kg", 2, 2_400, Instant.EPOCH),
            new OrderEvent("t", "bob", "oat-milk-1l", 6, 9_000, Instant.EPOCH),
            new OrderEvent("t", "alice", "ceramic-mug", 1, 1_800, Instant.EPOCH),
            new OrderEvent("t", "carol", "pour-over-filter", 3, 1_500, Instant.EPOCH));

    private ProducerApp() {
    }

    public static void main(String[] args) throws InterruptedException {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";
        int count = args.length > 1 ? Integer.parseInt(args[1]) : 4;

        List<OrderEvent> orders = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            OrderEvent t = TEMPLATES.get(i % TEMPLATES.size());
            orders.add(new OrderEvent(orderId(), t.customerId(), t.item(), t.quantity(), t.amountCents(), Instant.now()));
        }

        int sent = 0;
        try (OrderProducer producer = new OrderProducer(bootstrapServers)) {
            List<Future<RecordMetadata>> acks = new ArrayList<>();
            for (OrderEvent event : orders) {
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

        System.out.printf("Sent %d/%d orders to %s%n", sent, count, bootstrapServers);
        if (sent != count) {
            System.exit(1);
        }
    }

    private static String orderId() {
        return "ord-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
