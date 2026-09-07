package com.example.orderpipeline.streams;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.example.orderpipeline.shared.OrderEvent;
import com.example.orderpipeline.shared.OrderEventJson;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.apache.kafka.common.serialization.LongDeserializer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.apache.kafka.streams.KeyValue;
import org.apache.kafka.streams.StreamsConfig;
import org.apache.kafka.streams.TestInputTopic;
import org.apache.kafka.streams.TestOutputTopic;
import org.apache.kafka.streams.TopologyTestDriver;
import org.apache.kafka.streams.state.KeyValueStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Drives {@link OrderTotalsTopology} with a {@link TopologyTestDriver} — the whole topology,
 * record by record, entirely in memory with no Kafka broker.
 */
class OrderTotalsTopologyTest {

    private static final String ORDERS = "orders";
    private static final String TOTALS = "order-totals";

    private TopologyTestDriver driver;
    private TestInputTopic<String, String> orders;
    private TestOutputTopic<String, Long> totals;

    @BeforeEach
    void setUp() {
        Properties props = new Properties();
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-totals-test");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "dummy:9092");
        // Match the app: no record cache, so every input record emits its running total.
        props.put(StreamsConfig.STATESTORE_CACHE_MAX_BYTES_CONFIG, 0);

        driver = new TopologyTestDriver(OrderTotalsTopology.build(ORDERS, TOTALS), props);
        orders = driver.createInputTopic(ORDERS, new StringSerializer(), new StringSerializer());
        totals = driver.createOutputTopic(TOTALS, new StringDeserializer(), new LongDeserializer());
    }

    @AfterEach
    void tearDown() {
        driver.close();
    }

    private static String order(String customerId, long amountCents) {
        return OrderEventJson.toJson(new OrderEvent(
                "ord-" + amountCents, customerId, "widget", 1, amountCents,
                Instant.parse("2026-01-02T03:04:05Z")));
    }

    @Test
    void sumsAmountsPerCustomer() {
        orders.pipeInput("alice", order("alice", 1_000));
        orders.pipeInput("bob", order("bob", 500));
        orders.pipeInput("alice", order("alice", 250));

        // readKeyValuesToMap keeps the last value seen per key — the final running total.
        assertEquals(Map.of("alice", 1_250L, "bob", 500L), totals.readKeyValuesToMap());
    }

    @Test
    void emitsARunningTotalForEveryInputOrder() {
        orders.pipeInput("alice", order("alice", 1_000));
        orders.pipeInput("alice", order("alice", 250));
        orders.pipeInput("alice", order("alice", 5));

        assertEquals(
                List.of(
                        new KeyValue<>("alice", 1_000L),
                        new KeyValue<>("alice", 1_250L),
                        new KeyValue<>("alice", 1_255L)),
                totals.readKeyValuesToList());
    }

    @Test
    void dropsRecordsThatWontParseWithoutBreakingTheAggregate() {
        orders.pipeInput("alice", order("alice", 1_000));
        orders.pipeInput("alice", "not-json");
        orders.pipeInput("alice", order("alice", 250));

        assertEquals(Map.of("alice", 1_250L), totals.readKeyValuesToMap());
    }

    @Test
    void keepsEachCustomerTotalInAQueryableStateStore() {
        orders.pipeInput("alice", order("alice", 1_000));
        orders.pipeInput("carol", order("carol", 99));
        orders.pipeInput("alice", order("alice", 1));

        KeyValueStore<String, Long> store = driver.getKeyValueStore(OrderTotalsTopology.STORE_NAME);
        assertEquals(1_001L, store.get("alice"));
        assertEquals(99L, store.get("carol"));
        assertNull(store.get("dave"));
    }
}
