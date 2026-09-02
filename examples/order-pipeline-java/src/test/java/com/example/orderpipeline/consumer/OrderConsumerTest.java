package com.example.orderpipeline.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;

class OrderConsumerTest {

    private static final TopicPartition P0 = new TopicPartition(OrderConsumer.TOPIC, 0);

    private static ConsumerRecord<String, String> record(long offset, String customer, String orderId) {
        OrderEvent event = new OrderEvent(
                orderId, customer, "coffee", 1, 1_000, Instant.parse("2026-01-02T03:04:05Z"));
        return new ConsumerRecord<>(OrderConsumer.TOPIC, 0, offset, customer, OrderEventJson.toJson(event));
    }

    private static MockConsumer<String, String> subscribedMock() {
        MockConsumer<String, String> mock = new MockConsumer<>("earliest");
        mock.subscribe(List.of(OrderConsumer.TOPIC));
        mock.rebalance(List.of(P0));
        mock.updateBeginningOffsets(Map.of(P0, 0L));
        return mock;
    }

    @Test
    void parsesEachRecordBackIntoAnOrderEvent() {
        MockConsumer<String, String> mock = subscribedMock();
        mock.addRecord(record(0, "alice", "ord-1"));
        mock.addRecord(record(1, "bob", "ord-2"));

        List<OrderEvent> handled = new ArrayList<>();
        int count = new OrderConsumer(mock).runOnce(Duration.ofMillis(10), handled::add);

        assertEquals(2, count);
        assertEquals(List.of("ord-1", "ord-2"), handled.stream().map(OrderEvent::orderId).toList());
    }

    @Test
    void commitsOffsetsOnlyAfterHandlingTheBatch() {
        MockConsumer<String, String> mock = subscribedMock();
        mock.addRecord(record(0, "alice", "ord-1"));
        mock.addRecord(record(1, "alice", "ord-2"));

        new OrderConsumer(mock).runOnce(Duration.ofMillis(10), event -> { });

        // Next read for this group starts at offset 2.
        assertEquals(2L, mock.committed(Set.of(P0)).get(P0).offset());
    }

    @Test
    void doesNotCommitWhenThePollReturnsNothing() {
        MockConsumer<String, String> mock = subscribedMock();

        int count = new OrderConsumer(mock).runOnce(Duration.ofMillis(10), event -> { });

        assertEquals(0, count);
        assertTrue(mock.committed(Set.of(P0)).isEmpty()
                || mock.committed(Set.of(P0)).get(P0) == null);
    }

    @Test
    void preservesPerKeyOrderWithinAPartition() {
        MockConsumer<String, String> mock = subscribedMock();
        mock.addRecord(record(0, "alice", "ord-1"));
        mock.addRecord(record(1, "alice", "ord-2"));
        mock.addRecord(record(2, "alice", "ord-3"));

        List<String> seen = new ArrayList<>();
        new OrderConsumer(mock).runOnce(Duration.ofMillis(10), event -> seen.add(event.orderId()));

        assertEquals(List.of("ord-1", "ord-2", "ord-3"), seen);
    }
}
