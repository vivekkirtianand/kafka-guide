package com.example.orderpipeline.consumer;

import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Duration;
import java.util.List;
import java.util.Properties;
import java.util.function.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runs the consumer poll loop for the {@code orders} topic. Each record's value is parsed
 * back into an {@link OrderEvent} and handed to the caller's handler; offsets are committed
 * only after a batch is fully handled, so processing is at-least-once.
 *
 * <p>{@link #runOnce} is a single poll-process-commit and is what the unit test drives with
 * a {@code MockConsumer}. {@link #run} loops {@code runOnce} until {@link #stop()} — wire
 * that to a shutdown hook (see {@code ConsumerApp}).
 */
public final class OrderConsumer implements AutoCloseable {

    /** The one topic this example uses. */
    public static final String TOPIC = "orders";

    private static final Logger log = LoggerFactory.getLogger(OrderConsumer.class);

    private final org.apache.kafka.clients.consumer.Consumer<String, String> consumer;
    private volatile boolean running = true;

    public OrderConsumer(String bootstrapServers, String groupId) {
        this(new KafkaConsumer<>(baseConfig(bootstrapServers, groupId)));
    }

    OrderConsumer(org.apache.kafka.clients.consumer.Consumer<String, String> consumer) {
        this.consumer = consumer;
    }

    /** The consumer config this example uses. Exposed for the lessons to inspect. */
    static Properties baseConfig(String bootstrapServers, String groupId) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        // First run of a brand-new group: start at the oldest record. After that the group
        // resumes from its committed offset and this setting is not consulted.
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        // Commit explicitly, after the batch is handled (see runOnce).
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        return props;
    }

    /** Subscribe to the topic. Call once before the first {@link #runOnce}. */
    public void subscribe() {
        consumer.subscribe(List.of(TOPIC));
    }

    /**
     * One poll: parse and hand off every record, then commit if anything was read.
     *
     * @return how many records were handled this call
     */
    public int runOnce(Duration timeout, Consumer<OrderEvent> handler) {
        ConsumerRecords<String, String> records = consumer.poll(timeout);
        for (ConsumerRecord<String, String> record : records) {
            OrderEvent event = OrderEventJson.fromJson(record.value());
            handler.accept(event);
            log.info("processed {} (partition {}, offset {})",
                    event.orderId(), record.partition(), record.offset());
        }
        if (!records.isEmpty()) {
            consumer.commitSync();
        }
        return records.count();
    }

    /** Subscribe, then loop {@link #runOnce} until {@link #stop()}. Closes the consumer on exit. */
    public void run(Duration pollTimeout, Consumer<OrderEvent> handler) {
        subscribe();
        try {
            while (running) {
                runOnce(pollTimeout, handler);
            }
        } catch (WakeupException e) {
            if (running) {
                throw e; // a wakeup we didn't trigger
            }
        } finally {
            consumer.close();
        }
    }

    /** Ask {@link #run} to finish after the current poll. Safe to call from another thread. */
    public void stop() {
        running = false;
        consumer.wakeup();
    }

    @Override
    public void close() {
        consumer.close();
    }
}
