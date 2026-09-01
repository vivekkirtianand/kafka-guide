import { Lab } from "@/lib/types";

// Lab A — the smallest useful Kafka setup: one broker, one `docker run`, no checkout, no
// compose file. Everything the learner does goes through `docker exec` into that container,
// so there is no host-vs-container listener confusion to explain yet. The three-broker lab
// (replication, leader election, metrics) is Lab B.
export const labA: Lab = {
  slug: "lab-a-first-workflow",
  title: "Lab A — your first local Kafka workflow",
  summary:
    "Run a single Kafka broker in Docker and drive the whole produce-topic-consume-replay loop from the CLI. One broker is enough to see topics, partitions, keys, offsets, and consumer groups behave.",
  prerequisites: [
    "Docker Desktop (macOS/Windows) or Docker Engine (Linux) installed and running — check with `docker version`",
    "About 2 GB of free RAM and 2 GB of free disk for the Kafka image and its data",
    "A terminal — every command below is a single line you can copy and run",
  ],
  setup: [
    {
      command: "docker run -d --name kafka-lab-a -p 9092:9092 apache/kafka:4.0.2",
      note: "Starts one Kafka 4.0.2 broker in KRaft mode (no ZooKeeper) with its default single-node config. The first run pulls the image and can take a couple of minutes; after that it starts in a few seconds. Port 9092 is published so your own clients could connect too, but this lab only uses the CLI inside the container.",
    },
    {
      command: "docker ps --filter name=kafka-lab-a",
      note: "One row with STATUS starting `Up`. If the container is missing, re-run the previous command and read its output — a name clash (`kafka-lab-a` already exists) is the usual cause; `docker rm -f kafka-lab-a` clears it.",
    },
  ],
  steps: [
    {
      id: "broker-up",
      title: "Confirm the broker is accepting connections",
      intro:
        "Before anything else, check that the broker inside the container is actually serving requests — 'the container is Up' and 'Kafka is ready' are a few seconds apart.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 | head -1",
      expected: "localhost:9092 (id: 1 rack: null) -> (",
      observe:
        "Did you get that `id: 1` line, or a connection error? There is exactly one broker and its node id is 1 — every partition you create will be led by broker 1 because there is nowhere else for it to go.",
      commonError: {
        symptom:
          "`Connection to node -1 (localhost/127.0.0.1:9092) could not be established` or `Broker may not be available`.",
        cause:
          "The broker JVM is still starting up inside the container. `docker ps` shows `Up` as soon as the process launches, which is before Kafka is listening.",
        recovery:
          "Wait 10–20 seconds and run the command again. If it still fails after a minute, check `docker logs kafka-lab-a` for a startup error (a port 9092 clash on the host is the common one).",
      },
    },
    {
      id: "create-topic",
      title: "Create a topic",
      intro:
        "A topic is a named log. This one gets 3 partitions so you can watch records spread across them, and replication factor 1 because there is only one broker to hold a copy.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1",
      expected: "Created topic orders.",
      observe:
        "Why `--replication-factor 1` and not 3? Replication factor is how many brokers keep a copy of each partition, so it can never exceed the number of brokers. Lab B, with three brokers, is where replication factor 3 makes sense.",
      commonError: {
        symptom:
          "`InvalidReplicationFactorException: Unable to replicate the partition 3 time(s): The target replication factor of 3 ... larger than the number of available brokers: 1`.",
        cause: "You asked for more copies of each partition than there are brokers to hold them.",
        recovery: "Re-run with `--replication-factor 1`. One broker can only ever host one replica of a partition.",
      },
    },
    {
      id: "describe-topic",
      title: "Look at the topic's partitions",
      intro: "`--describe` prints the layout Kafka just created: partition count, replication factor, and one line per partition.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders",
      expected:
        "Topic: orders\tTopicId: ...\tPartitionCount: 3\tReplicationFactor: 1\tConfigs:\n\tTopic: orders\tPartition: 0\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:\n\tTopic: orders\tPartition: 1\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:\n\tTopic: orders\tPartition: 2\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:",
      observe:
        "Every partition shows `Leader: 1`, `Replicas: 1`, `Isr: 1`. With one broker there is one leader for everything and the in-sync replica set is just that broker. In Lab B these three columns move around as brokers stop and start.",
    },
    {
      id: "produce-no-key",
      title: "Produce a few records with no key",
      intro:
        "Pipe three lines into the console producer. `docker exec -i` keeps stdin open so the pipe reaches the process inside the container.",
      command:
        "printf 'first\\nsecond\\nthird\\n' | docker exec -i kafka-lab-a /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders",
      expected: "(no output — the command reads the three lines, sends them, and exits back to your prompt)",
      observe:
        "The producer prints nothing on success. That is normal for Kafka CLI tools — silence means the send was accepted. You confirm it worked by consuming, next.",
      commonError: {
        symptom: "The command hangs with a blinking cursor and never returns, or prints `the input device is not a TTY`.",
        cause: "The `-i` flag is missing from `docker exec`, so the piped lines never reach the producer inside the container.",
        recovery: "Press Ctrl-C and re-run with `docker exec -i`. The `-i` (interactive) flag is what forwards stdin.",
      },
    },
    {
      id: "consume-from-beginning",
      title: "Consume the records back",
      intro:
        "Read the topic from the start. `--timeout-ms 5000` makes the consumer exit after 5 seconds of no new records instead of waiting forever.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --timeout-ms 5000",
      expected: "first\nsecond\nthird\nProcessed a total of 3 messages",
      observe:
        "Did the three lines come back in the order you sent them? They might not. Kafka only orders records within a single partition, and with no key these three were free to land on different partitions. The console consumer reads partition by partition, not in send order.",
      commonError: {
        symptom: "`[...] org.apache.kafka.common.errors.TimeoutException` is printed after the messages.",
        cause: "Not an error here — that is just how `--timeout-ms` ends the consumer once no new records arrive. The `Processed a total of 3 messages` line above it is what matters.",
        recovery: "Nothing to fix. If you saw fewer than 3 messages, re-run the produce step and check for a typo in the topic name.",
      },
    },
    {
      id: "consume-show-partition",
      title: "See which partition each record landed on",
      intro: "Same consumer, now asking it to print the partition and key alongside each value.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --timeout-ms 5000 --property print.partition=true --property print.key=true",
      expected:
        "Partition:2\tnull\tfirst\nPartition:0\tnull\tsecond\nPartition:1\tnull\tthird\nProcessed a total of 3 messages",
      observe:
        "The key column is `null` for every record, and the partitions differ (your exact numbers will vary). With no key, the producer spreads records across partitions on its own. So what decides the partition when you *do* provide a key?",
    },
    {
      id: "produce-with-key",
      title: "Produce records with a key",
      intro:
        "Turn on key parsing and use `:` as the separator, then send three records — two for `west`, one for `east`.",
      command:
        "printf 'west:order A\\nwest:order B\\neast:order C\\n' | docker exec -i kafka-lab-a /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --property parse.key=true --property key.separator=:",
      expected: "(no output — three keyed records sent)",
      observe:
        "You now have 6 records in the topic: 3 unkeyed from before and 3 keyed. The next step shows where the keyed ones went.",
      commonError: {
        symptom: "Records show up later with keys like `west` glued onto the value, e.g. `west	west:order A`.",
        cause: "`--property parse.key=true` or `--property key.separator=:` was missing, so the whole line was treated as the value.",
        recovery:
          "Re-send with both properties. To clean up the malformed records you would recreate the topic (`kafka-topics.sh --delete --topic orders` then create it again).",
      },
    },
    {
      id: "verify-key-partition",
      title: "Confirm same key → same partition",
      intro: "Read everything back with key and partition shown.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --timeout-ms 5000 --property print.partition=true --property print.key=true",
      expected:
        "Partition:2\tnull\tfirst\nPartition:0\tnull\tsecond\nPartition:1\tnull\tthird\nPartition:1\twest\torder A\nPartition:1\twest\torder B\nPartition:0\teast\torder C\nProcessed a total of 3 messages\n(6 records total; your partition numbers will differ but both `west` records share one)",
      observe:
        "Both `west` records are on the same partition, in send order. `east` may be on a different one. Kafka hashes the key and takes it modulo the partition count, so a given key always maps to the same partition — that is the mechanism behind per-key ordering.",
      commonError: {
        symptom: "Only the `Processed a total of 0 messages` line prints.",
        cause: "`--from-beginning` was left off, so the consumer only looked for records newer than the moment it started.",
        recovery: "Add `--from-beginning`. Without it a fresh consumer with no committed offset starts at the end of the log.",
      },
    },
    {
      id: "consumer-group-lag",
      title: "Read as a consumer group and check lag",
      intro:
        "Run a consumer with a named `--group`, so Kafka records how far it has read, then ask Kafka to describe that group.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group order-readers --from-beginning --timeout-ms 5000 && docker exec kafka-lab-a /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group order-readers",
      expected:
        "Processed a total of 6 messages\n\nGROUP\tTOPIC\tPARTITION\tCURRENT-OFFSET\tLOG-END-OFFSET\tLAG\tCONSUMER-ID\tHOST\tCLIENT-ID\norder-readers\torders\t0\t2\t2\t0\t-\t-\t-\norder-readers\torders\t1\t3\t3\t0\t-\t-\t-\norder-readers\torders\t2\t1\t1\t0\t-\t-\t-",
      observe:
        "`LAG` is `CURRENT-OFFSET` subtracted from `LOG-END-OFFSET` per partition — how many records the group has not read yet. It is 0 now because the consumer read to the end before it timed out. The `CONSUMER-ID` is `-` because the consumer already exited; lag is stored server-side and outlives the process.",
    },
    {
      id: "reset-and-replay",
      title: "Reset the group's offsets and replay",
      intro:
        "Move the group's committed position back to the start of every partition, then read again — the same records come back.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group order-readers --topic orders --reset-offsets --to-earliest --execute",
      expected:
        "GROUP\tTOPIC\tPARTITION\tNEW-OFFSET\norder-readers\torders\t0\t0\norder-readers\torders\t1\t0\norder-readers\torders\t2\t0\n(re-run the group consumer from the previous step and all 6 records are delivered again)",
      observe:
        "No records were deleted or re-sent. The log still holds the same 6 records at the same offsets — all you changed is the number the group calls 'where I am'. That is what replay is: rewind the reader, not the data.",
      commonError: {
        symptom: "`Error: Assignments can only be reset if the group 'order-readers' is inactive, but the current state is Stable.`",
        cause: "A consumer in that group is still running (or a previous run has not fully left the group yet).",
        recovery:
          "Make sure no `kafka-console-consumer.sh --group order-readers` is running, wait a few seconds for the session to expire, and re-run the reset.",
      },
    },
  ],
  teardown: [
    {
      command: "docker rm -f kafka-lab-a",
      note: "Stops and removes the container. Lab A mounts no volume, so the broker's log lived inside the container — this deletes the `orders` topic and every record with it.",
    },
    {
      command: "docker image rm apache/kafka:4.0.2",
      note: "Optional. Only if you want the ~450 MB image off your disk. Leave it and the next lab starts instantly.",
    },
  ],
  teardownWarning:
    "Lab A is disposable by design — there is no volume, so removing the container erases everything you created, and that is fine. Lab B is different: it mounts named volumes precisely so your cluster's data survives a restart, and there the destructive command is `docker compose down -v`, which deletes those volumes. Get used to the distinction now: removing a container is not always the same as deleting its data.",
};

export const labs: Lab[] = [labA];
