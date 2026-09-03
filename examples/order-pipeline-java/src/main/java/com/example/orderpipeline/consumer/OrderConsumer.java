package com.example.orderpipeline.consumer;

import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Properties;
import java.util.function.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runs the consumer poll loop for the {@code orders} topic. Each record's value is parsed
 * back into an {@link OrderEvent} and handed to the caller's handler; offsets are committed
 * only after a batch is fully handled, so processing is at-least-once.
 *
 * <p>A record that will not parse is passed to the {@link PoisonPolicy} (default:
 * {@link PoisonPolicy#propagate()}). {@link #subscribe()} logs partition assignment and
 * revocation so a running group's rebalances are visible.
 *
 * <p>{@link #runOnce} is a single poll-process-commit and is what the unit tests drive with
 * a {@code MockConsumer}. {@link #run} loops {@code runOnce} until {@link #stop()} — wire
 * that to a shutdown hook (see {@code ConsumerApp}).
 */
public final class OrderConsumer implements AutoCloseable {

    /** The one topic this example uses. */
    public static final String TOPIC = "orders";

    private static final Logger log = LoggerFactory.getLogger(OrderConsumer.class);

    private final org.apache.kafka.clients.consumer.Consumer<String, String> consumer;
    private final PoisonPolicy poisonPolicy;
    private volatile boolean running = true;

    public OrderConsumer(String bootstrapServers, String groupId) {
        this(bootstrapServers, groupId, PoisonPolicy.propagate());
    }

    public OrderConsumer(String bootstrapServers, String groupId, PoisonPolicy poisonPolicy) {
        this(new KafkaConsumer<>(baseConfig(bootstrapServers, groupId)), poisonPolicy);
    }

    OrderConsumer(org.apache.kafka.clients.consumer.Consumer<String, String> consumer) {
        this(consumer, PoisonPolicy.propagate());
    }

    OrderConsumer(org.apache.kafka.clients.consumer.Consumer<String, String> consumer, PoisonPolicy poisonPolicy) {
        this.consumer = consumer;
        this.poisonPolicy = poisonPolicy;
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

    /** Subscribe to the topic, logging assignment and revocation as the group rebalances. */
    public void subscribe() {
        consumer.subscribe(List.of(TOPIC), new ConsumerRebalanceListener() {
            @Override
            public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
                if (!partitions.isEmpty()) {
                    log.info("rebalance: {} revoked", partitions);
                }
            }

            @Override
            public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
                log.info("rebalance: {} assigned", partitions);
            }
        });
    }

    /**
     * One poll: parse and hand off every record (a parse failure goes to the
     * {@link PoisonPolicy}), then commit if anything was read.
     *
     * @return how many records the poll returned
     */
    public int runOnce(Duration timeout, Consumer<OrderEvent> handler) {
        ConsumerRecords<String, String> records = consumer.poll(timeout);
        for (ConsumerRecord<String, String> record : records) {
            OrderEvent event;
            try {
                event = OrderEventJson.fromJson(record.value());
            } catch (RuntimeException parseFailure) {
                poisonPolicy.onPoison(record, parseFailure);
                continue;
            }
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
