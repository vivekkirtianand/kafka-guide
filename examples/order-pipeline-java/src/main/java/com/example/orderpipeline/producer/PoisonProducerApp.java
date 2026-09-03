package com.example.orderpipeline.producer;

import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Instant;
import java.util.Properties;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;

/**
 * Sends two good orders and one malformed record, all keyed {@code "alice"} so they land on
 * one partition in send order. Feed this to {@code ConsumerApp} to see each
 * {@link com.example.orderpipeline.consumer.PoisonPolicy} in action: with the default
 * (propagate) the consumer stops on the bad record; with {@code skip} or {@code deadletter}
 * it gets past it.
 *
 * <pre>
 *   ./gradlew runProducerPoison
 *   ./gradlew runProducerPoison --args="localhost:29092"
 * </pre>
 */
public final class PoisonProducerApp {

    private static final String TOPIC = "orders";

    private PoisonProducerApp() {
    }

    public static void main(String[] args) throws Exception {
        String bootstrapServers = args.length > 0 ? args[0] : "localhost:9092";

        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");

        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            send(producer, new OrderEvent("ord-good-1", "alice", "coffee-beans-1kg", 2, 2_400, Instant.now()));
            // Not JSON — OrderEventJson.fromJson will throw when the consumer reads this.
            producer.send(new ProducerRecord<>(TOPIC, "alice", "{ this is not a valid order }")).get();
            send(producer, new OrderEvent("ord-good-2", "alice", "ceramic-mug", 1, 1_800, Instant.now()));
        }

        System.out.printf("Sent 2 good orders and 1 poison record (key \"alice\") to %s%n", bootstrapServers);
    }

    private static void send(KafkaProducer<String, String> producer, OrderEvent event) throws Exception {
        producer.send(new ProducerRecord<>(TOPIC, event.customerId(), OrderEventJson.toJson(event))).get();
    }
}
