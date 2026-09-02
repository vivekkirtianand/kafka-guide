package com.example.orderpipeline.consumer;

import com.example.orderpipeline.shared.OrderEvent;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * What the consumer does with a record it cannot turn into an {@link OrderEvent} — a
 * "poison" record: malformed JSON, or a value that fails {@code OrderEvent}'s own checks.
 *
 * <p>Three built-in choices, each a real trade-off:
 * <ul>
 *   <li>{@link #propagate()} — rethrow. The poll loop stops on the bad record and, on
 *       restart, gets it again: the partition is stuck. This is what you get if you write
 *       no handling at all.
 *   <li>{@link #skip()} — log it and move on. The partition keeps flowing, but the record
 *       is gone with nothing to show for it.
 *   <li>{@link #deadLetter(Producer, String)} — copy the raw bytes to a separate topic,
 *       then move on. Nothing is lost; someone can inspect or replay the dead-letter topic
 *       later.
 * </ul>
 *
 * <p>Note this only covers records that fail to <em>parse</em>. An exception thrown by your
 * own processing of a well-formed event is a different problem and still propagates.
 */
@FunctionalInterface
public interface PoisonPolicy {

    Logger LOG = LoggerFactory.getLogger(PoisonPolicy.class);

    /** Handle one un-parseable record. An implementation may rethrow to stop the consumer. */
    void onPoison(ConsumerRecord<String, String> record, RuntimeException cause);

    /** Rethrow the parse failure — the poll loop stops here. */
    static PoisonPolicy propagate() {
        return (record, cause) -> {
            throw cause;
        };
    }

    /** Log the bad record and carry on. The offset is committed past it. */
    static PoisonPolicy skip() {
        return (record, cause) -> LOG.warn(
                "skipping poison record at {}-{} offset {}: {}",
                record.topic(), record.partition(), record.offset(), cause.getMessage());
    }

    /** Copy the raw key and value to {@code deadLetterTopic}, then carry on. */
    static PoisonPolicy deadLetter(Producer<String, String> deadLetters, String deadLetterTopic) {
        return (record, cause) -> {
            deadLetters.send(new ProducerRecord<>(deadLetterTopic, record.key(), record.value()));
            LOG.warn("dead-lettered poison record from {}-{} offset {} to {}: {}",
                    record.topic(), record.partition(), record.offset(), deadLetterTopic, cause.getMessage());
        };
    }
}
