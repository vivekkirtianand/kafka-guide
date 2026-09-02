package com.example.orderpipeline.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.orderpipeline.TestClusters;
import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.MockConsumer;
import org.apache.kafka.clients.producer.MockProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;

class OrderConsumerPoisonTest {

    private static final TopicPartition P0 = new TopicPartition(OrderConsumer.TOPIC, 0);
    private static final String DLT = OrderConsumer.TOPIC + ".DLT";

    private static ConsumerRecord<String, String> good(long offset, String orderId) {
        OrderEvent e = new OrderEvent(orderId, "alice", "coffee", 1, 1_000, Instant.parse("2026-01-02T03:04:05Z"));
        return new ConsumerRecord<>(OrderConsumer.TOPIC, 0, offset, "alice", OrderEventJson.toJson(e));
    }

    private static ConsumerRecord<String, String> poison(long offset) {
        return new ConsumerRecord<>(OrderConsumer.TOPIC, 0, offset, "alice", "{ not valid json");
    }

    @SafeVarargs
    private static MockConsumer<String, String> mockWith(ConsumerRecord<String, String>... records) {
        MockConsumer<String, String> mock = new MockConsumer<>("earliest");
        mock.subscribe(List.of(OrderConsumer.TOPIC));
        mock.rebalance(List.of(P0));
        mock.updateBeginningOffsets(Map.of(P0, 0L));
        for (ConsumerRecord<String, String> r : records) {
            mock.addRecord(r);
        }
        return mock;
    }

    private static MockProducer<String, String> newDltProducer() {
        return new MockProducer<>(
                TestClusters.withTopic(DLT, 1), true, null, new StringSerializer(), new StringSerializer());
    }

    @Test
    void propagateStopsOnThePoisonRecordAndLeavesTheOffsetUncommitted() {
        MockConsumer<String, String> mock = mockWith(good(0, "ord-1"), poison(1), good(2, "ord-2"));
        OrderConsumer consumer = new OrderConsumer(mock, PoisonPolicy.propagate());

        assertThrows(RuntimeException.class,
                () -> consumer.runOnce(Duration.ofMillis(10), event -> { }));

        // The good record before the poison was handled, but nothing was committed — the
        // next poll would hand back the same batch, poison and all.
        assertTrue(mock.committed(Set.of(P0)).isEmpty() || mock.committed(Set.of(P0)).get(P0) == null);
    }

    @Test
    void skipDropsThePoisonRecordAndCommitsPastIt() {
        MockConsumer<String, String> mock = mockWith(good(0, "ord-1"), poison(1), good(2, "ord-2"));

        List<String> handled = new ArrayList<>();
        new OrderConsumer(mock, PoisonPolicy.skip())
                .runOnce(Duration.ofMillis(10), e -> handled.add(e.orderId()));

        assertEquals(List.of("ord-1", "ord-2"), handled);
        assertEquals(3L, mock.committed(Set.of(P0)).get(P0).offset());
    }

    @Test
    void deadLetterCopiesTheRawRecordAndCommitsPastIt() {
        MockConsumer<String, String> mock = mockWith(good(0, "ord-1"), poison(1));
        MockProducer<String, String> dlt = newDltProducer();

        List<String> handled = new ArrayList<>();
        new OrderConsumer(mock, PoisonPolicy.deadLetter(dlt, DLT))
                .runOnce(Duration.ofMillis(10), e -> handled.add(e.orderId()));

        assertEquals(List.of("ord-1"), handled);
        List<ProducerRecord<String, String>> sent = dlt.history();
        assertEquals(1, sent.size());
        assertEquals(DLT, sent.get(0).topic());
        assertEquals("{ not valid json", sent.get(0).value());
        assertEquals(2L, mock.committed(Set.of(P0)).get(P0).offset());
    }

    @Test
    void aFailureInTheHandlerItselfStillPropagates() {
        // The poison policy is only for records that won't parse. A well-formed event whose
        // processing blows up is a different bug and must not be swallowed.
        MockConsumer<String, String> mock = mockWith(good(0, "ord-1"));

        assertThrows(IllegalStateException.class,
                () -> new OrderConsumer(mock, PoisonPolicy.skip())
                        .runOnce(Duration.ofMillis(10), e -> {
                            throw new IllegalStateException("downstream is down");
                        }));
    }
}
