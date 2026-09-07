import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// examples/order-pipeline-java/ is the Java producer/consumer scaffold for Module 3
// (Phase 4a). It has its own Gradle build and CI job; these checks lock in the wiring so a
// careless edit to the build config or the CI workflow is caught by the Node suite too.

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, "examples/order-pipeline-java", p), "utf8");

describe("order-pipeline-java scaffold", () => {
  it("pins the Gradle wrapper to a checksummed distribution", () => {
    const props = read("gradle/wrapper/gradle-wrapper.properties");
    expect(props).toMatch(/distributionUrl=.*gradle-[\d.]+-bin\.zip/);
    expect(props).toMatch(/distributionSha256Sum=[0-9a-f]{64}/);
  });

  it("pins its dependency versions and targets the Java 21 toolchain", () => {
    const build = read("build.gradle.kts");
    expect(build).toMatch(/JavaLanguageVersion\.of\(21\)/);
    expect(build).toMatch(/val kafkaVersion = "4\.\d+\.\d+"/);
    expect(build).toMatch(/org\.apache\.kafka:kafka-clients:\$kafkaVersion/);
    // MockProducer/MockConsumer ship in kafka-clients — no separate test dependency.
    expect(build).toMatch(/junit-bom/);
  });

  it("wires Kafka Streams (Module 8) — the library, the test-utils, and a run task", () => {
    const build = read("build.gradle.kts");
    expect(build).toMatch(/org\.apache\.kafka:kafka-streams:\$kafkaVersion/);
    expect(build).toMatch(/org\.apache\.kafka:kafka-streams-test-utils:\$kafkaVersion/);
    expect(build).toMatch(/register<JavaExec>\("runStreams"\)/);
    expect(build).toMatch(/streams\.OrderTotalsApp/);

    for (const f of [
      "src/main/java/com/example/orderpipeline/streams/OrderTotalsTopology.java",
      "src/main/java/com/example/orderpipeline/streams/OrderTotalsApp.java",
      "src/test/java/com/example/orderpipeline/streams/OrderTotalsTopologyTest.java",
    ]) {
      expect(read(f).length).toBeGreaterThan(0);
    }
  });

  it("the topology reads orders, folds amountCents per customer, writes order-totals", () => {
    const topo = read("src/main/java/com/example/orderpipeline/streams/OrderTotalsTopology.java");
    expect(topo).toMatch(/DEFAULT_ORDERS_TOPIC = "orders"/);
    expect(topo).toMatch(/DEFAULT_TOTALS_TOPIC = "order-totals"/);
    expect(topo).toMatch(/\.aggregate\(/);
    expect(topo).toMatch(/runningTotal \+ amountCents/);
    // a value that won't parse is dropped, not fatal
    expect(topo).toMatch(/catch \(RuntimeException/);

    const test = read("src/test/java/com/example/orderpipeline/streams/OrderTotalsTopologyTest.java");
    expect(test).toMatch(/TopologyTestDriver/);
    expect(test).toMatch(/TestInputTopic|TestOutputTopic/);
  });

  it("OrderTotalsApp fails loudly — a fatal ERROR state exits non-zero, not 0", () => {
    const app = read("src/main/java/com/example/orderpipeline/streams/OrderTotalsApp.java");
    // the state listener records the crash and main exits non-zero on that path
    expect(app).toMatch(/State\.ERROR/);
    expect(app).toMatch(/crashed\.set\(true\)/);
    expect(app).toMatch(/crashed\.get\(\)[\s\S]{0,120}System\.exit\(1\)/);
    // an unhandled stream-thread exception shuts the client down rather than limping on
    expect(app).toMatch(/setUncaughtExceptionHandler/);
  });

  it("ships the producer, consumer, shared and test sources", () => {
    for (const f of [
      "src/main/java/com/example/orderpipeline/shared/OrderEvent.java",
      "src/main/java/com/example/orderpipeline/shared/OrderEventJson.java",
      "src/main/java/com/example/orderpipeline/producer/OrderProducer.java",
      "src/main/java/com/example/orderpipeline/producer/ProducerApp.java",
      "src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java",
      "src/main/java/com/example/orderpipeline/consumer/ConsumerApp.java",
      "src/main/java/com/example/orderpipeline/consumer/PoisonPolicy.java",
      "src/main/java/com/example/orderpipeline/producer/PoisonProducerApp.java",
      "src/test/java/com/example/orderpipeline/shared/OrderEventJsonTest.java",
      "src/test/java/com/example/orderpipeline/producer/OrderProducerTest.java",
      "src/test/java/com/example/orderpipeline/consumer/OrderConsumerTest.java",
      "src/test/java/com/example/orderpipeline/consumer/OrderConsumerPoisonTest.java",
    ]) {
      expect(read(f).length).toBeGreaterThan(0);
    }
  });

  it("keys records by customerId and commits offsets manually", () => {
    const producer = read("src/main/java/com/example/orderpipeline/producer/OrderProducer.java");
    expect(producer).toMatch(/new ProducerRecord<>\(topic, event\.customerId\(\)/);
    expect(producer).toMatch(/ACKS_CONFIG, "all"/);
    expect(producer).toMatch(/ENABLE_IDEMPOTENCE_CONFIG, true/);
    // an explicit topic can be passed (Lab E points the producer at a scratch topic)
    expect(producer).toMatch(/OrderProducer\(String bootstrapServers, String topic\)/);
    expect(read("src/main/java/com/example/orderpipeline/producer/ProducerApp.java"))
      .toMatch(/args\.length > 2 \? args\[2\] : OrderProducer\.TOPIC/);

    const consumer = read("src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java");
    expect(consumer).toMatch(/ENABLE_AUTO_COMMIT_CONFIG, false/);
    expect(consumer).toMatch(/commitSync\(\)/);
  });

  it("has a poison-record policy (propagate / skip / dead-letter) and a rebalance listener", () => {
    const policy = read("src/main/java/com/example/orderpipeline/consumer/PoisonPolicy.java");
    expect(policy).toMatch(/static PoisonPolicy propagate\(\)/);
    expect(policy).toMatch(/static PoisonPolicy skip\(\)/);
    expect(policy).toMatch(/static PoisonPolicy deadLetter\(/);

    const consumer = read("src/main/java/com/example/orderpipeline/consumer/OrderConsumer.java");
    expect(consumer).toMatch(/poisonPolicy\.onPoison\(/);
    expect(consumer).toMatch(/ConsumerRebalanceListener/);

    expect(read("build.gradle.kts")).toMatch(/runProducerPoison/);
  });

  it("is wired into CI as its own job", () => {
    const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/verify-order-pipeline-java:/);
    expect(ci).toMatch(/working-directory: examples\/order-pipeline-java/);
    expect(ci).toMatch(/actions\/setup-java@v4/);
    expect(ci).toMatch(/java-version: "21"/);
    expect(ci).toMatch(/\.\/gradlew build/);
  });
});
