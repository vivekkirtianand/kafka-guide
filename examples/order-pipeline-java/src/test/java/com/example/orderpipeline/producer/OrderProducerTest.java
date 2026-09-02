package com.example.orderpipeline.producer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.orderpipeline.TestClusters;
import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Future;
import org.apache.kafka.clients.producer.MockProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;

class OrderProducerTest {

    private static MockProducer<String, String> newMock() {
        // null partitioner + known metadata -> every record lands on partition 0, which is
        // fine here: these tests assert on the key and value, not the partition.
        return new MockProducer<>(
                TestClusters.withTopic(OrderProducer.TOPIC, 3),
                true,
                null,
                new StringSerializer(),
                new StringSerializer());
    }

    private static OrderEvent order(String id, String customer) {
        return new OrderEvent(id, customer, "coffee", 1, 1_000, Instant.parse("2026-01-02T03:04:05Z"));
    }

    @Test
    void sendsOneRecordPerEventOnTheOrdersTopic() {
        MockProducer<String, String> mock = newMock();

        try (OrderProducer producer = new OrderProducer(mock)) {
            producer.send(order("ord-1", "alice"));
            producer.send(order("ord-2", "bob"));
        }

        List<ProducerRecord<String, String>> history = mock.history();
        assertEquals(2, history.size());
        assertEquals(OrderProducer.TOPIC, history.get(0).topic());
    }

    @Test
    void keysEachRecordByCustomerId() {
        MockProducer<String, String> mock = newMock();

        try (OrderProducer producer = new OrderProducer(mock)) {
            producer.send(order("ord-1", "alice"));
            producer.send(order("ord-2", "bob"));
            producer.send(order("ord-3", "alice"));
        }

        assertEquals(
                List.of("alice", "bob", "alice"),
                mock.history().stream().map(ProducerRecord::key).toList());
    }

    @Test
    void putsTheEventAsJsonInTheRecordValue() {
        MockProducer<String, String> mock = newMock();
        OrderEvent event = order("ord-9", "carol");

        try (OrderProducer producer = new OrderProducer(mock)) {
            producer.send(event);
        }

        String value = mock.history().get(0).value();
        assertTrue(value.contains("\"orderId\":\"ord-9\""), value);
        assertEquals(event, OrderEventJson.fromJson(value));
    }

    @Test
    void flushCompletesPendingSends() throws Exception {
        // autoComplete=false: a send stays pending until flush() completes it.
        MockProducer<String, String> mock = new MockProducer<>(
                TestClusters.withTopic(OrderProducer.TOPIC, 3),
                false,
                null,
                new StringSerializer(),
                new StringSerializer());

        try (OrderProducer producer = new OrderProducer(mock)) {
            Future<RecordMetadata> ack = producer.send(order("ord-1", "alice"));
            assertFalse(ack.isDone(), "send should be pending before flush");

            producer.flush();
            assertTrue(ack.isDone(), "flush should complete the pending send");
            assertEquals(0, ack.get().partition());
        }
    }
}
