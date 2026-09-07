plugins {
    java
    application
}

group = "com.example.orderpipeline"
version = "0.1.0"

// The course targets Kafka 4.0. kafka-clients 4.0 needs Java 11+; Java 21 is the current
// LTS and what CI installs. Set here as a toolchain so the build is reproducible regardless
// of the JDK on PATH.
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Pinned so a green build stays green. Bump deliberately, re-run the tests, note it in
// the module's "Reviewed against" line.
val kafkaVersion = "4.0.0"
val jacksonVersion = "2.18.2"
val slf4jVersion = "2.0.16"
val junitVersion = "5.11.4"

dependencies {
    implementation("org.apache.kafka:kafka-clients:$kafkaVersion")
    implementation("com.fasterxml.jackson.core:jackson-databind:$jacksonVersion")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310:$jacksonVersion")
    implementation("org.slf4j:slf4j-api:$slf4jVersion")
    // A no-config SLF4J binding so the CLI apps print Kafka's client logs. Swap for
    // logback in a real service.
    runtimeOnly("org.slf4j:slf4j-simple:$slf4jVersion")
    // Kafka Streams (Module 8's aggregation app). Pulls kafka-clients transitively; pinned
    // to the same version as everything else.
    implementation("org.apache.kafka:kafka-streams:$kafkaVersion")

    testImplementation(platform("org.junit:junit-bom:$junitVersion"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    // MockProducer / MockConsumer ship in the main kafka-clients jar, so no extra test dep.
    // TopologyTestDriver drives a Streams topology in memory, no broker — its own artifact.
    testImplementation("org.apache.kafka:kafka-streams-test-utils:$kafkaVersion")
}

application {
    // `./gradlew run` sends a batch of demo orders. The consumer has its own task below
    // because Gradle's `application` plugin only wires one main class.
    mainClass = "com.example.orderpipeline.producer.ProducerApp"
}

tasks.named<JavaExec>("run") {
    description = "Send a batch of demo order events. Override with --args=\"host:port [count] [topic]\"."
}

tasks.register<JavaExec>("runConsumer") {
    group = "application"
    description = "Consume order events until Ctrl-C. Override with --args=\"host:port groupId [propagate|skip|deadletter]\"."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "com.example.orderpipeline.consumer.ConsumerApp"
    // Forward SLOW_MS from the invoking shell. `System.getenv()` in a build script is
    // unreliable through the Gradle daemon; the provider API reads the real invocation env,
    // and this line puts it back on the forked JVM's environment.
    project.providers.environmentVariable("SLOW_MS").orNull?.let { environment("SLOW_MS", it) }
}

tasks.register<JavaExec>("runProducerPoison") {
    group = "application"
    description = "Send good orders plus one malformed record, to exercise the poison-record policies."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "com.example.orderpipeline.producer.PoisonProducerApp"
}

tasks.register<JavaExec>("runStreams") {
    group = "application"
    description = "Aggregate the orders topic into per-customer totals with Kafka Streams. " +
        "Override with --args=\"host:port [ordersTopic] [totalsTopic]\"."
    classpath = sourceSets["main"].runtimeClasspath
    mainClass = "com.example.orderpipeline.streams.OrderTotalsApp"
    // Forward STREAMS_STATE_DIR so a second instance can run on the same machine (Lab E).
    // Same provider-API reason as SLOW_MS above.
    project.providers.environmentVariable("STREAMS_STATE_DIR").orNull?.let { environment("STREAMS_STATE_DIR", it) }
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.add("-Xlint:all")
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
