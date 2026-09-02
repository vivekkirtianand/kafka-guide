package com.example.orderpipeline.shared;

import java.time.Instant;

/**
 * One thing that happened to an order. This is the payload the pipeline puts on the
 * {@code orders} topic: serialized to JSON on the way in ({@link OrderEventJson}), parsed
 * back on the way out.
 *
 * <p>{@code customerId} is used as the Kafka message key (see {@code OrderProducer}), so
 * every event for one customer lands on the same partition and is read back in send order.
 * Events for different customers can be spread across partitions and processed in parallel.
 *
 * <p>The compact constructor rejects obviously-bad data early, so a malformed event fails
 * in the producer rather than sitting unreadable on the topic. Phase 5 of the course
 * replaces this hand-written check with a registered schema.
 */
public record OrderEvent(
        String orderId,
        String customerId,
        String item,
        int quantity,
        long amountCents,
        Instant occurredAt) {

    public OrderEvent {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required");
        }
        if (customerId == null || customerId.isBlank()) {
            throw new IllegalArgumentException("customerId is required");
        }
        if (item == null || item.isBlank()) {
            throw new IllegalArgumentException("item is required");
        }
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive, got " + quantity);
        }
        if (amountCents < 0) {
            throw new IllegalArgumentException("amountCents cannot be negative, got " + amountCents);
        }
        if (occurredAt == null) {
            throw new IllegalArgumentException("occurredAt is required");
        }
    }
}
