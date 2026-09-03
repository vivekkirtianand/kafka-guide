package com.example.orderpipeline.shared;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * JSON &harr; {@link OrderEvent}. The producer and consumer both go through here so the
 * wire format has exactly one definition.
 *
 * <p>This is deliberately plain: a shared {@link ObjectMapper} and two methods. Phase 5 of
 * the course swaps it for a schema-aware serializer (Avro + Schema Registry) and shows what
 * that buys you — for now the goal is to see bytes go onto the log and come back off.
 */
public final class OrderEventJson {

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            // Write Instant as an ISO-8601 string, not a numeric epoch, so the records are
            // readable with `kafka-console-consumer.sh`.
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            // A newer producer may add fields; an older consumer should not fall over.
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private OrderEventJson() {
    }

    public static String toJson(OrderEvent event) {
        try {
            return MAPPER.writeValueAsString(event);
        } catch (Exception e) {
            throw new IllegalArgumentException("could not serialize order event " + event.orderId(), e);
        }
    }

    public static OrderEvent fromJson(String json) {
        if (json == null) {
            throw new IllegalArgumentException("order event value was null (a tombstone?)");
        }
        OrderEvent event;
        try {
            event = MAPPER.readValue(json, OrderEvent.class);
        } catch (Exception e) {
            throw new IllegalArgumentException("could not parse order event: " + json, e);
        }
        if (event == null) {
            // The value was the JSON literal `null` — parses fine, but there is no event.
            throw new IllegalArgumentException("order event JSON was the literal null: " + json);
        }
        return event;
    }
}
