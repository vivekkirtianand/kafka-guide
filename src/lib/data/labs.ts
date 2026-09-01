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
    "Docker Desktop (macOS/Windows) or Docker Engine (Linux), installed and running — check with `docker version`",
    "About 2 GB of free RAM and 2 GB of free disk for the Kafka image and its data",
    "A POSIX shell to paste the commands into: Terminal on macOS, any shell on Linux, or WSL / Git Bash on Windows. They use `docker exec`, single-quoted strings, and `printf` — Windows PowerShell and cmd need different quoting and have no `printf`, so run them under WSL or Git Bash there.",
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
      expected: "localhost:9092 (id: 1 rack: null isFenced: false) -> (\n(followed by a long list of API name/version ranges — `head -1` trims it to this line)",
      observe:
        "Did you get a line starting `localhost:9092 (id: 1`, or a connection error? There is exactly one broker and its node id is 1 — every partition you create will be led by broker 1 because there is nowhere else for it to go.",
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
        "Read the topic from the start. `--max-messages 3` stops the consumer once it has the three records, so there is no timeout to wait out; `--timeout-ms 20000` is just a backstop in case fewer than three were produced.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 3 --timeout-ms 20000",
      expected: "first\nsecond\nthird\nProcessed a total of 3 messages",
      observe:
        "All three came back, most likely in the order you sent them — with so few records they landed on one partition (the next step confirms that), and a single partition is always read in order. That order only holds *within* a partition, though. Across partitions Kafka makes no ordering promise at all: once records are spread over several partitions, the order a consumer hands them back in is undefined and need not match send order.",
      commonError: {
        symptom: "The command prints one or two lines then hangs, ending after 20s with `Processed a total of 2 messages` and a `TimeoutException`.",
        cause: "Fewer than three records reached the topic — usually a typo in the topic name on the produce step, so the records went to a different (auto-rejected or mis-named) topic.",
        recovery: "Re-run the produce step exactly, then this one. `docker exec kafka-lab-a /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list` shows which topics actually exist.",
      },
    },
    {
      id: "consume-show-partition",
      title: "See which partition each record landed on",
      intro: "Same consumer, now asking it to print the partition and key alongside each value.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 3 --timeout-ms 20000 --property print.partition=true --property print.key=true",
      expected:
        "Partition:1\tnull\tfirst\nPartition:1\tnull\tsecond\nPartition:1\tnull\tthird\nProcessed a total of 3 messages\n(your partition number will differ — the point is that all three share it)",
      observe:
        "All three records are on the same partition, and the key column is `null`. Without a key the producer does not round-robin record by record — it fills one partition per batch (this is 'sticky' partitioning) and only moves to another partition for a later batch. 'No key' means 'the producer chooses', not 'evenly spread'. So what happens when you *do* provide a key?",
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
        "You now have 6 records in the topic: 3 unkeyed from before and 3 keyed (2 for `west`, 1 for `east`). The next step shows where the keyed ones went.",
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
      intro: "Read all six records back with key and partition shown.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --max-messages 6 --timeout-ms 20000 --property print.partition=true --property print.key=true",
      expected:
        "Partition:0\teast\torder C\nPartition:1\twest\torder A\nPartition:1\twest\torder B\nPartition:2\tnull\tfirst\nPartition:2\tnull\tsecond\nPartition:2\tnull\tthird\nProcessed a total of 6 messages\n(your partition numbers will differ, and the order records from different partitions come back in is undefined — not necessarily send order. What is reliable: both `west` records sit on one partition in send order, and the three unkeyed records share a partition.)",
      observe:
        "Both `west` records are on one partition, in send order. With the default partitioner and a fixed partition count, Kafka hashes the key and takes it modulo the partition count (`murmur2(key) % partitionCount`), so a given key keeps resolving to the same partition — that is what gives you per-key ordering. It is not absolute: add partitions later and the mapping shifts, and an explicit partition or a custom partitioner overrides it.",
      commonError: {
        symptom: "The command hangs and ends after 20s with `Processed a total of 0 messages` and a `TimeoutException`.",
        cause: "`--from-beginning` was left off, so the consumer waited for six *new* records instead of reading the existing ones.",
        recovery: "Add `--from-beginning`. Without it a fresh consumer with no committed offset starts at the end of the log and only sees records produced after it connects.",
      },
    },
    {
      id: "consumer-group-lag",
      title: "Read as a consumer group and check lag",
      intro:
        "Run a consumer with a named `--group`, so Kafka records how far it has read, then ask Kafka to describe that group.",
      command:
        "docker exec kafka-lab-a /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group order-readers --from-beginning --max-messages 6 --timeout-ms 20000 && docker exec kafka-lab-a /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group order-readers",
      expected:
        "Processed a total of 6 messages\n\nGROUP\tTOPIC\tPARTITION\tCURRENT-OFFSET\tLOG-END-OFFSET\tLAG\tCONSUMER-ID\tHOST\tCLIENT-ID\norder-readers\torders\t0\t1\t1\t0\t-\t-\t-\norder-readers\torders\t1\t2\t2\t0\t-\t-\t-\norder-readers\torders\t2\t3\t3\t0\t-\t-\t-\n(the offsets per partition depend on where your records landed; they sum to 6, and every LAG is 0)",
      observe:
        "`LAG` is `CURRENT-OFFSET` subtracted from `LOG-END-OFFSET` per partition — how many records the group has not read yet. It is 0 because the consumer read every record. The `CONSUMER-ID` is `-` because the consumer already exited; the offsets are stored server-side and outlive the process.",
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

// Lab B — the three-broker cluster. Same CLI muscle memory as Lab A, but now replication,
// leader election, and ISR mean something: this is the smallest setup where stopping a broker
// is survivable and observable. Backed by the Docker Compose project in `local-cluster-lab/`.
export const labB: Lab = {
  slug: "lab-b-three-broker-cluster",
  title: "Lab B — the three-broker cluster",
  summary:
    "Bring up three Kafka brokers, a web UI, and Prometheus/Grafana, then do the things one broker cannot show you: replication factor 3, leader election when a broker dies, ISR shrink and recovery, and acks=all admission control.",
  platformNotes: [
    {
      platform: "macOS",
      note: "Docker Desktop. Raise the memory limit in Settings → Resources → Advanced to at least 4 GB — the default is often 2 GB and the brokers get OOM-killed mid-startup. Apple Silicon needs nothing special; every image here is multi-arch.",
    },
    {
      platform: "Windows (WSL 2)",
      note: "Install Docker Desktop with the WSL 2 backend, then work entirely inside a WSL 2 (Ubuntu) shell. Clone the repo into the Linux home directory (`~`), not `/mnt/c/...` — Compose bind mounts onto the Windows filesystem are slow enough to trip the broker health checks. Run every command from the WSL shell.",
    },
    {
      platform: "Linux",
      note: "Docker Engine plus the Compose plugin — the `docker compose` subcommand, not the older standalone `docker-compose` binary. Your user must be in the `docker` group (or prefix each command with `sudo`).",
    },
  ],
  resourceFloor:
    "Give Docker at least 4 GB of memory (6 GB is comfortable) and keep ~5 GB of free disk. The stack is three Kafka JVMs plus kafka-ui, Prometheus, and Grafana. Below ~4 GB the brokers fail to allocate their heap and the containers restart in a loop.",
  prerequisites: [
    "You have finished Lab A — the CLI commands here assume you have already produced and consumed once",
    "Docker and Docker Compose v2, with the memory limit raised per the platform note above",
    "git, to clone the repo that holds the Compose file",
    "A POSIX shell (macOS Terminal, a Linux shell, or WSL 2 on Windows)",
  ],
  setup: [
    {
      command: "git clone --depth 1 https://github.com/vivekkirtianand/kafka-guide.git",
      note: "Clones the guide repo. `--depth 1` skips history — you only need the working tree. If you already have it checked out, just `cd` into it and `git pull`.",
    },
    {
      command: "cd kafka-guide/local-cluster-lab && docker compose up -d",
      note: "Starts all six base services in the background. The first run pulls several images and can take a few minutes. `local-cluster-lab/README.md` documents every service and port.",
    },
  ],
  verify: {
    command: "./verify-lab.sh",
    note: "Checks that all three brokers report healthy and that every host port (29092–29094, 8080, 9090, 3001) is accepting connections. Re-run it any time the lab seems off; a failing check points you at the right section of the README's Troubleshooting list.",
  },
  steps: [
    {
      id: "brokers-healthy",
      title: "Confirm all three brokers are healthy",
      intro: "`docker compose ps` shows every service and its health. All three `kafka-*` services should reach `healthy` within 30–60 seconds.",
      command: "docker compose ps",
      expected:
        "NAME                     SERVICE     STATUS                   PORTS\nkafka-lab-kafka-1        kafka-1     Up 45 seconds (healthy)  0.0.0.0:29092->9092/tcp\nkafka-lab-kafka-2        kafka-2     Up 45 seconds (healthy)  0.0.0.0:29093->9092/tcp\nkafka-lab-kafka-3        kafka-3     Up 45 seconds (healthy)  0.0.0.0:29094->9092/tcp\nkafka-lab-kafka-ui       kafka-ui    Up 30 seconds            0.0.0.0:8080->8080/tcp\n... (prometheus, grafana)",
      observe:
        "Do all three brokers say `(healthy)`? If one is stuck `(health: starting)` for more than a minute or keeps restarting, that is almost always Docker memory — see the README's Troubleshooting section.",
      commonError: {
        symptom: "One or more `kafka-*` rows cycle between `Up` and `Restarting`, or sit at `(health: starting)` forever.",
        cause: "Docker does not have enough memory for three broker JVMs, so the OS kills them as they start.",
        recovery: "Raise Docker's memory limit to at least 4 GB (Docker Desktop → Settings → Resources), then `docker compose down && docker compose up -d`.",
      },
    },
    {
      id: "replicated-topic",
      title: "Create a topic with replication factor 3",
      intro: "This is the topic one broker could not give you: three copies of every partition, one per broker.",
      command:
        "docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --create --topic orders --partitions 3 --replication-factor 3",
      expected: "Created topic orders.",
      observe:
        "The CLI runs inside the container and points at `kafka-1:19092` — the in-network listener, not the host-facing `localhost:29092`. Any of the three brokers works as the entry point.",
      commonError: {
        symptom: "`InvalidReplicationFactorException` mentioning `larger than the number of available brokers`.",
        cause: "Fewer than three brokers are actually up — check `docker compose ps` again.",
        recovery: "Wait for all three to be `(healthy)`, then re-run.",
      },
    },
    {
      id: "describe-replicated",
      title: "See leaders, replicas, and ISR spread across brokers",
      intro: "`--describe` now has something to say: each partition has a leader on one broker and followers on the other two.",
      command:
        "docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic orders",
      expected:
        "Topic: orders\tPartitionCount: 3\tReplicationFactor: 3\tConfigs: min.insync.replicas=2\n\tTopic: orders\tPartition: 0\tLeader: 1\tReplicas: 1,2,3\tIsr: 1,2,3\n\tTopic: orders\tPartition: 1\tLeader: 2\tReplicas: 2,3,1\tIsr: 2,3,1\n\tTopic: orders\tPartition: 2\tLeader: 3\tReplicas: 3,1,2\tIsr: 3,1,2\n(your leader assignment will vary; the point is that leadership is spread, not all on one broker)",
      observe:
        "`Replicas` lists all three brokers for every partition; `Isr` (in-sync replicas) currently matches it. `min.insync.replicas=2` is a topic config here — remember that number for the broker-stop step.",
    },
    {
      id: "produce-consume-keyed",
      title: "Produce keyed records and see where they land",
      intro: "Same keyed-producer pattern as Lab A, then read it back with the partition shown.",
      command:
        "printf 'west:A\\nwest:B\\neast:C\\n' | docker exec -i kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic orders --property parse.key=true --property key.separator=:\ndocker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka-1:19092 --topic orders --from-beginning --max-messages 3 --timeout-ms 20000 --property print.partition=true --property print.key=true",
      expected:
        "Partition:1\twest\tA\nPartition:1\twest\tB\nPartition:2\teast\tC\nProcessed a total of 3 messages\n(partition numbers vary; both `west` records share one)",
      observe:
        "Same behaviour as Lab A — the key decides the partition. What is different now is that the partition's leader is on a specific broker, and that is the broker you will stop next.",
    },
    {
      id: "stop-leader",
      title: "Stop the broker leading a partition",
      intro:
        "Find a partition's leader from the describe output, then stop that broker and describe again. Substitute the broker number you actually saw leading.",
      command:
        "docker compose stop kafka-2\ndocker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic orders",
      expected:
        "\tTopic: orders\tPartition: 1\tLeader: 3\tReplicas: 2,3,1\tIsr: 3,1\n(the partition kafka-2 was leading has a new leader, and 2 has dropped out of every Isr list)",
      observe:
        "Leadership moved to a surviving in-sync replica within a second or two, and `Isr` for every partition shrank from `1,2,3` to two brokers. Producers and consumers using `acks=all` kept working because two in-sync replicas still meet `min.insync.replicas=2`.",
      commonError: {
        symptom: "`--describe` still shows `Leader: 2` for some partition.",
        cause: "You stopped a broker that was not leading that partition — leadership only moves for partitions whose leader went away.",
        recovery: "That is fine. Look at the partition kafka-2 *was* leading; that one has a new leader.",
      },
    },
    {
      id: "restart-broker",
      title: "Restart the broker and watch it rejoin the ISR",
      intro: "Bring the stopped broker back and describe once more after a few seconds.",
      command:
        "docker compose start kafka-2\nsleep 10 && docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka-1:19092 --describe --topic orders",
      expected:
        "\tTopic: orders\tPartition: 1\tLeader: 3\tReplicas: 2,3,1\tIsr: 3,1,2\n(kafka-2 is back in every Isr list, but it did NOT automatically take leadership back)",
      observe:
        "kafka-2 caught up and rejoined the ISR, so you are back to three in-sync replicas. It did not reclaim the partitions it used to lead — KRaft leaves leadership where it is until a preferred-leader election moves it. That is expected; leadership imbalance after a restart is normal and self-corrects on the next rebalance.",
    },
    {
      id: "min-isr-floor",
      title: "Drop the ISR below the floor and watch acks=all stop accepting writes",
      intro:
        "`min.insync.replicas=2` means an `acks=all` write is only accepted while at least two replicas are in sync. Stop two of the three brokers and every partition's ISR falls to one.",
      command:
        "docker compose stop kafka-2 kafka-3\nprintf 'blocked\\n' | docker exec -i kafka-lab-kafka-1 /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka-1:19092 --topic orders --producer-property acks=all --producer-property retries=0",
      expected:
        "org.apache.kafka.common.errors.NotEnoughReplicasException: The size of the current ISR ... is insufficient to satisfy the min.insync.replicas requirement of [2] for partition orders-N",
      observe:
        "This is admission control, not data loss. Kafka refused the write rather than accept something it could only store on one broker. An `acks=1` or `acks=0` producer would still have been accepted here — with a weaker durability guarantee. Bring the brokers back with `docker compose start kafka-2 kafka-3` and the same produce succeeds once the ISR is back to two.",
      commonError: {
        symptom: "The produce succeeds instead of failing.",
        cause: "One of the two brokers you stopped is still (or already) running, so a partition still has two in-sync replicas.",
        recovery: "`docker compose ps` should show only kafka-1 up among the brokers. Stop whichever of kafka-2 / kafka-3 is still running and retry.",
      },
    },
    {
      id: "grafana-dashboard",
      title: "Read the same story on the Grafana dashboard",
      intro:
        "Everything you just did by hand is on a dashboard. Start the brokers back up, open Grafana, and stop a broker again while watching.",
      command: "docker compose start kafka-2 kafka-3   # then open http://localhost:3001",
      expected:
        "Grafana (anonymous access, no login) → Dashboards → \"Kafka lab overview\". Panels: brokers reporting, under-replicated partitions, consumer-group lag, per-topic write rate, ISR vs total replicas.",
      observe:
        "Stop a broker and the \"under-replicated partitions\" panel jumps from 0 and \"brokers reporting\" drops to 2; start it and both recover. This is the metric an on-call engineer actually watches — the CLI `--describe` is the same information one snapshot at a time.",
    },
    {
      id: "dynamic-config",
      title: "Change a topic config with no restart",
      intro: "Dynamic topic configs like `retention.ms` apply immediately across the cluster.",
      command:
        "docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-configs.sh --bootstrap-server kafka-1:19092 --entity-type topics --entity-name orders --alter --add-config retention.ms=3600000\ndocker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-configs.sh --bootstrap-server kafka-1:19092 --entity-type topics --entity-name orders --describe",
      expected:
        "Completed updating config for topic orders.\nDynamic configs for topic orders are:\n  retention.ms=3600000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=3600000}\n  min.insync.replicas=2 ...",
      observe:
        "No broker restart, no downtime — the change is stored in cluster metadata and every broker picks it up. Remove the override with `--delete-config retention.ms` to fall back to the broker default.",
    },
  ],
  troubleshooting: [
    {
      symptom: "A `kafka-*` container restarts in a loop or never becomes healthy.",
      cause: "Docker has too little memory for three broker JVMs.",
      fix: "Raise Docker's memory to at least 4 GB (Docker Desktop → Settings → Resources), then `docker compose down && docker compose up -d`.",
    },
    {
      symptom: "`verify-lab.sh` or `docker compose up` reports a port is already allocated.",
      cause: "Another process — often a local Kafka, or a previous run of this lab — holds 29092–29094, 8080, 9090, or 3001.",
      fix: "`docker compose down`, stop the other process (`lsof -i :29092`), and retry. Or change the published ports in `docker-compose.yml`.",
    },
    {
      symptom: "Kafka UI at localhost:8080 shows no cluster or an 'offline' status.",
      cause: "It connected before the brokers were ready and cached the failure.",
      fix: "`docker compose restart kafka-ui`, then reload the page.",
    },
    {
      symptom: "On Windows, `docker compose up` fails on a bind mount, or brokers never pass health checks.",
      cause: "The repo is checked out under `/mnt/c/...`; Compose bind mounts onto the Windows filesystem are too slow.",
      fix: "Clone the repo into your WSL 2 home directory (`~`) and run the lab from there.",
    },
  ],
  teardown: [
    {
      command: "docker compose stop",
      note: "Stops every container but keeps them and their volumes. `docker compose start` brings the same cluster back with all its data.",
    },
    {
      command: "docker compose down",
      note: "Removes the containers and the network. The named volumes — and so every topic, record, and Grafana/Prometheus history — survive. Next `docker compose up -d` resumes the same cluster.",
    },
    {
      command: "docker compose down -v",
      note: "The destructive one. `-v` also deletes the named volumes, wiping all cluster data. Use it only when you want a genuinely fresh cluster.",
    },
  ],
  teardownWarning:
    "`docker compose down` on its own is safe — it keeps the volumes, so your topics and records come back on the next `up`. `docker compose down -v` deletes those volumes permanently: every topic, every record, and all Grafana/Prometheus history are gone, and the next start is a brand-new cluster. There is no undo. Only reach for `-v` when a fresh cluster is exactly what you want.",
};

export const labs: Lab[] = [labA, labB];
