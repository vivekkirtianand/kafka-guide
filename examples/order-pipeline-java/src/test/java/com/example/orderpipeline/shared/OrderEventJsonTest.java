package com.example.orderpipeline.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrderEventJsonTest {

    private static final OrderEvent SAMPLE =
            new OrderEvent("ord-1", "alice", "ceramic-mug", 1, 1_800, Instant.parse("2026-01-02T03:04:05Z"));

    @Test
    void roundTripsThroughJson() {
        String json = OrderEventJson.toJson(SAMPLE);
        assertEquals(SAMPLE, OrderEventJson.fromJson(json));
    }

    @Test
    void writesInstantAsIsoString() {
        assertTrue(OrderEventJson.toJson(SAMPLE).contains("\"occurredAt\":\"2026-01-02T03:04:05Z\""),
                "occurredAt should serialize as an ISO-8601 string");
    }

    @Test
    void toleratesUnknownFieldsFromANewerProducer() {
        String json = "{\"orderId\":\"ord-9\",\"customerId\":\"bob\",\"item\":\"beans\","
                + "\"quantity\":2,\"amountCents\":2400,\"occurredAt\":\"2026-01-02T03:04:05Z\","
                + "\"discountCode\":\"LAUNCH\"}";
        OrderEvent parsed = OrderEventJson.fromJson(json);
        assertEquals("ord-9", parsed.orderId());
        assertEquals(2, parsed.quantity());
    }

    @Test
    void rejectsMalformedJson() {
        assertThrows(IllegalArgumentException.class, () -> OrderEventJson.fromJson("not json"));
    }

    @Test
    void rejectsAnEventThatViolatesTheCompactConstructor() {
        String badQuantity = "{\"orderId\":\"ord-1\",\"customerId\":\"alice\",\"item\":\"mug\","
                + "\"quantity\":0,\"amountCents\":1800,\"occurredAt\":\"2026-01-02T03:04:05Z\"}";
        assertThrows(IllegalArgumentException.class, () -> OrderEventJson.fromJson(badQuantity));
    }
}
