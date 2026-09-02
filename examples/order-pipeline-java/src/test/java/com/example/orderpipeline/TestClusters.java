package com.example.orderpipeline;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.apache.kafka.common.Cluster;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.PartitionInfo;

/**
 * Minimal cluster metadata for {@code MockProducer}. A real producer learns a topic's
 * partition count from the broker; the mock needs it handed over.
 */
public final class TestClusters {

    private TestClusters() {
    }

    public static Cluster withTopic(String topic, int partitions) {
        Node node = new Node(0, "localhost", 9092);
        Node[] replicas = {node};
        List<PartitionInfo> parts = new ArrayList<>();
        for (int p = 0; p < partitions; p++) {
            parts.add(new PartitionInfo(topic, p, node, replicas, replicas));
        }
        return new Cluster("test-cluster", List.of(node), parts, Set.of(), Set.of());
    }
}
