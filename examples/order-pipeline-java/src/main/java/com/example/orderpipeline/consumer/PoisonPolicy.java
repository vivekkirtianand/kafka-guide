package com.example.orderpipeline.consumer;

import com.example.orderpipeline.shared.OrderEvent;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
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
 *   <li>{@link #deadLetter(Producer, String)} — copy the record to a separate topic and
 *       <em>wait for that write to be acknowledged</em> before returning, then move on.
 *       Nothing is lost; someone can inspect or replay the dead-letter topic later.
 * </ul>
 *
 * <p>This only covers records that fail to <em>parse</em>. An exception thrown by your own
 * processing of a well-formed event is a different problem and still propagates.
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

    /**
     * Copy the record to {@code deadLetterTopic} — its key, value and headers, plus headers
     * recording where it came from and why — then block until the broker acknowledges that
     * write. If it fails, this throws and the source offset is <em>not</em> committed, so the
     * record is redelivered rather than lost.
     *
     * <p>Because this consumer deserializes values to {@code String}, the dead-lettered
     * value is the string form. That is lossless for text like JSON; a pipeline carrying
     * binary formats would dead-letter with a {@code byte[]} value deserializer instead.
     */
    static PoisonPolicy deadLetter(Producer<String, byte[]> deadLetters, String deadLetterTopic) {
        return (record, cause) -> {
            byte[] value = record.value() == null ? null : record.value().getBytes(StandardCharsets.UTF_8);
            ProducerRecord<String, byte[]> dead =
                    new ProducerRecord<>(deadLetterTopic, null, record.key(), value);
            for (Header h : record.headers()) {
                dead.headers().add(h);
            }
            dead.headers().add("dlt.origin.topic", bytes(record.topic()));
            dead.headers().add("dlt.origin.partition", bytes(Integer.toString(record.partition())));
            dead.headers().add("dlt.origin.offset", bytes(Long.toString(record.offset())));
            dead.headers().add("dlt.error", bytes(cause.toString()));
            try {
                deadLetters.send(dead).get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("interrupted writing to " + deadLetterTopic, e);
            } catch (Exception e) {
                throw new RuntimeException("dead-letter write to " + deadLetterTopic + " failed", e);
            }
            LOG.warn("dead-lettered poison record from {}-{} offset {} to {}: {}",
                    record.topic(), record.partition(), record.offset(), deadLetterTopic, cause.getMessage());
        };
    }

    private static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }
}
