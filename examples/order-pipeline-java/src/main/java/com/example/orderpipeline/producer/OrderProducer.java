package com.example.orderpipeline.producer;

import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Duration;
import java.util.Properties;
import java.util.concurrent.Future;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Turns an {@link OrderEvent} into a record on the {@code orders} topic. The key is the
 * customer id, so per-customer ordering holds while different customers stay parallelisable.
 *
 * <p>Two constructors: {@link #OrderProducer(String)} builds a real {@link KafkaProducer}
 * from a {@code host:port} bootstrap string; the package-private {@link #OrderProducer(Producer)}
 * takes any {@link Producer}, which is how the unit test passes a {@code MockProducer}.
 * Implements {@link AutoCloseable} so callers can use try-with-resources.
 */
public final class OrderProducer implements AutoCloseable {

    /** The one topic this example uses. */
    public static final String TOPIC = "orders";

    private static final Logger log = LoggerFactory.getLogger(OrderProducer.class);

    private final Producer<String, String> producer;

    public OrderProducer(String bootstrapServers) {
        this(new KafkaProducer<>(baseConfig(bootstrapServers)));
    }

    OrderProducer(Producer<String, String> producer) {
        this.producer = producer;
    }

    /** The safe-by-default producer config this example uses. Exposed for the lessons to inspect. */
    static Properties baseConfig(String bootstrapServers) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        // Wait for all in-sync replicas before a send is considered done. Lab A has one
        // broker so "all" is just that broker; Lab B has three.
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        // No duplicates on retry. Default in Kafka 4.0, set explicitly so the lesson can point at it.
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        return props;
    }

    /**
     * Sends one event. Returns the {@link Future} the caller can block on for the broker's
     * ack; the attached callback just logs where the record landed.
     */
    public Future<RecordMetadata> send(OrderEvent event) {
        ProducerRecord<String, String> record =
                new ProducerRecord<>(TOPIC, event.customerId(), OrderEventJson.toJson(event));
        return producer.send(record, (metadata, exception) -> {
            if (exception != null) {
                log.error("send failed for order {}", event.orderId(), exception);
            } else {
                log.info("order {} -> {}-{} @ offset {}",
                        event.orderId(), metadata.topic(), metadata.partition(), metadata.offset());
            }
        });
    }

    /** Block until every buffered record has been acknowledged or failed. */
    public void flush() {
        producer.flush();
    }

    @Override
    public void close() {
        producer.close(Duration.ofSeconds(5));
    }
}
