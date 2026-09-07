package com.example.orderpipeline.streams;

import com.example.orderpipeline.shared.OrderEventJson;
import java.util.List;
import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.common.utils.Bytes;
import org.apache.kafka.streams.StreamsBuilder;
import org.apache.kafka.streams.Topology;
import org.apache.kafka.streams.kstream.Consumed;
import org.apache.kafka.streams.kstream.Grouped;
import org.apache.kafka.streams.kstream.KStream;
import org.apache.kafka.streams.kstream.KTable;
import org.apache.kafka.streams.kstream.Materialized;
import org.apache.kafka.streams.kstream.Produced;
import org.apache.kafka.streams.state.KeyValueStore;

/**
 * The Kafka Streams topology for <b>Module 8 — Kafka Connect and Kafka Streams</b>: fold the
 * {@code orders} topic into a running total of cents spent per customer.
 *
 * <pre>
 *   orders (String key = customerId, JSON value)
 *     └─ flatMapValues  parse the JSON, keep amountCents (drop anything that won't parse)
 *     └─ groupByKey     re-group by the existing key (customerId)
 *     └─ aggregate      runningTotal + amountCents, kept in a state store
 *          → KTable<String, Long>  order-totals-store  (customerId → total cents)
 *     └─ toStream().to(order-totals)   one output record per input order
 * </pre>
 *
 * <p>The build is a pure function of the two topic names and holds no Kafka connection, so
 * {@code OrderTotalsTopologyTest} drives it with a {@code TopologyTestDriver} and no broker.
 * {@link OrderTotalsApp} is the {@code main()} that runs it against a real cluster.
 */
public final class OrderTotalsTopology {

    /** The topic of order events, written by {@code OrderProducer} / {@code ProducerApp}. */
    public static final String DEFAULT_ORDERS_TOPIC = "orders";

    /** The output topic: {@code customerId → total cents} as a serialized {@code Long}. */
    public static final String DEFAULT_TOTALS_TOPIC = "order-totals";

    /**
     * The state store that holds each customer's running total. Streams mirrors it to a
     * compacted changelog topic named {@code <application.id>-<STORE_NAME>-changelog}.
     */
    public static final String STORE_NAME = "order-totals-store";

    private OrderTotalsTopology() {
    }

    public static Topology build(String ordersTopic, String totalsTopic) {
        StreamsBuilder builder = new StreamsBuilder();

        KStream<String, String> orders =
                builder.stream(ordersTopic, Consumed.with(Serdes.String(), Serdes.String()));

        KTable<String, Long> totals = orders
                // A value that won't parse is dropped here rather than killing the stream
                // thread. A real pipeline routes it to a dead-letter topic (see Module 3's
                // PoisonPolicy) — the lesson here is the aggregation, so keep the unhappy
                // path a one-liner.
                .flatMapValues(OrderTotalsTopology::amountCentsOrNothing)
                // The records are already keyed by customerId, so this only re-declares the
                // serdes the aggregate needs; it does not repartition.
                .groupByKey(Grouped.with(Serdes.String(), Serdes.Long()))
                .aggregate(
                        () -> 0L,
                        (customerId, amountCents, runningTotal) -> runningTotal + amountCents,
                        Materialized.<String, Long, KeyValueStore<Bytes, byte[]>>as(STORE_NAME)
                                .withKeySerde(Serdes.String())
                                .withValueSerde(Serdes.Long()));

        totals.toStream().to(totalsTopic, Produced.with(Serdes.String(), Serdes.Long()));

        return builder.build();
    }

    private static Iterable<Long> amountCentsOrNothing(String json) {
        try {
            return List.of(OrderEventJson.fromJson(json).amountCents());
        } catch (RuntimeException notAnOrder) {
            return List.of();
        }
    }
}
