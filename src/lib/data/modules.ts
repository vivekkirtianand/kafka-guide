import { Module } from "@/lib/types";
import { labA, labB, labC, connectFileLab, orderTotalsLab } from "./labs";
import { producerConsumerWalkthrough } from "./walkthroughs";
import { capstoneProject } from "./capstone";

export const modules: Module[] = [
  {
    slug: "why-kafka",
    index: 0,
    title: "Why Kafka and when to use it",
    summary:
      "What an event is, how streaming differs from request/response and from queues, databases, and object storage — and the cases where Kafka is the wrong tool.",
    difficulty: "beginner",
    estimatedMinutes: 45,
    prerequisites: [],
    track: "beginner-path",
    objectives: [
      "Explain what an event is and identify its key, value, timestamp, and headers in a sample",
      "Describe how event streaming differs from request/response",
      "Say when Kafka fits better than a queue, a database, or object storage — and when it doesn't",
      "Name Kafka's main components (topic, partition, broker, producer, consumer, offset) at a high level",
    ],
    completionCriteria: [
      "Given a system description, you can argue for or against using Kafka and say which alternative you'd reach for instead",
      "You can point at a sample event and label its key, value, timestamp, and headers",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Introduction", url: "https://kafka.apache.org/40/getting-started/introduction/" },
      { label: "Apache Kafka 4.0 — Use cases", url: "https://kafka.apache.org/40/getting-started/uses/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    topics: [
      "What an event is",
      "Event key, value, timestamp, headers, and schema",
      "Event streaming versus request/response",
      "Kafka versus queues",
      "Kafka versus databases",
      "Kafka versus object storage",
      "Common use cases",
      "When Kafka is a poor choice",
      "Kafka's main components at a high level",
    ],
    topicDetail: {
      "What an event is": {
        level: "beginner",
        summary:
          "An event is an immutable record of something that already happened, at a point in time — the unit Kafka stores and moves.",
        points: [
          {
            term: "Something happened",
            detail:
              "An event states a fact about the past — \"order 1234 was placed\", \"sensor 9 read 21.4°C\", \"user 42 logged out\". It isn't a command or a question; nothing is being asked, something is being reported.",
          },
          {
            term: "Immutable",
            detail:
              "Once written, an event never changes. A correction is a new event, not an edit. That is exactly what lets many independent systems read the same history and still agree on it.",
          },
          {
            term: "Kept in order",
            detail:
              "Kafka stores events in the order they were appended and hands them back to a reader in that order. That ordering guarantee is scoped — it holds within a [[partition|partition]] (a later topic unpacks this), not across a whole topic — but the core idea is that Kafka preserves sequence, which a plain datastore usually doesn't.",
          },
          {
            term: "Small and continuous",
            detail:
              "Events are usually small — bytes to a few kilobytes — and produced steadily rather than in occasional big batches. Thousands per second from one source is ordinary.",
          },
        ],
        watchOut:
          "\"Event\" is an overloaded word. Here it always means a stored, immutable record on a log — not an in-memory callback, a UI click handler, or a webhook call.",
      },
      "Event key, value, timestamp, headers, and schema": {
        level: "beginner",
        summary:
          "Every Kafka event has the same shape: a value, an optional key, a timestamp, optional headers, and — by convention — a schema for the value.",
        points: [
          {
            term: "Value",
            detail:
              "The payload: the actual data describing what happened, [[serialization|serialized]] to bytes — commonly JSON, Avro, or Protobuf. Kafka never looks inside it.",
          },
          {
            term: "Key",
            detail:
              "An optional identifier used to group related events — an order id, a customer id, a device id. Events sharing a key are kept together and in order. It is not a unique primary key; many events can and do share one.",
          },
          {
            term: "Timestamp",
            detail:
              "When the event happened, set by the producer — or when the broker stored it. You pick which of the two a topic uses.",
          },
          {
            term: "Headers",
            detail:
              "Optional key/value metadata carried alongside the payload: a trace id, a schema version, the source system. Useful for routing decisions in your own code, but Kafka doesn't route on them.",
          },
          {
            term: "Schema",
            detail:
              "The agreed structure of the value. Kafka stores only bytes, so the schema is a contract between producers and consumers — often written down and enforced by a separate [[schema-registry|schema registry]].",
          },
        ],
        watchOut:
          "The key's job is grouping and ordering, not identity or uniqueness. Reaching for it as a database-style primary key is the most common early mistake.",
      },
      "Event streaming versus request/response": {
        level: "beginner",
        summary:
          "Request/response is one caller asking one service for an answer now. Event streaming is one [[producer|producer]] publishing facts that any number of [[consumer|consumers]] read later, each on its own schedule.",
        points: [
          {
            term: "Who knows whom",
            detail:
              "In request/response the caller must know the callee and both must be up at once. With streaming the producer doesn't know who consumes, and consumers can be offline when an event is produced and catch up afterwards.",
          },
          {
            term: "Timing",
            detail:
              "A request blocks until it gets a reply. A consumer reads when it is ready — milliseconds or hours later — and can move its position back to re-read.",
          },
          {
            term: "Adding a reader",
            detail:
              "A second consumer of a stream costs the producer nothing. A second caller in request/response adds load to the callee and another dependency to manage.",
          },
          {
            term: "They coexist",
            detail:
              "You still call a payment API request/response to charge a card. You then publish \"payment succeeded\" as an event so billing, email, and analytics each react without the payment service having to call them.",
          },
        ],
        watchOut:
          "Streaming doesn't replace request/response. It removes the need for the producer to know about and call every downstream system.",
      },
      "Kafka versus queues": {
        level: "beginner",
        summary:
          "A traditional message queue hands each message to one consumer and then deletes it. Kafka keeps every event in an ordered log that many consumers read independently — and can re-read.",
        points: [
          {
            term: "Retention",
            detail:
              "A queue is empty once its messages are consumed. A Kafka [[topic|topic]] keeps events for a configured time or size no matter who has read them ([[retention|retention]]), so a brand-new consumer can start from the beginning.",
          },
          {
            term: "Many independent readers",
            detail:
              "A queue message goes to one worker. A Kafka event is available to every [[consumer-group|consumer group]] independently — billing and analytics both see the full stream.",
          },
          {
            term: "Replay",
            detail:
              "Because the log stays put, you can move a consumer back to an earlier position and reprocess — after fixing a bug, or to backfill a new system from history.",
          },
          {
            term: "Kafka can still act like a queue",
            detail:
              "One consumer group with several members splits the partitions between them and processes the work in parallel, queue-style — you simply keep the option to add more readers or to replay.",
          },
        ],
        watchOut:
          "If you specifically need to track delivery of each message individually, priority levels, or long delayed redelivery, a dedicated queue such as SQS or RabbitMQ may fit better than Kafka.",
      },
      "Kafka versus databases": {
        level: "beginner",
        summary:
          "A database answers \"what is the current state?\" Kafka answers \"what happened, and in what order?\" One holds the latest value; the other holds the history that produced it.",
        points: [
          {
            term: "Query model",
            detail:
              "A database lets you query by any field, update rows, and enforce constraints. Kafka has no queries — a consumer reads a partition from one end to the other. You build the queryable view you need in a database downstream.",
          },
          {
            term: "State versus log",
            detail:
              "A database row shows an account balance now. A Kafka topic shows every deposit and withdrawal. The log can rebuild the row; the row cannot rebuild the log.",
          },
          {
            term: "Kafka usually feeds databases",
            detail:
              "A common setup is events in Kafka with connectors continuously writing them into Postgres, Elasticsearch, or a warehouse, which is where the actual lookups happen.",
          },
          {
            term: "Compaction narrows the gap slightly",
            detail:
              "A [[log-compaction|compacted topic]] keeps only the latest event per key — effectively a key/value snapshot — but it is still read start-to-end, not queried like a table.",
          },
        ],
        watchOut:
          "Kafka can be the system of record for events — the authoritative log that other systems are derived from, which many event-sourced designs rely on. What it is not is a query database: lookups, joins, and transactions across entities are a database's job, downstream.",
      },
      "Kafka versus object storage": {
        level: "beginner",
        summary:
          "Object storage (S3, GCS) is cheap, durable storage for large files written once and read occasionally. Kafka is for a continuous stream of small events that many systems react to within seconds.",
        points: [
          {
            term: "Latency",
            detail:
              "Object storage is built for throughput on large objects, not for serving the next small record quickly. A Kafka consumer can fetch new events within milliseconds of them being written.",
          },
          {
            term: "Access pattern",
            detail:
              "You list a bucket and fetch whole objects. With Kafka a consumer polls a topic and pulls each new event shortly after it is written — Kafka doesn't push, the consumer asks.",
          },
          {
            term: "Cost over time",
            detail:
              "Object storage is far cheaper per byte for long-term retention. Kafka keeps a recent window readily available; some deployments move older data to object storage behind the scenes.",
          },
          {
            term: "They compose well",
            detail:
              "A very common pipeline uses Kafka for the live stream and a connector that continuously archives events into object storage for cheap long-term history and batch analytics.",
          },
        ],
        watchOut:
          "Don't use Kafka as a bulk file store or a data lake. It is a moving pipe, not a warehouse.",
      },
      "Common use cases": {
        level: "beginner",
        summary:
          "Kafka fits wherever many systems need to react to the same stream of events, decoupled from whoever produced them.",
        points: [
          {
            term: "Event-driven services",
            detail:
              "Services publish domain events — \"order placed\", \"shipment dispatched\" — instead of calling each other directly, so adding a new reaction doesn't touch the producer.",
          },
          {
            term: "Data integration and change capture",
            detail:
              "Capture every change from a source database and feed search indexes, caches, and warehouses from one shared stream instead of many point-to-point jobs.",
          },
          {
            term: "Activity and telemetry feeds",
            detail:
              "Clickstreams, application logs, IoT sensor readings — high-volume feeds collected once and consumed several different ways.",
          },
          {
            term: "Stream processing",
            detail:
              "Compute running aggregates, joins, and alerts continuously as events arrive: order totals per minute, fraud signals, live dashboards.",
          },
          {
            term: "Buffering and decoupling",
            detail:
              "Absorb bursts in front of a slower system so producers aren't blocked when consumers fall behind.",
          },
        ],
        watchOut:
          "The common thread is many consumers, retained history, and decoupling — not simply \"moving data around\". Plain point-to-point transfer rarely needs Kafka.",
      },
      "When Kafka is a poor choice": {
        level: "beginner",
        summary:
          "Kafka pays back its operational cost when the streaming need is real. Without one, it is a heavy dependency that a simpler tool would beat.",
        points: [
          {
            term: "Low volume, single consumer",
            detail:
              "A few thousand messages a day going to one service — a managed queue or even a database table is simpler, cheaper, and easier to operate.",
          },
          {
            term: "You need an answer back",
            detail:
              "If the caller expects a response, that is an RPC or HTTP call. Modelling it as an event just adds a round trip you have to build yourself.",
          },
          {
            term: "The real need is queries",
            detail:
              "If the job is \"look up X by Y\", use a database. Kafka can't do it, and bolting a lookup layer onto Kafka reinvents one badly.",
          },
          {
            term: "Per-message workflow features",
            detail:
              "Priority ordering, per-message time-to-live, scheduled retries, dead-letter with redrive — these are queue features Kafka does not provide natively.",
          },
          {
            term: "No capacity to operate it",
            detail:
              "Self-hosting Kafka is genuine ongoing work. If a managed service isn't an option, weigh that cost honestly against the benefit.",
          },
        ],
        watchOut:
          "\"We might need to scale one day\" is not a reason to adopt Kafka today. Adopt it when the streaming problem is real — moving to it later is a normal, well-trodden path.",
      },
      "Kafka's main components at a high level": {
        level: "beginner",
        summary:
          "A few parts: producers write events, brokers store them in topics that are split into partitions, and consumers read them — with a cluster of brokers sharing the load.",
        points: [
          {
            term: "Topic",
            detail:
              "A named stream of events, like \"orders\" or \"page-views\". You publish to a topic and you subscribe to a topic.",
          },
          {
            term: "Partition",
            detail:
              "A topic is split into partitions so it can scale. Each partition is its own ordered log, and different partitions can live on different machines.",
          },
          {
            term: "Broker",
            detail:
              "One Kafka server. A [[cluster|cluster]] is several brokers; each holds some of the partitions so storage and traffic spread across them. You can also configure a partition to be copied onto more than one broker (its replication factor) so losing a machine doesn't lose data — most production topics do, but it is a setting, not automatic.",
          },
          {
            term: "Producer",
            detail:
              "A client that publishes events to a topic, choosing a partition — usually derived from the event [[key|key]].",
          },
          {
            term: "Consumer and consumer group",
            detail:
              "A client that reads events from a topic's partitions by polling the broker for more. Members of a [[consumer-group|consumer group]] divide the partitions between them to share the work.",
          },
          {
            term: "Offset",
            detail:
              "Each consumer tracks how far it has read in each partition (its [[offset|offset]]), so it can stop and resume later without losing its place — and can move that position back to re-read.",
          },
        ],
        watchOut:
          "That is the whole mental model you need for now. How brokers stay consistent, choose which replica serves a partition, and confirm writes comes later — none of it is needed to understand what Kafka is for.",
      },
    },
    activities: [
      "Pick the right tool — Kafka, a queue, a database, object storage, or a direct call — for a set of scenarios",
      "Follow one order-placed event from checkout to billing, email, warehouse, and analytics, then add a new consumer",
      "Compare a message queue (one consumer per message, then dropped) with a Kafka topic (retained, re-readable by many groups)",
      "Label the key, value, timestamp, and headers in sample events",
    ],
    knowledgeChecks: [
      {
        question: "What is an event in Kafka?",
        options: [
          "A request for another service to do something",
          "An immutable record of something that already happened, with a timestamp",
          "A row in a database table that gets updated in place",
          "A background job waiting in a queue to be run",
        ],
        answerIndex: 1,
        explanation:
          "An event is a fact about the past — immutable, timestamped, appended to a log. Corrections are new events, not edits.",
      },
      {
        question: "How does event streaming differ from request/response?",
        options: [
          "Streaming is always faster than a direct call",
          "Streaming guarantees every consumer processes each event exactly once",
          "The producer publishes without knowing who consumes, and consumers read on their own schedule",
          "Streaming replaces the need for any synchronous API calls",
        ],
        answerIndex: 2,
        explanation:
          "The producer publishes once and doesn't know its readers; each consumer reads when it's ready and tracks its own position. Synchronous calls are still used where a caller needs an answer back.",
      },
      {
        question:
          "Billing already consumes \"order-placed\" events. A new team wants to react to the same events. What has to change in the checkout service?",
        options: [
          "Checkout adds a call to the new service",
          "Checkout republishes the events to a second topic",
          "Nothing — the new team subscribes to the same topic independently",
          "Checkout has to increase the topic's partition count",
        ],
        answerIndex: 2,
        explanation:
          "Adding a consumer needs no producer change — the new team reads the existing topic on its own. (It does add its own infrastructure and some load on the brokers.)",
      },
      {
        question: "When is a plain database a better fit than Kafka?",
        options: [
          "When many systems need to react to the same stream of changes",
          "When you need to look up the current value for a key on every request",
          "When you want to replay history to rebuild a downstream system",
          "When you need to retain events for a long time",
        ],
        answerIndex: 1,
        explanation:
          "Kafka has no queries — a consumer reads a partition end to end. Keyed lookups of current state are a database's job.",
      },
      {
        question: "What does a Kafka topic do that a traditional message queue does not?",
        options: [
          "Deliver each message to exactly one worker",
          "Guarantee ordering across the whole topic",
          "Retain events so multiple consumer groups can each read them, and re-read them",
          "Automatically retry failed messages with backoff",
        ],
        answerIndex: 2,
        explanation:
          "A queue routes each message to one consumer and removes it once handled. A Kafka topic keeps events, so any number of groups can read — and rewind and re-read — them.",
      },
      {
        question:
          "A record is produced with a key, no explicit partition set, and the default partitioner. What decides which partition it lands in?",
        options: [
          "The key's hash",
          "The size of the record",
          "The time the record was produced",
          "Whichever partition currently has the least data",
        ],
        answerIndex: 0,
        explanation:
          "In that case the key's hash picks the partition, so same-key records stay together and in order. A record with no key is spread across partitions instead, and setting an explicit partition or a custom partitioner overrides the key entirely.",
      },
      {
        question: "A partner downloads one 5 GB report file once a day. Where should it live?",
        options: ["A Kafka topic", "Object storage (S3, GCS)", "A relational database", "A message queue"],
        answerIndex: 1,
        explanation:
          "One large file, written once, read occasionally — object storage is cheap and built for it. Kafka is a moving pipe for small events, not a file store.",
      },
      {
        question: "What is an offset?",
        options: [
          "The number of partitions in a topic",
          "How long an event is retained before deletion",
          "A consumer's position — how far it has read in a partition",
          "The delay between producing an event and it becoming readable",
        ],
        answerIndex: 2,
        explanation:
          "Each consumer tracks an offset per partition. Reading doesn't consume; a consumer can move its offset back to re-read.",
      },
      {
        question: "Which is a poor reason to adopt Kafka?",
        options: [
          "Several independent systems need the same stream of events",
          "You need to replay events to backfill a new service",
          "\"We might need to scale someday\"",
          "You want to decouple a fast producer from a slower consumer",
        ],
        answerIndex: 2,
        explanation:
          "Adopt Kafka when the streaming problem is real. Speculative future scale isn't a reason — moving to Kafka later is a normal, well-trodden path.",
      },
      {
        question: "Charging a customer's card at checkout should be modelled as…",
        options: [
          "An event published to a \"charges\" topic",
          "A synchronous call to the payment service that returns success or failure",
          "A row inserted into a database that a consumer polls for",
          "A message on a queue with no reply",
        ],
        answerIndex: 1,
        explanation:
          "The caller needs an answer back before continuing — that's request/response. You'd then publish \"payment succeeded\" as an event so other systems can react.",
      },
    ],
    exercises: [
      {
        prompt:
          "A subscription-box company processes about 2,000 orders a day. When an order is placed, four systems need to react: charge the card, email a receipt, tell the warehouse to pick it, and update an analytics dashboard. They plan to add a loyalty-points service and a fraud check within the year — and the fraud team says that every time they retrain their model, they will need to re-run it over the last 60 days of orders. Write a one-paragraph recommendation: a retained event log (Kafka), a lightweight pub/sub broker, direct service-to-service calls, or a mix — and why.",
        successCriteria: [
          "You give one clear recommendation, not a list of pros and cons",
          "You single out the fraud team's 60-day reprocessing need as the requirement that a retained, replayable log serves and plain pub/sub or a queue does not",
          "You note that the four downstream reactions on their own could be handled by simple pub/sub — fan-out by itself is not what tips the decision",
          "You keep charging the card as a synchronous call, not an event",
          "You name the cost: someone has to operate the log, or pay for a managed service",
          "Your recommendation would not change at 200 orders/day — throughput is not the deciding factor",
        ],
      },
    ],
    status: "available",
  },
  {
    slug: "mental-model",
    index: 1,
    title: "Events, topics, partitions, brokers",
    summary:
      "The append-only log, and the pieces around it: topics split into partitions, partitions replicated across brokers, and producers and consumers tracking a position by offset. The mechanical model everything else is built on.",
    difficulty: "beginner",
    estimatedMinutes: 45,
    prerequisites: ["why-kafka"],
    track: "beginner-path",
    objectives: [
      "Describe a topic-partition as an ordered, append-only log and explain what an offset is",
      "Lay out how a topic splits into partitions and how partitions are replicated across brokers",
      "Explain the difference between a consumer's read position and its committed offset",
      "Describe how a consumer group divides a topic's partitions among its members",
    ],
    completionCriteria: [
      "You can draw the path of a record from producer to a partition to a consumer group, labelling the offset at each step",
      "You can explain why reading a record doesn't remove it and what retention actually frees",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Introduction", url: "https://kafka.apache.org/40/getting-started/introduction/" },
      { label: "Apache Kafka 4.0 — Design", url: "https://kafka.apache.org/40/design/design/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-04",
    topics: [
      "Kafka's append-only log",
      "Brokers, topics, partitions, replicas",
      "Producers, consumers, offsets, and consumer groups",
    ],
    topicDetail: {
      "Kafka's append-only log": {
        level: "beginner",
        summary:
          "Every topic-partition is an ordered, immutable, append-only sequence of records — the one data structure everything else is built on.",
        points: [
          {
            term: "Append-only",
            detail:
              "Producers only ever add records to the end. Nothing is modified or inserted in the middle; even a delete is just another appended record (a tombstone, under log compaction).",
          },
          {
            term: "Offsets",
            detail:
              "The broker assigns each record an integer offset on append — its permanent position in that partition, per-partition and never global. Offsets only move forward, but they aren't always gapless: compacted-away records and transaction markers leave holes a consumer just skips.",
          },
          {
            term: "Reading doesn't consume",
            detail:
              "A consumer just tracks a position in the log. Reading a record doesn't remove it — many consumers read the same partition independently, and any of them can move its position back and re-read.",
          },
          {
            term: "Retention frees space, not consumption",
            detail:
              "Records age out by time or size, or are compacted to the latest value per key — independent of whether anyone has read them.",
          },
        ],
        watchOut:
          "The log is per-partition. \"The order of a topic\" only means something for a single-partition topic; across partitions there is no total order.",
      },
      "Brokers, topics, partitions, replicas": {
        level: "beginner",
        summary:
          "A [[topic|topic]] is split into [[partition|partitions]] for scale; each partition is [[replica|replicated]] across [[broker|brokers]] for durability.",
        points: [
          {
            term: "Broker",
            detail:
              "One Kafka server process. A cluster is a set of brokers, and each broker holds a subset of the cluster's partitions.",
          },
          {
            term: "Topic → partitions",
            detail:
              "A topic is a named log split into N partitions. Partitions are the unit of parallelism and placement — Kafka spreads them across brokers for balance, though one broker routinely holds several partitions of the same topic.",
          },
          {
            term: "Partition → replicas",
            detail:
              "Each partition has a replication factor R: R copies on R different brokers, so the cluster needs at least R brokers to host it. One replica is the leader, the rest are followers that copy from it.",
          },
          {
            term: "Key picks the partition",
            detail:
              "A record's key is hashed (murmur2, modulo the partition count) to choose its partition, so all records with the same key land in the same partition and stay ordered. A record with no key is spread across partitions instead — in batches, not strictly one record at a time.",
          },
        ],
        watchOut:
          "Partition count can be raised but never lowered, and raising it changes which partition future keys hash to — so keyed ordering resets for those keys.",
      },
      "Producers, consumers, offsets, and consumer groups": {
        level: "beginner",
        summary:
          "Producers append to partitions; consumers track a position per partition; a consumer group splits the partitions across its members.",
        configs: ["group.id", "enable.auto.commit"],
        points: [
          {
            term: "Producer",
            detail:
              "Sends records to a topic; the partitioner (key hash, or a spread when there's no key) picks the partition. The broker assigns the offset on append.",
          },
          {
            term: "Consumer",
            detail:
              "Pulls batches from the partitions it's assigned and processes them, holding an in-memory read position that advances every poll.",
          },
          {
            term: "Committed offset",
            detail:
              "Separately from the read position, a consumer periodically commits an offset to the internal __consumer_offsets topic: committing N means every record below N is done and a new owner resumes from N. It's the recovery point after a restart or reassignment, not the live position.",
          },
          {
            term: "Consumer group",
            detail:
              "Consumers sharing a group.id divide the subscribed partitions among themselves, one partition to exactly one member. Add members to scale out, up to the partition count. A different group.id gets its own independent copy of the stream.",
          },
        ],
        watchOut:
          "The read position and the committed offset are different things. Whether a crash reprocesses or skips records depends entirely on when you commit relative to doing the work.",
      },
    },
    knowledgeChecks: [
      {
        question: "What assigns a record its offset, and what does that offset mean?",
        options: [
          "The producer, before it sends — the offset is a position across the whole topic",
          "The broker, on append — the offset is the record's permanent position within that one partition",
          "The consumer, when it first reads the record",
          "The controller, as a cluster-wide sequence number",
        ],
        answerIndex: 1,
        explanation:
          "The broker stamps the offset when it appends the record. Offsets are per-partition, never global, and only move forward — though they can have gaps where compacted records or transaction markers used to be.",
      },
      {
        question: "A consumer reads a record from a partition. What happens to that record?",
        options: [
          "It is removed from the partition once the consumer commits its offset",
          "It stays in the partition — other consumers can still read it, and this consumer can move back and re-read it",
          "It is copied to an internal __consumed topic and deleted from the original",
          "It is deleted once every subscribed consumer group has read it",
        ],
        answerIndex: 1,
        explanation:
          "A consumer only tracks a position in the log. Records leave a partition through retention (age or size) or compaction — never because someone read them.",
      },
      {
        question: "Nobody has consumed a topic for a week, and its oldest records are being deleted anyway. Why?",
        options: [
          "A misconfiguration — Kafka should never delete records a consumer hasn't read",
          "Retention deletes by age or size (or keeps the latest value per key under compaction), independent of whether anything has read the records",
          "Kafka deletes the oldest records whenever any broker disk passes 80% full",
          "Deleting the consumer group triggered a cleanup of the topic",
        ],
        answerIndex: 1,
        explanation:
          "Retention frees space on a time or size schedule. Consumption never enters into it — that is what makes replay and multiple independent readers possible.",
      },
      {
        question: "Every partition of a topic has replication factor 3. What does the cluster need?",
        options: [
          "At least 3 brokers — each partition's 3 copies sit on 3 different brokers",
          "Exactly 3 brokers, no more and no fewer",
          "At least 3 partitions per topic",
          "Nothing in particular — replication factor and broker count are unrelated",
        ],
        answerIndex: 0,
        explanation:
          "R copies live on R distinct brokers, so RF 3 needs at least 3 brokers. One replica is the leader; the rest are followers that copy from it.",
      },
      {
        question: "Two records carry the same key, no explicit partition, and go through the default partitioner, to a topic whose partition count has not changed. Where do they land?",
        options: [
          "On different partitions, to spread the load",
          "On the same partition, so they stay in order",
          "On whichever partition currently holds the least data",
          "On a partition chosen by the consumer group that will read them",
        ],
        answerIndex: 1,
        explanation:
          "The default partitioner hashes the key (murmur2) modulo the partition count, so a given key always maps to one partition — that is how related records stay ordered. Setting an explicit partition, or using a custom partitioner, can override this; raising the partition count later changes the mapping.",
      },
      {
        question: "What is the difference between a consumer's read position and its committed offset?",
        options: [
          "They are two names for the same value",
          "The read position is the live in-memory spot that advances as poll returns records; the committed offset is a saved recovery point a new owner resumes from",
          "The read position lives on the broker; the committed offset lives in the consumer's memory",
          "The committed offset is always exactly one ahead of the read position",
        ],
        answerIndex: 1,
        explanation:
          "The read position moves forward as poll returns records (an empty poll leaves it where it is, and seek can move it explicitly). The committed offset is written to __consumer_offsets whenever a commit succeeds — periodically if enable.auto.commit is on, otherwise when the application calls commitSync/commitAsync — and is where processing resumes after a restart or reassignment. Whether a crash reprocesses or skips records depends on when you commit relative to doing the work.",
      },
      {
        question: "A topic has 4 partitions and one consumer group with 6 members. What happens?",
        options: [
          "Each partition is shared between members so all 6 are busy",
          "4 members each get one partition; the other 2 stay idle",
          "The group fails to start — members must not outnumber partitions",
          "Kafka raises the partition count to 6 to match",
        ],
        answerIndex: 1,
        explanation:
          "A partition goes to exactly one member of a group, so parallelism is capped at the partition count. The extra members are simply idle — they pick up a partition only when a rebalance reassigns one (for example after another member leaves).",
      },
    ],
    activities: [
      "Animate a record moving from producer to a partition and on to a consumer group",
      "Predict which partition a keyed record lands on before revealing the result",
    ],
    status: "available",
  },
  {
    slug: "local-cluster-lab",
    index: 2,
    title: "Your first local Kafka workflow",
    summary:
      "Run Kafka on your own machine and drive the whole loop — topic, produce, consume, consumer group, replay — from the command line. Lab A is a single broker in one `docker run`; Lab B is the full three-broker cluster with a UI and metrics.",
    difficulty: "beginner",
    estimatedMinutes: 150,
    prerequisites: ["mental-model"],
    track: "beginner-path",
    objectives: [
      "Start a Kafka broker locally with Docker and confirm it is serving requests",
      "Create a topic, produce records with and without keys, and consume them back",
      "Read which partition each record landed on and explain why keyed records stay together",
      "Use a consumer group, read its lag, then reset its offsets and replay the topic",
      "On a three-broker cluster: stop a broker and watch leader election and ISR shrink, then see acks=all admission control when the ISR falls below min.insync.replicas",
    ],
    completionCriteria: [
      "You have worked through every step of Lab A against a running broker",
      "You can explain, from what you saw, why a keyed record's partition is fixed and what 'replay' actually changes",
      "You have run Lab B far enough to have stopped a broker and seen leadership move and the ISR shrink",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Quickstart", url: "https://kafka.apache.org/40/getting-started/quickstart/" },
      { label: "Apache Kafka 4.0 — Operations", url: "https://kafka.apache.org/40/operations/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    labs: [labA, labB],
    topics: [
      "Three Kafka brokers in KRaft mode",
      "Kafka CLI tools",
      "A simple producer and consumer",
      "Kafka UI",
      "Metrics collection with Prometheus and Grafana",
      "Optional Schema Registry and Kafka Connect",
    ],
    topicDetail: {
      "Three Kafka brokers in KRaft mode": {
        level: "beginner",
        summary:
          "Three Apache Kafka 4.0.2 nodes, each also a KRaft controller — no ZooKeeper. The smallest cluster where replication and leader election behave like production.",
        configs: ["min.insync.replicas"],
        points: [
          {
            term: "Why three",
            detail:
              "The lab defaults topics to 3 partitions, replication factor 3, min.insync.replicas=2 — so one broker can go down and acks=all writes still succeed.",
          },
          {
            term: "Combined mode",
            detail:
              "Each container is a broker and a KRaft controller at once. Fine for a lab; production usually runs controllers as separate nodes.",
          },
          {
            term: "Pinned to 4.0.2",
            detail:
              "Not 4.0.0 or 4.0.1 — those carry CVE-2026-35554, a producer buffer-pool race that can silently corrupt or misroute records.",
          },
          {
            term: "Reachable from the host",
            detail:
              "localhost:29092, :29093, :29094 — deliberately not the usual 9092, so the lab doesn't collide with a Kafka broker you might already run locally.",
          },
        ],
        watchOut:
          "Auto topic creation is turned off on purpose — topic creation and its settings (partitions, replication factor, configs) stay deliberate, and a mistyped topic name fails instead of silently spawning a topic with broker defaults.",
      },
      "Kafka CLI tools": {
        level: "beginner",
        summary:
          "The standard kafka-*.sh scripts, run via docker exec into a broker container — no local Kafka install needed.",
        points: [
          {
            term: "How you run them",
            detail:
              "docker exec kafka-lab-kafka-1 /opt/kafka/bin/kafka-topics.sh …, pointed at the in-network listener kafka-1:19092. Any healthy broker works as the entry point.",
          },
          {
            term: "The ones the labs use",
            detail:
              "kafka-topics.sh (create / describe), kafka-console-producer.sh and kafka-console-consumer.sh, kafka-consumer-groups.sh (offsets and lag), kafka-configs.sh (dynamic config).",
          },
          {
            term: "--describe is the workhorse",
            detail:
              "kafka-topics.sh --describe prints each partition's leader, full replica set, and ISR — the three columns that move when you stop a broker.",
          },
        ],
        watchOut:
          "The host-facing bootstrap (localhost:29092…) and the in-container one (kafka-1:19092) are different listeners — CLI run inside a container must use the latter.",
      },
      "A simple producer and consumer": {
        level: "beginner",
        summary:
          "The console producer and consumer — the fastest way to watch keys, partitions, and offsets behave.",
        points: [
          {
            term: "Without a key",
            detail:
              "Records spread across partitions batch-wise, with no ordering guarantee between them.",
          },
          {
            term: "With a key",
            detail:
              "--property parse.key=true --property key.separator=: — the same key always maps to the same partition, so records sharing a key stay ordered.",
          },
          {
            term: "Seeing where records landed",
            detail:
              "Consume with --property print.key=true --property print.partition=true to watch the key-to-partition mapping.",
          },
          {
            term: "A named group",
            detail:
              "--group order-processors makes the consumer commit offsets, so you can describe and reset them afterward.",
          },
        ],
      },
      "Kafka UI": {
        level: "beginner",
        summary:
          "provectuslabs/kafka-ui at localhost:8080 — browse topics, partitions, messages, and consumer groups without the CLI.",
        points: [
          {
            term: "What it shows",
            detail:
              "Topic detail with per-partition leader and ISR, a message browser, and consumer-group lag — the same data as kafka-topics.sh --describe and kafka-consumer-groups.sh, rendered visually.",
          },
          {
            term: "You can also write through it",
            detail:
              "Create topics, produce messages, and edit dynamic config from the UI.",
          },
        ],
        watchOut:
          "No authentication — bound to 127.0.0.1 for local-only use, and its dynamic-config editing is unauthenticated too.",
      },
      "Metrics collection with Prometheus and Grafana": {
        level: "intermediate",
        summary:
          "kafka-exporter feeds Prometheus, Grafana renders a pre-provisioned dashboard. No JMX agent needed.",
        points: [
          {
            term: "kafka-exporter",
            detail:
              "Translates cluster and consumer-group state into Prometheus kafka_* metrics without a JMX agent. Prometheus scrapes it every 10s.",
          },
          {
            term: "Prometheus",
            detail:
              "localhost:9090 — useful for ad-hoc queries against the raw kafka_* metrics.",
          },
          {
            term: "Grafana",
            detail:
              "localhost:3001, anonymous access (admin role, local lab). Dashboards → \"Kafka lab overview\": brokers reporting, under-replicated partitions, consumer-group lag by group, per-topic write rate, and in-sync vs total replicas per partition.",
          },
          {
            term: "The lag panel vs the CLI",
            detail:
              "It graphs total lag per consumer group and topic over time — the CLI's LAG column summed across partitions. CURRENT-OFFSET, LOG-END-OFFSET, and the per-partition breakdown stay CLI-only.",
          },
        ],
        watchOut:
          "kafka-exporter surfaces cluster and consumer-group state, not JVM internals — no heap, GC, or request-handler metrics. Those need a JMX exporter, which this lab skips.",
      },
      "Optional Schema Registry and Kafka Connect": {
        level: "intermediate",
        summary:
          "Off by default; bring them up with the extras profile when a lab needs schemas or connectors.",
        points: [
          {
            term: "How to enable",
            detail:
              "docker compose --profile extras up -d.",
          },
          {
            term: "Schema Registry (localhost:8081)",
            detail:
              "Stores Avro / Protobuf / JSON schemas and enforces compatibility, so producers and consumers agree on record shape.",
          },
          {
            term: "Kafka Connect (localhost:8083)",
            detail:
              "A REST API that runs source and sink connectors to move data between Kafka and external systems without writing a producer or consumer.",
          },
          {
            term: "Why off by default",
            detail:
              "Keeps the base lab light — they're only needed for the schema and connector topics.",
          },
        ],
        watchOut:
          "Both REST APIs are unauthenticated and bound to 127.0.0.1 — local use only.",
      },
    },
    knowledgeChecks: [
      {
        question: "Lab B creates topics with 3 partitions, replication factor 3, and min.insync.replicas=2. What does that combination buy you?",
        options: [
          "Three times the write throughput",
          "One broker can go down and acks=all writes still succeed",
          "Consumers fail over automatically to a second cluster",
          "Every record is stored three different ways for redundancy",
        ],
        answerIndex: 1,
        explanation:
          "RF 3 puts a copy on each of 3 brokers; min.insync.replicas=2 means a write still has two in-sync copies to land on when one broker is down, so acks=all keeps working. Lose a second broker and writes are refused rather than lost.",
      },
      {
        question: "Each Lab B container runs as a broker and a KRaft controller at once. What is the controller's job?",
        options: [
          "Serving all consumer reads",
          "Tracking broker liveness and partition state, and electing a new partition leader when a broker fails",
          "Compressing and storing the __consumer_offsets topic",
          "Running the Kafka UI",
        ],
        answerIndex: 1,
        explanation:
          "The controller quorum holds cluster metadata in a replicated Raft log and elects partition leaders. A lab co-locates it with the brokers; production usually runs controllers as separate nodes.",
      },
      {
        question: "The lab turns automatic topic creation OFF. Why?",
        options: [
          "To save disk space",
          "So topic settings stay deliberate and a mistyped topic name fails instead of silently creating a topic from the broker defaults",
          "Because KRaft mode does not support auto-created topics",
          "To force every topic to have exactly 3 partitions",
        ],
        answerIndex: 1,
        explanation:
          "Auto-create would spawn a topic from the broker defaults on any typo — its partition count, replication factor, and configs chosen by a global default rather than for that topic's workload. Off, every one of those is a conscious choice.",
      },
      {
        question: "You run kafka-topics.sh with docker exec inside a broker container. Which bootstrap address do you point it at?",
        options: [
          "localhost:29092 — the same one the host apps use",
          "The in-container listener (e.g. kafka-1:19092) — the host-facing address is not reachable from inside the Docker network",
          "Any address; Kafka works it out",
          "The Kafka UI address on port 8080",
        ],
        answerIndex: 1,
        explanation:
          "The host-facing bootstrap (localhost:29092…) and the in-network one (kafka-1:19092) are separate listeners. A CLI running inside a container has to use the in-network listener.",
      },
      {
        question: "In the console tools you produce keyed records with parse.key=true and consume with print.partition=true. What do you expect to see?",
        options: [
          "Every record on partition 0",
          "Records with the same key always on one partition; two different keys may land together or apart",
          "Records round-robining one per partition regardless of key",
          "The consumer refusing keyed records",
        ],
        answerIndex: 1,
        explanation:
          "A key hashes to exactly one partition, so all of one key's records land together and stay ordered. Two different keys can hash to the same partition or to different ones — the hash spreads keys across partitions on average, it does not guarantee separation.",
      },
      {
        question: "You reset a consumer group's offsets to earliest and start it again. What changed on the topic?",
        options: [
          "The topic was truncated and rebuilt from the start",
          "Nothing on the topic — only the group's committed offsets moved, so it re-reads records that were always there",
          "The records were duplicated so the group could read them twice",
          "Retention was extended to keep the data longer",
        ],
        answerIndex: 1,
        explanation:
          "Replay only rewinds the group's position. The records never moved — \"replay\" is re-reading a log that was never removed by being consumed.",
      },
      {
        question: "On the three-broker cluster you stop one broker. What does kafka-topics.sh --describe show for a partition that broker was leading?",
        options: [
          "The partition disappears until the broker returns",
          "A new leader elected from the remaining in-sync replicas, and the stopped broker dropped from the ISR",
          "The partition switches to read-only",
          "Every partition's leader moves to broker 1",
        ],
        answerIndex: 1,
        explanation:
          "The controller elects a new leader from the ISR, and the down replica leaves the ISR — rejoining once it catches up on restart. It does not automatically get its leadership back.",
      },
    ],
    activities: [
      "Create and inspect topics",
      "Produce records with and without keys",
      "Observe partition placement",
      "Stop and restart brokers",
      "Inspect consumer offsets",
      "Change topic-level configuration safely",
    ],
    status: "available",
  },
  {
    slug: "build-a-producer-and-consumer",
    index: 3,
    title: "Build a producer and consumer",
    summary:
      "Read a real Kafka client end to end — a Java producer that sends keyed order events, and a consumer that reads them back in a poll–process–commit loop. The code ships in examples/order-pipeline-java/; this module walks the lines that matter.",
    difficulty: "beginner",
    estimatedMinutes: 120,
    prerequisites: ["mental-model", "local-cluster-lab"],
    track: "beginner-path",
    objectives: [
      "Configure a KafkaProducer — bootstrap servers, serializers, acks, idempotence — and send records keyed by a business id",
      "Explain why send() is asynchronous and how to confirm a record was actually written",
      "Configure a KafkaConsumer with a group id and run a poll–process–commit loop",
      "Explain at-least-once delivery and say where duplicates come from",
      "Add a shutdown hook so the consumer leaves its group cleanly instead of waiting for a timeout",
      "Handle a poison record deliberately — skip it or dead-letter it — instead of letting it stall the partition",
    ],
    completionCriteria: [
      "You have run ./gradlew build (no broker needed) and ./gradlew run + runConsumer against Lab A",
      "You can point at the lines that set the message key, commit offsets, and handle shutdown, and say what each does",
      "You can predict what happens when a second consumer joins with the same group id, and with a different one",
      "You have fed the poison producer to the consumer and seen propagate stall it, then skip / deadletter get past it",
    ],
    furtherReading: [
      {
        label: "Apache Kafka 4.0 — KafkaProducer (javadoc)",
        url: "https://kafka.apache.org/40/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html",
      },
      {
        label: "Apache Kafka 4.0 — KafkaConsumer (javadoc)",
        url: "https://kafka.apache.org/40/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html",
      },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-02",
    walkthrough: producerConsumerWalkthrough,
    topics: [
      "The project and its dependencies",
      "The event you'll send",
      "Configuring the producer",
      "Sending a record",
      "Making sure the sends actually landed",
      "Serialization: object to bytes and back",
      "Configuring the consumer",
      "The poll loop",
      "Offsets and committing",
      "Consumer groups: scaling the read side",
      "Graceful shutdown",
      "Watching a rebalance",
      "A poison record stops everything",
      "Skip the poison record",
      "Dead-letter the poison record",
      "Prove at-least-once",
    ],
    knowledgeChecks: [
      {
        question: "producer.send(record) returns without confirming the record was written. How do you find out whether it actually landed?",
        options: [
          "Check the producer's log for an INFO line",
          "Block on the returned Future (or use the callback) — it completes with the RecordMetadata on success or the exception on failure",
          "Call producer.close() right away; it throws if any send failed",
          "Re-send the same record and watch for a duplicate error",
        ],
        answerIndex: 1,
        explanation:
          "send() hands the record to a background sender thread and returns; the write may already be in flight or done, it just is not confirmed to the caller yet. The Future<RecordMetadata> (or the callback) is where success or failure surfaces. The order-pipeline app collects the Futures, flush()es, then get()s each and exits non-zero if any failed.",
      },
      {
        question: "The order-pipeline producer keys each record by customerId. What does that achieve?",
        options: [
          "It deduplicates repeated orders from one customer",
          "All of one customer's orders go to the same partition and stay in order",
          "It encrypts the record for that customer",
          "It lets the consumer look a customer up by key",
        ],
        answerIndex: 1,
        explanation:
          "The key hashes to a partition, so one customer's events stay together and ordered. A key groups and orders — it does not identify or deduplicate.",
      },
      {
        question: "The consumer runs poll then process then commitSync, with enable.auto.commit=false. What delivery guarantee is that, and where do duplicates come from?",
        options: [
          "Exactly-once — no duplicates",
          "At-least-once — a crash after processing but before the commit replays that batch on restart",
          "At-most-once — records processed before a commit are lost",
          "It depends on the acks setting",
        ],
        answerIndex: 1,
        explanation:
          "Process-then-commit means a crash in the gap replays already-processed records. That is at-least-once; the fix is idempotent processing, not committing first (which would skip).",
      },
      {
        question: "Why does the order-pipeline consumer set enable.auto.commit=false?",
        options: [
          "Auto-commit is not supported once a group id is set",
          "So the offset is committed explicitly after the work is done — the commit is tied to completed processing, not to poll() timing",
          "To make poll() return faster",
          "Auto-commit would commit offsets for the other consumers in the group",
        ],
        answerIndex: 1,
        explanation:
          "In this simple loop a crash mid-batch replays either way, because auto-commit only fires on a later poll once auto.commit.interval.ms has passed and the batch is finished by then. Manual commit-after-work keeps that guarantee explicit and holds it even when processing is handed off to another thread — the case where auto-commit would advance the offset past records that are not done and skip them on a crash.",
      },
      {
        question: "The consumer app's shutdown hook calls consumer.wakeup(). What does that accomplish?",
        options: [
          "It flushes uncommitted offsets to disk",
          "It makes the blocked poll() throw WakeupException so the loop exits and calls close(), leaving the group cleanly",
          "It pauses the consumer without leaving the group",
          "It forces an immediate rebalance across the group",
        ],
        answerIndex: 1,
        explanation:
          "wakeup() unblocks poll() with a WakeupException; the loop catches it, breaks, and close() sends a leave-group request — so the coordinator reassigns the partitions at once instead of waiting for the session timeout.",
      },
      {
        question: "A record on the topic cannot be parsed (fromJson throws) and the consumer's policy rethrows. What happens?",
        options: [
          "The record is skipped and the consumer moves on",
          "The exception unwinds the loop and closes the consumer; the offset never advanced past the bad record, so any instance that picks up that partition hits the same bytes and dies again",
          "The record is automatically sent to a dead-letter topic",
          "Only the poison partition pauses; the consumer keeps serving its other partitions",
        ],
        answerIndex: 1,
        explanation:
          "In OrderConsumer the parse exception escapes run(), whose finally block calls close() — so the whole instance leaves the group, releasing every partition it held. Other group members may keep going, but whichever instance is then assigned the poison partition crashes on it too. The partition makes no progress until the record is skipped, dead-lettered, or its offset moved by hand.",
      },
      {
        question: "The 'skip' poison policy returns normally instead of throwing. What is the cost of that choice, compared with dead-lettering?",
        options: [
          "Skipping is slower",
          "This group just commits past the record — there is no separate copy with error context, and this consumer will not normally come back to it",
          "Skipping breaks ordering for every other key",
          "Skipping needs a second Kafka cluster",
        ],
        answerIndex: 1,
        explanation:
          "Skip advances this group's committed offset past the bad record and keeps the good records flowing. The original stays on the source topic until retention (another group, or an offset reset, can still read it), but there is no dead-letter copy carrying the exception and source coordinates, and nothing prompting anyone to look.",
      },
    ],
    activities: [],
    status: "available",
  },
  {
    slug: "keys-ordering-and-delivery",
    index: 4,
    title: "Keys, ordering, and delivery guarantees",
    summary:
      "How a record's key picks its partition, why that is the only way to keep related records in order, how a write becomes durable across replicas, and what \"processed once\" actually means end to end.",
    difficulty: "intermediate",
    estimatedMinutes: 75,
    prerequisites: ["mental-model", "build-a-producer-and-consumer"],
    track: "beginner-path",
    objectives: [
      "Predict which partition a keyed record lands on, and what changing the partition count does to that",
      "Explain why ordering is a per-partition guarantee and how retries can still break it",
      "Describe how acks=all plus min.insync.replicas make an acknowledged write survive a broker loss",
      "Say what sets at-most-once, at-least-once, and exactly-once, and where each one leaks",
    ],
    completionCriteria: [
      "Given a record with or without a key, you can say which partition it lands on and whether two records stay ordered",
      "You can explain why acks=all alone is not enough for durability, and what to pair it with",
      "You can place a consume→process→produce pipeline on the at-most / at-least / exactly-once spectrum from where it commits",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Design", url: "https://kafka.apache.org/40/design/design/" },
      { label: "Apache Kafka 4.0 — Producer configs", url: "https://kafka.apache.org/40/configuration/producer-configs/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-04",
    topics: [
      "Keys and the partitioner",
      "Ordering guarantees",
      "Leaders, followers, ISR, and controllers",
      "At-most-once, at-least-once, and exactly-once processing",
    ],
    topicDetail: {
      "Keys and the partitioner": {
        level: "beginner",
        summary:
          "A record's [[key|key]] decides which [[partition|partition]] it lands on — and that is the whole mechanism for keeping related records together and in order.",
        configs: ["partitioner.class"],
        points: [
          {
            term: "The default partitioner, with a key",
            detail:
              "Kafka hashes the key (murmur2) modulo the current partition count. Same key → same partition every time, as long as the partition count doesn't change — so every event for one customer, order, or device lands on one partition and stays in sequence.",
          },
          {
            term: "No key",
            detail:
              "A null-keyed record is spread across the partitions — in batches, not strictly one at a time. The Kafka 4.0 default is the sticky partitioner: it fills one partition's batch, then moves to another. You get throughput and load spread, but no ordering between those records.",
          },
          {
            term: "Overriding the choice",
            detail:
              "Set an explicit partition number on the ProducerRecord and routing ignores the key entirely — it rides along as data only. A partitioner.class replaces the default hashing but often still routes on the key: a different hash, or pinning a few hot keys to their own partitions. Same-key ordering only holds as long as whatever partitioner you run maps a key to one partition consistently.",
          },
          {
            term: "A key is not a primary key",
            detail:
              "Many records share one key by design. It groups and orders; it does not identify or deduplicate. Reaching for it as a unique id is the classic early mistake.",
          },
        ],
        watchOut:
          "Raising a topic's partition count changes hash(key) % partitionCount for most keys, so their new records start landing on a different partition — no longer ordered against that key's older records. Once ordering matters, partition count is effectively fixed.",
      },
      "Ordering guarantees": {
        level: "intermediate",
        summary: "Kafka orders records within a single [[partition|partition]] — and only there.",
        configs: ["enable.idempotence", "max.in.flight.requests.per.connection"],
        points: [
          {
            term: "Per-partition, not per-topic",
            detail:
              "Records in one partition are delivered in the offset order they were appended. Across partitions of the same topic there is no ordering.",
          },
          {
            term: "Keys are how you get ordering where you need it",
            detail:
              "Route records that must stay ordered — all events for one account, say — to the same partition by giving them the same key.",
          },
          {
            term: "Retries can reorder",
            detail:
              "With more than one in-flight request per connection, a failed-and-retried request can land after a later one that already succeeded. enable.idempotence=true (on by default) holds order across retries for up to 5 in-flight requests: the producer stamps each batch with a per-partition sequence number, the broker rejects any batch that arrives out of order (or is a duplicate), and the producer resends from there.",
          },
          {
            term: "The consumer can give it up",
            detail:
              "A single consumer processes each assigned partition in order. Hand a partition's records to a thread pool and you've discarded that ordering yourself.",
          },
        ],
        watchOut:
          "Adding partitions raises throughput but breaks ordering for keys whose partition changes — the key hash is taken over the current partition count.",
      },
      "Leaders, followers, ISR, and controllers": {
        level: "intermediate",
        summary:
          "Every partition has one [[leader|leader]] that handles all of its reads and writes; the [[controller|controller]] decides which broker that is. This is the machinery that makes an acknowledged write survive a broker loss.",
        configs: ["acks", "min.insync.replicas", "replica.lag.time.max.ms"],
        points: [
          {
            term: "Leader",
            detail:
              "All produces and consumes for a partition go through its leader. Followers don't serve clients (bar optional rack-local follower fetching) — they only replicate.",
          },
          {
            term: "ISR — in-sync replicas",
            detail:
              "The replicas currently caught up with the leader. A follower that hasn't kept pace within replica.lag.time.max.ms (30s by default) is dropped from the ISR, and rejoins once it has caught back up.",
          },
          {
            term: "Why the ISR matters",
            detail:
              "With acks=all the leader waits for every replica currently in the ISR to have the record before acknowledging. min.insync.replicas is a separate admission floor: if the ISR is smaller than it, the leader rejects the write outright rather than acking a thin one.",
          },
          {
            term: "Controller",
            detail:
              "Tracks broker liveness and partition state and elects a new partition leader when one fails. KRaft runs a quorum of controller nodes — dedicated or co-located with brokers — with one active and the rest hot standbys, holding the metadata in a replicated Raft log; ZooKeeper-based clusters (removed in 4.0) elected one broker as controller and stored it in ZooKeeper.",
          },
        ],
        watchOut:
          "A new leader is chosen from the ISR, so it has every committed record — one replicated to the full ISR, which is what acks=all waits for. A record acknowledged only by the leader (acks=1) can still be lost in a clean election. Unclean leader election (off by default) goes further, letting an out-of-sync replica take over and dropping committed records too.",
      },
      "At-most-once, at-least-once, and exactly-once processing": {
        level: "intermediate",
        summary:
          "Which one you get is set by when you commit the offset relative to doing the work — plus, for exactly-once, transactions.",
        configs: ["enable.idempotence", "isolation.level"],
        points: [
          {
            term: "At-most-once",
            detail:
              "Commit the offset before processing. A crash after the commit but before the work skips the record — never reprocessed, sometimes lost.",
          },
          {
            term: "At-least-once",
            detail:
              "Process, then commit. A crash between the two replays the record on restart. The default posture — fine as long as your processing is idempotent.",
          },
          {
            term: "Idempotent producer is not exactly-once",
            detail:
              "enable.idempotence=true (on by default) removes duplicates from a producer's own retries within a session. It does not make an end-to-end consume → process → produce pipeline exactly-once.",
          },
          {
            term: "Exactly-once (EOS)",
            detail:
              "For a Kafka-to-Kafka pipeline: a transactional producer writes the output records and the input offsets in one atomic transaction, and downstream consumers set isolation.level=read_committed.",
          },
        ],
        watchOut:
          "Exactly-once is scoped to Kafka — it means the observable result is as if each record were processed once. A database write or HTTP call inside your processing still needs its own idempotency key.",
      },
    },
    knowledgeChecks: [
      {
        question: "Using the default partitioner, a record is produced with key \"cust-42\" and no explicit partition. What picks its partition?",
        options: [
          "The hash of \"cust-42\" modulo the current partition count",
          "Round-robin across every partition",
          "The size of the record in bytes",
          "The consumer that will eventually read it",
        ],
        answerIndex: 0,
        explanation:
          "murmur2(key) modulo the partition count. Same key maps to the same partition every time, as long as the partition count does not change.",
      },
      {
        question: "In Kafka 4.0, where do null-keyed records go under the default partitioner?",
        options: [
          "All to partition 0",
          "Spread across partitions in batches — the sticky partitioner fills one partition's batch, then moves to another",
          "Strictly round-robin: one record to each partition in turn",
          "To a partition chosen fresh at random for every record",
        ],
        answerIndex: 1,
        explanation:
          "The 4.0 default is the sticky partitioner: batch-wise spread, not per-record round-robin. You get throughput and load spread but no ordering between those records.",
      },
      {
        question: "Which statement about a record key is correct?",
        options: [
          "A key uniquely identifies a record, like a database primary key",
          "Many records can share a key — it groups and orders them, but does not identify or deduplicate",
          "A key has to be unique within its partition",
          "Kafka rejects a second record carrying a key it has already seen",
        ],
        answerIndex: 1,
        explanation:
          "Keys group and order. Treating a key as a unique id — expecting Kafka to dedupe on it — is the classic early mistake.",
      },
      {
        question: "Records A and B are produced to the same topic but land on different partitions. A was produced first. What does Kafka guarantee about the order they are read in?",
        options: [
          "A is always read before B",
          "Nothing — ordering is a per-partition guarantee, not a per-topic one",
          "They are ordered only if they carry the same key",
          "They are ordered as long as the consumer is single-threaded",
        ],
        answerIndex: 1,
        explanation:
          "Kafka orders records within a partition only. To keep two records ordered, route them to the same partition by giving them the same key.",
      },
      {
        question: "With enable.idempotence=true (the default) and up to 5 in-flight requests per connection, how does the producer hold ordering across a retry?",
        options: [
          "It drops to a single in-flight request whenever it retries",
          "It stamps each batch with a per-partition sequence number, and the broker rejects any batch that arrives out of order or duplicated",
          "The broker sorts pending batches by timestamp before appending them",
          "It does not — idempotence only removes duplicates, not reordering",
        ],
        answerIndex: 1,
        explanation:
          "Per-partition sequence numbers let the broker reject out-of-order and duplicate batches; the producer then resends from the rejection point. Without idempotence, a retried batch can land after a later one that already succeeded.",
      },
      {
        question: "A topic has replication factor 3. Which setting combination guarantees every acknowledged write is on at least two in-sync replicas — even after the ISR has shrunk?",
        options: [
          "acks=1 on its own",
          "acks=all on its own",
          "acks=all together with min.insync.replicas=2",
          "acks=0 together with min.insync.replicas=3",
        ],
        answerIndex: 2,
        explanation:
          "acks=all waits for every replica currently in the ISR — but if the ISR has already shrunk to just the leader, it still acks a single copy. min.insync.replicas=2 makes the leader reject the write instead of acking a thin one. A new leader is only chosen from the ISR, so it holds every record acks=all waited for.",
      },
      {
        question: "A consumer commits the offset BEFORE it processes each record. What delivery semantics is that?",
        options: [
          "At-least-once",
          "At-most-once — a crash after the commit but before the work skips that record",
          "Exactly-once",
          "It depends on whether enable.idempotence is set",
        ],
        answerIndex: 1,
        explanation:
          "Commit-before-process can skip a record and never reprocess it. Process-then-commit is at-least-once (a crash replays the record). Neither is exactly-once.",
      },
      {
        question: "Your consume-transform-produce app runs a producer with enable.idempotence=true. Is it exactly-once end to end?",
        options: [
          "Yes — idempotence gives exactly-once",
          "No — idempotence only removes the producer's own retry duplicates within a session; end-to-end EOS needs a transaction over the output records and the input offsets, plus read_committed consumers downstream",
          "Yes, as long as acks=all is also set",
          "Only if the input topic has a single partition",
        ],
        answerIndex: 1,
        explanation:
          "Idempotence is scoped to one producer's retries. Exactly-once for a Kafka-to-Kafka pipeline needs the transactional producer writing outputs and input offsets atomically, and downstream consumers on isolation.level=read_committed. A database write or HTTP call inside the processing still needs its own idempotency key.",
      },
    ],
    activities: [
      "Change the partition count and watch a fixed keyed-event sequence land on different partitions",
      "Simulate a broker failure and watch the ISR shrink and a new leader take over",
    ],
    status: "available",
  },
  {
    slug: "schemas-and-data-contracts",
    index: 5,
    title: "Schemas and data contracts",
    summary:
      "Kafka stores bytes and never looks inside them, so every topic carries a data contract between its producers and consumers — written down or not. This module covers serialization formats, the Schema Registry, compatibility modes, and how to change a schema without breaking a running consumer.",
    difficulty: "intermediate",
    estimatedMinutes: 110,
    prerequisites: ["build-a-producer-and-consumer", "local-cluster-lab"],
    track: "beginner-path",
    objectives: [
      "Explain why Kafka needs a serializer and a deserializer, and what the data contract on a topic actually is",
      "Compare JSON, Avro, and Protobuf on readability, size, and whether the schema travels with the record",
      "Describe what the Schema Registry stores, how a record references a schema by id, and when the registry is on the request path",
      "Read a compatibility mode (BACKWARD, FORWARD, FULL, NONE) and say which side it makes you upgrade first",
      "Make a safe schema change — add a field, remove a field — and name the changes that always break a consumer",
      "Handle a deserialization failure without stalling the partition",
      "Register a schema, evolve it under a running consumer, and watch the registry accept a compatible change and reject an incompatible one (Lab C)",
    ],
    completionCriteria: [
      "Given a schema change, you can say whether it is backward-, forward-, fully-, or not-compatible, and whether to deploy producers or consumers first",
      "You can explain what a consumer sees when it reads bytes it cannot deserialize, and two ways to keep that from blocking the partition",
      "You have run Lab C: a compatible change flowed through to a consumer that never restarted, and the registry returned a 409 for an incompatible one",
    ],
    furtherReading: [
      {
        label: "Confluent — Schema Evolution and Compatibility",
        url: "https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html",
      },
      {
        label: "Apache Avro 1.11.1 — Schema Resolution",
        url: "https://avro.apache.org/docs/1.11.1/specification/#schema-resolution",
      },
      {
        label: "Apache Kafka 4.0 — Serializer (javadoc)",
        url: "https://kafka.apache.org/40/javadoc/org/apache/kafka/common/serialization/Serializer.html",
      },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-03",
    labs: [labC],
    topics: [
      "Kafka moves bytes, not objects",
      "Serialization formats: JSON, Avro, and Protobuf",
      "What the Schema Registry adds",
      "Subjects, versions, and naming strategies",
      "Compatibility modes",
      "Evolving a schema without breaking consumers",
      "Deserialization failures and poison records",
      "When a schema registry is worth it",
    ],
    topicDetail: {
      "Kafka moves bytes, not objects": {
        level: "beginner",
        summary:
          "A producer [[serialization|serializes]] the key and value to byte arrays before they leave the client; the broker stores and returns those bytes untouched; the consumer deserializes them back. The two ends have to agree on the format — that agreement is the contract.",
        configs: ["key.serializer", "value.serializer", "key.deserializer", "value.deserializer"],
        points: [
          {
            term: "The serializer boundary",
            detail:
              "value.serializer on the producer turns your object into bytes; value.deserializer on the consumer turns bytes back into an object. Kafka ships StringSerializer, ByteArraySerializer, and the primitives; anything structured — JSON, Avro, Protobuf — is a serializer you add.",
          },
          {
            term: "The broker is oblivious",
            detail:
              "A broker never parses a record's key or value. It cannot reject a record for being the wrong shape, cannot filter on a field, and cannot warn you that a producer started sending garbage. Validation is entirely a client concern.",
          },
          {
            term: "The contract exists either way",
            detail:
              "Even with plain StringSerializer and hand-written JSON, every consumer of a [[topic|topic]] depends on the fields the producers put there. That dependency is the data contract; the only question is whether it is written down and checked, or implicit and discovered in production.",
          },
          {
            term: "Key and value are independent",
            detail:
              "They are serialized separately and can use different formats — a String key with an Avro value is common. A [[schema-registry|registry]] tracks the two under separate [[subject|subjects]].",
          },
          {
            term: "Module 3 did this by hand",
            detail:
              "The order-pipeline consumer parses each value with a hand-rolled OrderEventJson.fromJson and throws on anything malformed. That is fine when one team owns both ends; it does not scale to many independent producers.",
          },
        ],
        watchOut:
          "A mismatched deserializer is not a loud failure at startup — it fails on the first record that doesn't fit, mid-stream, often long after the deploy that caused it.",
      },
      "Serialization formats: JSON, Avro, and Protobuf": {
        level: "beginner",
        summary:
          "The three formats most teams choose between. They differ on whether a human can read the bytes, how big a record is on disk, and whether the schema travels with each record or is referenced by id.",
        points: [
          {
            term: "JSON",
            detail:
              "Human-readable, needs no schema, supported everywhere. Costs: the field names repeat in every record; every value is a string, number, boolean, or null (no dates, no exact decimals); and there is no built-in schema — you add JSON Schema separately if you want validation.",
          },
          {
            term: "Avro",
            detail:
              "Compact binary; the schema is a separate document, not embedded in each record. Rich types, precise evolution rules, first-class support across the Kafka ecosystem. It needs the writer's schema available at read time to decode — which is exactly what a registry supplies.",
          },
          {
            term: "Protobuf",
            detail:
              "Compact binary defined by a .proto file and generated classes. Strong cross-language tooling; evolution rules built into the format, keyed on field numbers rather than names. Slightly less native to Kafka tooling than Avro, but well supported.",
          },
          {
            term: "Schema in the record vs by reference",
            detail:
              "Plain JSON carries no schema. Avro and Protobuf could embed one, but that would dwarf a small record — so with a registry each record carries a few-byte schema id instead, and the schema itself is fetched once and cached.",
          },
          {
            term: "Choosing",
            detail:
              "JSON for low volume, easy debugging, or an external boundary you don't control. Avro or Protobuf once volume, storage, or a strict contract matters. Switching later means running a consumer that understands both formats through the migration.",
          },
        ],
        watchOut:
          "\"JSON is simpler\" is true on day one. What that simplicity costs is a machine-checked contract — every schema mistake a registry would have rejected instead ships and breaks a consumer.",
      },
      "What the Schema Registry adds": {
        level: "intermediate",
        summary:
          "A separate service that stores schemas and gives each one an id. Producers register the schema they write and put its id in the record; consumers fetch the schema by id to decode. It also checks every new version against a compatibility rule.",
        configs: ["schema.registry.url", "auto.register.schemas", "use.latest.version"],
        points: [
          {
            term: "The wire format",
            detail:
              "With Confluent's serializers a record's value is one magic byte, then a 4-byte schema id, then the payload (Protobuf inserts a short message-index header between the id and the payload to say which message in the schema file it is). The id — not the schema text — is what travels with every record. Apicurio and other registries interoperate with this layout.",
          },
          {
            term: "Register on write, fetch on read",
            detail:
              "The producer's serializer registers the schema the first time it sees it (or looks its id up), caches the id, and prepends it. The consumer's deserializer reads the id, fetches that exact schema once, caches it, and decodes. In steady state the registry is hit zero times per record.",
          },
          {
            term: "Compatibility enforcement",
            detail:
              "When a producer tries to register a new schema version for a [[subject|subject]], the registry checks it against that subject's [[schema-compatibility|compatibility]] rule and rejects the registration if it would break readers. This is the check plain JSON never gets.",
          },
          {
            term: "Not on the hot path, but a dependency",
            detail:
              "A registry outage doesn't touch a client that has already cached the schema ids it uses — decoding runs entirely from that cache. What it blocks is a producer registering a new schema, and a consumer that hits a schema id it has never fetched (a cold start, or a producer that just rolled out a new version). Run it with the same care as a broker.",
          },
          {
            term: "auto.register.schemas",
            detail:
              "Default true: producers register whatever they send. Handy in dev, risky in prod — a bad schema self-registers. Many teams set it false and register schemas through a reviewed pipeline, with use.latest.version=true on the producer.",
          },
        ],
        watchOut:
          "The registry stores schemas, not data, and runs as its own process — its own storage (a Kafka topic, _schemas), its own backups, its own availability. Losing it while every client cache is cold is an outage.",
      },
      "Subjects, versions, and naming strategies": {
        level: "intermediate",
        summary:
          "A [[subject|subject]] is the name a schema is registered under. Each subject holds an ordered list of versions and its own compatibility setting.",
        configs: ["value.subject.name.strategy", "key.subject.name.strategy"],
        points: [
          {
            term: "Default: TopicNameStrategy",
            detail:
              "The subject is <topic>-value (or <topic>-key). One schema lineage per topic per side — simple, and the right default for a topic that carries a single kind of event.",
          },
          {
            term: "Versions",
            detail:
              "Every accepted schema for a subject gets an incrementing version number. Re-registering an identical schema returns the existing version; a compatible change adds one; an incompatible change is rejected outright.",
          },
          {
            term: "Deleting a version",
            detail:
              "Removing a version — or a whole subject — takes it out of the subject's history and out of compatibility checks. The schema id itself stays globally resolvable (unless you also do a permanent hard delete), so records already on the topic keep deserializing.",
          },
          {
            term: "RecordNameStrategy / TopicRecordNameStrategy",
            detail:
              "Key the subject on the record's own type name instead of — or as well as — the topic. Needed when one topic legitimately carries several event types, so each type evolves on its own lineage.",
          },
          {
            term: "Compatibility is per subject",
            detail:
              "The registry has a global default, but each subject can override it — a strict FULL_TRANSITIVE on a widely-shared topic, a looser BACKWARD on a private one.",
          },
        ],
        watchOut:
          "Putting several unrelated event types on one topic under the default TopicNameStrategy forces their schemas to share one lineage — every type's fields have to coexist in a single schema. Split the topics, or change the naming strategy deliberately.",
      },
      "Compatibility modes": {
        level: "intermediate",
        summary:
          "The rule the registry checks a new schema version against. It encodes which direction of mismatch you are willing to tolerate during a deploy — and therefore which side you upgrade first. The direction is format-neutral; the concrete list of safe changes is not.",
        points: [
          {
            term: "BACKWARD (the default)",
            detail:
              "A consumer on the new schema can read data written with the previous schema — so you upgrade consumers first, then producers. In Avro that permits deleting a field and adding a field that has a default.",
          },
          {
            term: "FORWARD",
            detail:
              "A consumer on the previous schema can read data written with the new schema — upgrade producers first, then consumers. In Avro that permits adding a field and deleting a field that has a default.",
          },
          {
            term: "FULL",
            detail:
              "Both directions, checked against the previous version, so deploy order stops mattering — the point of paying for the stricter rule. In Avro that narrows you to adding or removing fields that carry a default.",
          },
          {
            term: "NONE",
            detail:
              "No checks; every registration is accepted. Only safe when one team controls both ends and coordinates every change out of band.",
          },
          {
            term: "Transitive variants",
            detail:
              "BACKWARD_TRANSITIVE / FORWARD_TRANSITIVE / FULL_TRANSITIVE check against every earlier version, not just the last one. Use them when a consumer may replay a topic from the start rather than only reading the tail. NONE has no transitive form — it isn't checking anything.",
          },
          {
            term: "The safe-change list is per format",
            detail:
              "The direction each mode enforces holds for Avro, Protobuf, and JSON Schema alike. The specific changes are not portable: Protobuf identifies fields by number, not name, and treats most field add/remove as compatible; JSON Schema turns on `required` and whether the schema is open or closed. The registry runs a separate compatibility checker for each format.",
          },
        ],
        watchOut:
          "Plain BACKWARD only compares the new schema with the one immediately before it. A chain of individually-backward changes can leave version 5 unable to read version 1's records — which bites the moment a consumer resets to earliest. If you replay history, use the transitive mode.",
      },
      "Evolving a schema without breaking consumers": {
        level: "intermediate",
        summary:
          "The safe changes are a short list — and the list below is Avro's. Protobuf and JSON Schema reach the same goal by their own rules. Anything off the list needs a new topic or a coordinated stop-the-world.",
        points: [
          {
            term: "Adding a field (Avro): a no-default field is FORWARD-only",
            detail:
              "A field with no default can be added under FORWARD — an old consumer ignores it. BACKWARD needs the default, so the new consumer has something to stand in for records written before the field existed; FULL needs it for both directions. If you don't know the subject's mode, add the default.",
          },
          {
            term: "Removing a field (Avro): the mirror image",
            detail:
              "BACKWARD lets you drop any field — the new consumer ignores the data still sitting on old records. FORWARD lets you drop only a field that had a default, so the old consumer can fall back on it. FULL needs the default.",
          },
          {
            term: "Never rename in place",
            detail:
              "In Avro a rename is a delete plus an add — use an alias so the old name still resolves, or add the new field and migrate every consumer before removing the old one. Protobuf is the exception: it keys fields by number, so a rename never reaches the wire.",
          },
          {
            term: "Type changes are mostly breaking",
            detail:
              "Avro permits a few widening promotions — int to long, for instance — but string to int, or editing an enum's symbols, is not one. Every format has its own promotion list; check the change against the registry rather than reasoning it through.",
          },
          {
            term: "The deploy order is the mode's whole point",
            detail:
              "BACKWARD: consumers first. FORWARD: producers first. FULL: either. Getting this backwards is how a change the registry called compatible still causes an incident.",
          },
        ],
        watchOut:
          "Adding the default is not a step you can defer. In Avro a field added without one is FORWARD-compatible only — safe if the subject is FORWARD and you ship producers first, but it fails a BACKWARD or FULL check and breaks a consumer that reads old data on the new schema.",
      },
      "Deserialization failures and poison records": {
        level: "intermediate",
        summary:
          "Bytes the deserializer can't turn into an object — the wrong format, a schema id the registry can't resolve, a genuinely corrupt record. To the consumer it looks exactly like Module 3's [[poison-message|poison record]], and it stalls the partition the same way.",
        configs: ["value.deserializer"],
        points: [
          {
            term: "Where it throws",
            detail:
              "The deserializer runs inside poll(). A SerializationException comes out of poll() itself, before your handler sees a record, and the consumer's [[offset|position]] hasn't moved past the bad record — so a naive retry loop polls the same bytes forever.",
          },
          {
            term: "Causes",
            detail:
              "A producer using a different serializer, a record that predates the registry, a registry unreachable when the consumer hit a schema id it hadn't cached yet, a schema id that was hard-deleted from the registry (a normal soft delete still resolves by id, so old records keep decoding), or real disk or network corruption.",
          },
          {
            term: "The framework fix",
            detail:
              "Spring Kafka's ErrorHandlingDeserializer wraps the real deserializer, catches the exception, and passes a null value plus the failure in a header — so the error handler can route the record to a [[dead-letter-queue|dead-letter topic]] instead of throwing inside poll().",
          },
          {
            term: "The plain-client fix",
            detail:
              "Deserialize to byte[] and parse in your own code inside the loop. A failure is then an ordinary exception you catch, and you apply the same skip / dead-letter policy Module 3 built.",
          },
          {
            term: "With a registry, fewer of these are schema bugs",
            detail:
              "A schema mismatch is usually caught at registration, not at read time. The deserialization failures that remain tend to be a wrong-format producer or corruption — worth an alert, because they mean something upstream is misconfigured.",
          },
        ],
        watchOut:
          "Routing bad records to a dead-letter topic is the right move, but the DLT is an inbox, not a fix. With nothing reading and alerting on it, a poison record becomes silent data loss with extra steps.",
      },
      "When a schema registry is worth it": {
        level: "beginner",
        summary:
          "A registry is real infrastructure with real operating cost. It pays for itself when producers and consumers evolve independently; it is overhead when they don't.",
        points: [
          {
            term: "Worth it",
            detail:
              "Several teams produce to or consume from one topic; the topic is a long-lived integration boundary; you need to replay historical data across schema changes; or you have a compliance reason to document data shapes.",
          },
          {
            term: "Probably not yet",
            detail:
              "One team owns both ends, one consumer, a low change rate. A shared library holding the schema and a versioned model class gives you a checked contract with no extra service to run.",
          },
          {
            term: "The middle path",
            detail:
              "JSON Schema in a registry keeps records human-readable while still machine-checking evolution. Or start with a shared schema library and add a registry when the second independent consumer shows up.",
          },
          {
            term: "Cost of the registry",
            detail:
              "Another service to deploy, monitor, back up, and secure; its own failure modes; a client dependency on cold start. The local lab runs one under docker compose --profile extras precisely because it isn't always needed.",
          },
        ],
        watchOut:
          "Adopting a registry doesn't remove the need to think about compatibility — it moves the check from a production incident to a rejected registration. The discipline is identical either way; the registry only enforces it.",
      },
    },
    knowledgeChecks: [
      {
        question: "A producer starts sending records with a required field missing. When does Kafka itself notice?",
        options: [
          "The broker rejects the malformed records on write",
          "Never — the broker only stores bytes; the mismatch surfaces at the consumer, or at a schema registry if one is enforcing the schema",
          "The controller flags it in the metadata log",
          "The next kafka-topics.sh --describe reports a schema error",
        ],
        answerIndex: 1,
        explanation:
          "A broker never parses a key or value — it cannot reject a record for its shape, filter on a field, or warn you. Validation is entirely a client or registry concern.",
      },
      {
        question: "Your topic uses plain StringSerializer and hand-written JSON, with no registry. Does it have a data contract?",
        options: [
          "No — a data contract only exists once you add a schema registry",
          "Yes — every consumer depends on the fields the producers put there; the only question is whether that contract is written down and checked or implicit",
          "Only if every producer lives in one codebase",
          "Only for the key, not the value",
        ],
        answerIndex: 1,
        explanation:
          "The dependency between producers and consumers is the contract. A registry does not create it — it makes it explicit and machine-checked.",
      },
      {
        question: "Which is a real cost of choosing JSON over Avro for a high-volume topic?",
        options: [
          "JSON records cannot contain nested objects",
          "Field names repeat in every record, there are no native date, exact-decimal, or binary types, and no schema is checked unless you add JSON Schema separately",
          "JSON cannot be consumed by non-Java clients",
          "JSON records are capped at 1 KB",
        ],
        answerIndex: 1,
        explanation:
          "JSON is readable and universal, but every record repeats its field names, its scalar types stop at string / number / boolean / null (a timestamp or a money amount has to be encoded as one of those), and nothing validates the shape unless you bolt on JSON Schema.",
      },
      {
        question: "With the Schema Registry and the Confluent Avro serializer, what does the registry contribute to each record's bytes?",
        options: [
          "The full schema text, prepended to every record",
          "A magic byte and a 4-byte schema id — the schema itself is fetched by id on first encounter and cached (Protobuf adds a short message-index header too)",
          "Nothing; the schema is negotiated when the client connects",
          "A compressed copy of the previous record's schema",
        ],
        answerIndex: 1,
        explanation:
          "Embedding the schema would dwarf a small record. The id references it; the deserializer fetches that schema the first time it sees the id and decodes from cache after that — so in steady state the registry is hit zero times per record. (An evicted cache entry means one more lookup.)",
      },
      {
        question: "The Schema Registry goes down, and a consumer that has run for hours keeps decoding records fine. Why?",
        options: [
          "The consumer switched to a backup registry",
          "Decoding runs from the consumer's local cache of schema ids it has already fetched — the registry is off the per-record path",
          "The broker started supplying the schemas",
          "The consumer stopped validating and is reading raw bytes",
        ],
        answerIndex: 1,
        explanation:
          "A registry outage blocks new schema registration and a consumer hitting a schema id it never cached (a cold start, or a just-rolled-out producer version). A warm consumer is untouched.",
      },
      {
        question: "A subject is on BACKWARD compatibility (the default) and you are adding a field that has a default. Which side do you deploy first?",
        options: [
          "Producers first",
          "Consumers first — BACKWARD means a consumer on the new schema can read data written with the old one",
          "Either order — BACKWARD makes deploy order not matter",
          "Neither — the change is rejected",
        ],
        answerIndex: 1,
        explanation:
          "BACKWARD means new-schema consumers can read old data, so upgrade consumers first, then producers. FORWARD is the reverse; FULL allows either order.",
      },
      {
        question: "Every schema change on a subject passed a plain BACKWARD check. A consumer resets to earliest and immediately fails on the oldest records. How?",
        options: [
          "The registry lost the old schema versions",
          "Plain BACKWARD only compares each version with the one just before it — a chain of individually-backward changes can leave the newest schema unable to read the oldest records",
          "earliest is not supported when a registry is in use",
          "The oldest records were corrupted by compaction",
        ],
        answerIndex: 1,
        explanation:
          "Non-transitive modes check adjacent versions only. A consumer that replays history needs BACKWARD_TRANSITIVE, which checks the new schema against every earlier version.",
      },
      {
        question: "A SerializationException is thrown while a consumer reads a topic. Where does it come from, and what does the partition do?",
        options: [
          "From your handler, after you have seen the record; the partition keeps going",
          "From inside poll(), before your code sees a record; the position has not moved past the bad bytes, so a naive retry polls them forever and the partition stalls",
          "From the broker, which then deletes the bad record",
          "From commitSync(), and it is safe to ignore",
        ],
        answerIndex: 1,
        explanation:
          "The deserializer runs inside poll(), so the exception comes out of poll() itself. It behaves exactly like Module 3's poison record — the fix is an error-handling deserializer, or deserializing to byte[] and parsing in your own catchable code.",
      },
    ],
    activities: [],
    status: "available",
  },
  {
    slug: "producer-configuration",
    index: 6,
    title: "Producer configuration",
    summary:
      "Configuration organized by goal — durability, batching, backpressure, latency, ordering, and transactions.",
    difficulty: "intermediate",
    estimatedMinutes: 90,
    prerequisites: ["mental-model"],
    track: "reference",
    objectives: [
      "Choose an acks and min.insync.replicas pairing for a given durability requirement",
      "Explain how linger.ms and batch.size trade latency for throughput",
      "Describe what enable.idempotence guarantees and what it does not",
      "Reason about buffer exhaustion, delivery.timeout.ms, and retry behavior",
    ],
    completionCriteria: [
      "Given a durability or latency goal, you can name the producer configs that move it and their side effects",
      "You can explain why acks=all alone does not prevent data loss",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Producer configs", url: "https://kafka.apache.org/40/configuration/producer-configs/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    topics: [
      "Prevent acknowledged data loss (acks, enable.idempotence, retries)",
      "Improve batching (batch.size, linger.ms)",
      "Control memory and backpressure (buffer.memory, max.block.ms)",
      "Handle large records (max.request.size)",
      "Bound request latency (request.timeout.ms, delivery.timeout.ms)",
      "Preserve ordering during retries",
      "Use transactions (transactional.id, transaction timeouts)",
    ],
    topicDetail: {
      "Prevent acknowledged data loss (acks, enable.idempotence, retries)": {
        level: "intermediate",
        summary:
          "acks defines what \"success\" means; idempotence is what makes repeating that success safe.",
        configs: ["acks", "enable.idempotence", "retries", "min.insync.replicas"],
        points: [
          {
            term: "acks=0",
            detail:
              "The producer never waits for a response. The record may not have reached the broker at all.",
          },
          {
            term: "acks=1",
            detail:
              "The leader wrote it to its own log. If the leader dies before followers replicate, an in-sync follower can be elected without the record — you were told it succeeded and it's gone.",
          },
          {
            term: "acks=all",
            detail:
              "The leader doesn't reply until every replica currently in the ISR has the record. Necessary for broker-failure durability, but not sufficient on its own — if the ISR has shrunk to just the leader, acks=all still acknowledges a single-copy write.",
          },
          {
            term: "min.insync.replicas",
            detail:
              "A topic (or broker) config, not a producer one. The minimum ISR size an acks=all write is accepted with — set it to 2+ so a lone leader can't ack a single copy. Below it, the leader rejects produce requests with NOT_ENOUGH_REPLICAS. This, plus a replication factor above it, is what actually guarantees multiple copies exist.",
          },
          {
            term: "enable.idempotence=true (default)",
            detail:
              "Tags each batch with a producer ID and sequence number so the broker discards a retry it has already seen. This is what lets retries default to effectively unbounded without also meaning \"safe to duplicate.\"",
          },
        ],
        watchOut:
          "acks=all alone doesn't make retries safe. If a produce request times out after the broker already wrote the record, a naive retry appends it a second time — idempotence is what closes that gap.",
      },
      "Improve batching (batch.size, linger.ms)": {
        level: "intermediate",
        summary:
          "Records are grouped per partition before they're sent; fuller batches mean fewer, cheaper requests.",
        configs: ["batch.size", "linger.ms"],
        points: [
          {
            term: "Batch vs request",
            detail:
              "A batch is per-partition. One network request to a broker can bundle the batches for every partition on that broker — batches and requests aren't 1:1.",
          },
          {
            term: "linger.ms",
            detail:
              "How long the producer waits after the first record in a batch before sending anyway, trading a little latency for a fuller batch. Kafka 4.0 raised the default from 0 to 5.",
          },
          {
            term: "batch.size",
            detail:
              "The other trigger: if records fill it before linger.ms elapses, the batch sends immediately regardless of the timer.",
          },
          {
            term: "linger.ms=0",
            detail:
              "Doesn't disable batching — records that happen to arrive together still share a batch. It only disables intentionally waiting for more.",
          },
        ],
        watchOut:
          "A bigger batch.size only helps if records actually arrive fast enough to fill it. Otherwise linger.ms is doing all the work.",
      },
      "Control memory and backpressure (buffer.memory, max.block.ms)": {
        level: "intermediate",
        summary:
          "The producer buffers unsent records in memory; when that fills, send() blocks rather than failing.",
        configs: ["buffer.memory", "max.block.ms"],
        points: [
          {
            term: "buffer.memory",
            detail:
              "The budget for records buffered in the producer waiting to be sent, across all partitions. It roughly — not exactly — tracks the producer's footprint: compression buffers and in-flight requests use memory on top of it.",
          },
          {
            term: "A full buffer",
            detail:
              "send() blocks the calling thread to give the sender thread a chance to drain the buffer to the brokers — it doesn't fail immediately.",
          },
          {
            term: "max.block.ms",
            detail:
              "How long send() will block before giving up and throwing a TimeoutException.",
          },
          {
            term: "Backpressure, not data loss",
            detail:
              "A full buffer means the producer is being throttled by memory. Nothing has been lost.",
          },
        ],
        watchOut:
          "The failure mode is the opposite of a crash — a calling thread that looks hung for up to max.block.ms with no error, because nothing has actually failed yet.",
      },
      "Handle large records (max.request.size)": {
        level: "intermediate",
        summary:
          "Caps the largest request the producer will build, enforced locally inside send() before batching.",
        configs: ["max.request.size"],
        points: [
          {
            term: "What it caps",
            detail:
              "The largest single produce request, which in practice caps the largest individual record the producer will accept.",
          },
          {
            term: "Enforced synchronously",
            detail:
              "A record over the limit throws RecordTooLargeException immediately inside send(), before it's batched or sent — not as a delayed broker rejection.",
          },
          {
            term: "Only matters relative to the broker",
            detail:
              "The broker, and the topic if it overrides the broker default, enforce their own maximum message size independently.",
          },
        ],
        watchOut:
          "Raising max.request.size without raising the matching broker or topic limit just moves where the same record is rejected — from a local exception to a failed round trip.",
      },
      "Bound request latency (request.timeout.ms, delivery.timeout.ms)": {
        level: "intermediate",
        summary:
          "One bounds a single network round trip; the other bounds the whole journey from send() to final outcome.",
        configs: ["request.timeout.ms", "delivery.timeout.ms"],
        points: [
          {
            term: "request.timeout.ms",
            detail:
              "How long the producer waits for a broker's response to one produce request before treating that attempt as failed. Scoped to a single round trip.",
          },
          {
            term: "delivery.timeout.ms",
            detail:
              "The outer budget: total time from send() to success or failure, covering the linger wait, every retry, and every request.timeout.ms window along the way.",
          },
          {
            term: "The real retry bound",
            detail:
              "delivery.timeout.ms — not retries — is what actually determines how long the producer keeps trying before delivering a TimeoutException to the callback.",
          },
        ],
        watchOut:
          "request.timeout.ms must stay comfortably below delivery.timeout.ms, or one slow request can burn the entire delivery budget in a single attempt.",
      },
      "Preserve ordering during retries": {
        level: "advanced",
        summary:
          "Kafka only orders records within a partition, and retries are the easiest way to break that by accident.",
        configs: ["max.in.flight.requests.per.connection", "enable.idempotence"],
        points: [
          {
            term: "max.in.flight.requests.per.connection",
            detail:
              "How many produce requests can be outstanding to a broker at once, unacknowledged, before the producer waits for a response.",
          },
          {
            term: "How reordering happens",
            detail:
              "If more than one request is in flight and an earlier one fails and is retried while a later one already succeeded, the later record lands in the log first — silent, with no error raised.",
          },
          {
            term: "enable.idempotence=true",
            detail:
              "The broker tracks sequence numbers per partition and correctly orders out-of-sequence retries, which is why up to 5 in-flight requests stay safe.",
          },
        ],
        watchOut:
          "Without idempotence, the only way to guarantee order under retries is max.in.flight.requests.per.connection=1 — which costs throughput.",
      },
      "Use transactions (transactional.id, transaction timeouts)": {
        level: "advanced",
        summary:
          "Idempotence gives no-duplicates per partition; transactions add all-or-nothing atomicity across partitions.",
        configs: ["transactional.id", "transaction.timeout.ms"],
        points: [
          {
            term: "What idempotence lacks",
            detail:
              "A producer can write idempotently to many partitions at once, but nothing stops one partition's write succeeding while another's fails.",
          },
          {
            term: "What transactions add",
            detail:
              "Either every record across every partition in the transaction becomes visible to read_committed consumers, or none of them do.",
          },
          {
            term: "transactional.id",
            detail:
              "Turns transactions on and fences out any older producer instance still running with the same ID — the \"zombie\" after a restart. Requires enable.idempotence=true and acks=all.",
          },
          {
            term: "transaction.timeout.ms",
            detail:
              "Bounds a transaction that had a partition added but was never committed or aborted. The clock starts when the first partition is added, not at beginTransaction(), and it can't exceed the broker's transaction.max.timeout.ms.",
          },
        ],
        watchOut:
          "An open transaction blocks read_committed consumers from reading past it. When the timeout elapses the coordinator aborts it, and the producer's next attempt to continue that transaction is fenced.",
      },
    },
    activities: [
      "Compare acks=0, acks=1, and acks=all",
      "Introduce latency and measure batching and throughput",
      "Kill the partition leader during production",
      "Fill the producer buffer",
      "Send duplicates with and without idempotence",
      "Trigger record-size and delivery-timeout failures",
    ],
    status: "available",
  },
  {
    slug: "consumer-configuration",
    index: 7,
    title: "Consumer groups and resilient processing",
    summary:
      "Consumer groups, partition assignment, offset commits, rebalances, and poison-message handling — the configuration that decides what a crash or a slow batch actually costs you.",
    difficulty: "intermediate",
    estimatedMinutes: 90,
    prerequisites: ["mental-model", "build-a-producer-and-consumer"],
    track: "beginner-path",
    objectives: [
      "Explain how partitions are assigned across a consumer group and what triggers a rebalance",
      "Compare automatic and manual offset commits and their failure modes",
      "Predict what is reprocessed when a consumer crashes before or after a commit",
      "Design a retry-topic and dead-letter-topic path for poison messages",
    ],
    completionCriteria: [
      "You can explain why processing that overruns max.poll.interval.ms causes a rebalance",
      "You can describe an at-least-once consumer that never loses an acknowledged record",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Consumer configs", url: "https://kafka.apache.org/40/configuration/consumer-configs/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-05",
    topics: [
      "Consumer groups and partition assignment",
      "Polling and heartbeats",
      "Offset commits",
      "Rebalance behavior",
      "Static membership",
      "Cooperative assignment",
      "Poison messages and retry strategies",
    ],
    topicDetail: {
      "Consumer groups and partition assignment": {
        level: "beginner",
        summary:
          "A group is the unit of both scaling and offset tracking; each partition goes to exactly one member at a time.",
        configs: ["group.id", "group.protocol"],
        points: [
          {
            term: "group.id",
            detail:
              "Every consumer sharing it gets a disjoint subset of the subscribed partitions. Add a consumer and the coordinator hands it partitions to take over — that is horizontal scaling.",
          },
          {
            term: "The ceiling is the partition count",
            detail:
              "6 partitions supports at most 6 working consumers in one group. A 7th sits idle — a partition is never split across two members.",
          },
          {
            term: "Where the assignment is computed",
            detail:
              "Classic protocol: the coordinator elects one member as group leader to run the assignor. New protocol (group.protocol=consumer, Kafka 4.0): the broker computes it, with no leader.",
          },
          {
            term: "Two group.ids are independent",
            detail:
              "Same topic, different group.id: each gets every partition and tracks its own offsets. Same group.id plus more instances is scaling one consumer; a different group.id fans the same data out to a second application.",
          },
        ],
        watchOut:
          "Running more consumers than partitions doesn't add throughput — the extra members are assigned nothing and sit idle.",
      },
      "Polling and heartbeats": {
        level: "intermediate",
        summary:
          "Two independent liveness clocks watch the poll loop; conflating them is the source of most rebalance confusion.",
        configs: [
          "heartbeat.interval.ms",
          "session.timeout.ms",
          "max.poll.interval.ms",
          "max.poll.records",
          "group.protocol",
        ],
        points: [
          {
            term: "Heartbeats",
            detail:
              "A background thread sends one every heartbeat.interval.ms. If the coordinator hears none within session.timeout.ms it assumes the process is dead — a crash, a long GC pause, a network partition. This runs even while your code is mid-processing.",
          },
          {
            term: "max.poll.interval.ms",
            detail:
              "The maximum wall time allowed between two consecutive poll() calls — it catches a consumer that is alive and heartbeating but stuck in a record handler. A dynamic consumer that overruns it sends a LeaveGroup and its partitions are reassigned; a static member (group.instance.id set) stops heartbeating but keeps its assignment until the session timeout expires.",
          },
          {
            term: "max.poll.records",
            detail:
              "Caps how many records one poll() returns — the main lever for keeping a batch's total processing time under max.poll.interval.ms.",
          },
          {
            term: "Under the new protocol (KIP-848)",
            detail:
              "group.protocol=consumer: the broker drives heartbeat cadence and the session timeout, so those two client configs are ignored. max.poll.interval.ms stays a client concern under both protocols.",
          },
        ],
        watchOut:
          "A session timeout too tight for the app's GC pauses — client session.timeout.ms on the classic protocol, broker-side group.consumer.session.timeout.ms under group.protocol=consumer — or processing that keeps overrunning max.poll.interval.ms, makes a group rebalance constantly, sometimes more than it actually works.",
      },
      "Offset commits": {
        level: "beginner",
        summary:
          "A committed offset is the recovery point for the next owner of a partition — not the consumer's live read position.",
        configs: ["enable.auto.commit", "auto.commit.interval.ms"],
        points: [
          {
            term: "What it is",
            detail:
              "A bookmark in the internal __consumer_offsets topic, one per (group, topic, partition). A commit of offset N asserts \"everything below N is done.\"",
          },
          {
            term: "Not the read position",
            detail:
              "The read position is in-memory and moves every poll. The committed offset is where a new owner of the partition resumes after a restart or rebalance.",
          },
          {
            term: "enable.auto.commit=true (default)",
            detail:
              "Commits the current position during a poll() call, once auto.commit.interval.ms has elapsed — for the records returned by the previous poll, on the assumption you finished processing them.",
          },
          {
            term: "Manual commits",
            detail:
              "enable.auto.commit=false, then commitSync or commitAsync after processing — ties the commit to work completion instead of the poll loop's timing.",
          },
        ],
        watchOut:
          "Auto-commit advances the bookmark past records that were never handled if you're still processing them on another path, or crash after poll() but before the work is done.",
      },
      "Rebalance behavior": {
        level: "intermediate",
        summary:
          "Recomputing and redistributing a group's partition assignments — cheap to make rare, expensive when it's constant.",
        configs: ["partition.assignment.strategy", "group.protocol"],
        points: [
          {
            term: "What triggers it",
            detail:
              "Membership changes — a consumer joins, leaves, or is declared dead — or the subscribed topic's partition count changes.",
          },
          {
            term: "Classic eager protocol",
            detail:
              "Stop-the-world: every consumer revokes all of its partitions, the group re-forms, and new assignments go out. No partition in the group is consumed for the duration.",
          },
          {
            term: "Uncommitted records are redelivered",
            detail:
              "The new owner of a revoked partition resumes from the last committed offset, so records processed but not yet committed are handed out again and processed a second time — any external side effects from the first pass are duplicated.",
          },
          {
            term: "New protocol (group.protocol=consumer, KIP-848)",
            detail:
              "Assignment moves to the broker and reconciliation is incremental through heartbeat responses — no stop-the-world barrier, no client-side assignor. Opt-in in 4.0.",
          },
        ],
        watchOut:
          "The operational goal is two-fold: make rebalances rare (stable membership, processing that fits the poll interval) and cheap when they happen (cooperative assignment, static membership).",
      },
      "Static membership": {
        level: "advanced",
        summary:
          "Lets a restarting consumer keep its identity, so a rolling deploy doesn't cost two rebalances per instance.",
        configs: ["group.instance.id", "session.timeout.ms", "group.protocol"],
        points: [
          {
            term: "The default",
            detail:
              "A restarted consumer is a brand-new member with a fresh member ID. The restart looks like one consumer leaving and another joining — two rebalances. A rolling deploy of N instances is 2N.",
          },
          {
            term: "group.instance.id",
            detail:
              "A stable, unique value per instance tells the coordinator to remember this member across disconnects. Reconnect before the session timeout expires and it gets its exact partitions back with no rebalance.",
          },
          {
            term: "Which session timeout",
            detail:
              "Classic protocol: the client's session.timeout.ms. New protocol (group.protocol=consumer): that client config is unsupported — the broker-side group.consumer.session.timeout.ms governs the reconnect window instead.",
          },
          {
            term: "The tradeoff",
            detail:
              "A genuine failure now takes until that session timeout expires to be noticed, instead of being caught fast.",
          },
        ],
        watchOut:
          "On the classic protocol this usually means raising session.timeout.ms and pairing it with deployment tooling that bounces instances fast enough to reconnect inside that window.",
      },
      "Cooperative assignment": {
        level: "advanced",
        summary:
          "Changes what a rebalance costs — only the partitions that actually move are paused, not the whole group.",
        configs: ["partition.assignment.strategy", "group.protocol"],
        points: [
          {
            term: "How it works",
            detail:
              "The assignor computes the new distribution; only partitions that need to move are revoked (round one), then assigned to their new owners (round two). Consumers keep processing everything they're not losing.",
          },
          {
            term: "Not on by default",
            detail:
              "The default partition.assignment.strategy is [RangeAssignor, CooperativeStickyAssignor]; a group uses the first strategy every member shares — RangeAssignor, an eager one. Untouched groups do stop-the-world Range assignment.",
          },
          {
            term: "Opting in",
            detail:
              "Make CooperativeStickyAssignor the only strategy. From the default list that's one rolling bounce; from an eager-only assignor it's two — deploy both, then deploy again with the eager one removed.",
          },
          {
            term: "The \"sticky\" part",
            detail:
              "The assignor also tries to keep partitions with their existing owner across rebalances, so a transient membership blip doesn't reshuffle everything.",
          },
        ],
        watchOut:
          "The new protocol (group.protocol=consumer) sidesteps this entirely — assignment is broker-side and incremental by design, with no assignor list to manage.",
      },
      "Poison messages and retry strategies": {
        level: "intermediate",
        summary:
          "A record that always fails is either silently skipped or blocks its whole partition — which one depends on how the error handler is written.",
        points: [
          {
            term: "What it is",
            detail:
              "A record the consumer can't process no matter how many times it tries — malformed payload, an undeserializable schema, a business rule it always violates.",
          },
          {
            term: "The raw consumer skips it",
            detail:
              "poll() has already advanced the in-memory position past that batch, so an exception propagating out of the loop skips the poison record (and often the rest of its batch) rather than retrying it. That skip is only permanent once the offset is committed past it — a later poll, after auto.commit.interval.ms has elapsed, may commit past it; a restart or rebalance before that resumes from the last committed offset and redelivers the record.",
          },
          {
            term: "An unbounded retry blocks the partition",
            detail:
              "If a handler instead seeks back to reprocess with no retry ceiling, the record replays forever, the committed offset never advances, and every record behind it is blocked while lag grows without bound.",
          },
          {
            term: "Frameworks bound it for you",
            detail:
              "Spring Kafka's DefaultErrorHandler retries a fixed number of times with backoff, then hands the record to a recoverer — which logs it by default, or publishes it to a dead-letter topic when one is configured.",
          },
          {
            term: "The fix",
            detail:
              "Bound in-place retries for genuinely transient failures, then route the bad record out: a dead-letter topic (produce it with failure metadata, then commit past it), or non-blocking retry topics for transient-but-slow failures.",
          },
        ],
        watchOut:
          "The invariant: never advance the committed offset past a record until it has either been processed or deliberately routed somewhere durable.",
      },
    },
    knowledgeChecks: [
      {
        question: "Two consumer applications must each see every record on a topic. How do you set that up?",
        options: [
          "Put both in the same consumer group",
          "Give them different group.ids — each group independently gets every partition and tracks its own offsets",
          "Have them subscribe to two different topics",
          "Turn on static membership for both",
        ],
        answerIndex: 1,
        explanation:
          "Sharing a group.id splits the partitions to scale one consumer. A different group.id fans the same stream out to a second application, which reads everything on its own offsets.",
      },
      {
        question: "A consumer is alive and its background thread is heartbeating, but one record handler has been stuck for ten minutes. Which timeout catches that, and what happens?",
        options: [
          "session.timeout.ms — the consumer is declared dead on the first missed heartbeat",
          "max.poll.interval.ms — the gap between poll() calls is exceeded, so a dynamic consumer sends LeaveGroup and its partitions are reassigned",
          "request.timeout.ms — the fetch is retried",
          "Nothing — heartbeats keep it in the group indefinitely",
        ],
        answerIndex: 1,
        explanation:
          "Heartbeats prove the process is alive; max.poll.interval.ms proves the loop is making progress. Overrun it and the group takes your partitions away. max.poll.records is the main lever for keeping a batch's processing time under it.",
      },
      {
        question: "With enable.auto.commit=true, when does the consumer commit offsets?",
        options: [
          "The instant each record finishes processing",
          "On the next poll() once auto.commit.interval.ms has elapsed (for the records the previous poll returned), and once more on a clean close()",
          "Only when the application calls commitSync()",
          "Only when the consumer shuts down",
        ],
        answerIndex: 1,
        explanation:
          "Auto-commit piggybacks on poll(), on the assumption you finished the previous batch, and a clean close() flushes one final commit of the current position. Both are driven by the loop's timing, not by the work finishing — so auto-commit can advance past records you are still handling on another path, or lose work if you crash after poll() but before finishing.",
      },
      {
        question: "A group is on the default assignment strategy (classic protocol). One consumer joins. What do the other consumers do during the rebalance?",
        options: [
          "Keep processing their existing partitions",
          "Every consumer revokes all of its partitions, and no partition in the group is consumed until new assignments go out",
          "Only the joining consumer waits",
          "The group splits into two",
        ],
        answerIndex: 1,
        explanation:
          "The default list is headed by RangeAssignor, an eager strategy — stop-the-world. Making CooperativeStickyAssignor the only strategy pauses just the partitions that actually move.",
      },
      {
        question: "A partition is revoked and reassigned mid-batch. The old owner had processed 40 of 100 records but not committed. What does the new owner do?",
        options: [
          "Resumes at record 41",
          "Resumes from the last committed offset, so records 1-40 are processed a second time and any external side effects are duplicated",
          "Skips the whole batch",
          "Waits for the old owner to hand over its in-memory position",
        ],
        answerIndex: 1,
        explanation:
          "The new owner only knows the committed offset. This is why at-least-once processing has to be idempotent, and why you commit close to finishing the work.",
      },
      {
        question: "You set a stable group.instance.id on each consumer. What does that change on a rolling restart?",
        options: [
          "Restarts become instant because state is cached",
          "A reconnecting instance keeps its exact partitions with no rebalance, as long as it returns within the session timeout — at the cost of slower detection of a real failure",
          "The consumer no longer needs to commit offsets",
          "The partition count is pinned",
        ],
        answerIndex: 1,
        explanation:
          "Without it, a restart looks like one member leaving and another joining — two rebalances, 2N for N instances. With it, the coordinator holds the member's assignment across the disconnect.",
      },
      {
        question: "In the raw KafkaConsumer, an exception from a record handler propagates out of the poll loop. What is the poison record's fate?",
        options: [
          "It is retried automatically with backoff",
          "It depends on what happens next: poll() already moved the in-memory position past its batch, so catching the exception and continuing skips it, a clean close() with auto-commit on makes that skip permanent, and a crash or restart before any commit redelivers it",
          "It is routed to a dead-letter topic",
          "The broker deletes it",
        ],
        answerIndex: 1,
        explanation:
          "The raw consumer's default behaviour is to skip — but only the committed offset makes a skip stick, so an uncommitted crash replays the record. The opposite mistake is a handler that seeks back and retries forever: the offset never advances and every record behind it is blocked.",
      },
      {
        question: "What single rule keeps a poison-message strategy from either losing data or blocking a partition?",
        options: [
          "Always retry at least three times",
          "Never advance the committed offset past a record until it has been processed or deliberately routed somewhere durable",
          "Always use a dead-letter topic",
          "Always set enable.auto.commit=false",
        ],
        answerIndex: 1,
        explanation:
          "Skipping commits past an unhandled record (data loss); unbounded retry never commits (partition blocked). Bound the retries, route the bad record out with failure metadata, then commit past it.",
      },
    ],
    activities: [
      "Make processing exceed max.poll.interval.ms",
      "Add and remove consumer instances",
      "Compare automatic and manual commits",
      "Crash a consumer before and after committing",
      "Reset offsets and replay data",
      "Process a poison message using retry and dead-letter topics",
    ],
    status: "available",
  },
  {
    slug: "connect-and-streams",
    index: 8,
    title: "Kafka Connect and Kafka Streams",
    summary:
      "Move data in and out of Kafka without hand-writing a producer or consumer (Connect), and compute continuously over topics — joins, aggregations, windows — without standing up a separate processing cluster (Streams).",
    difficulty: "intermediate",
    estimatedMinutes: 115,
    prerequisites: ["build-a-producer-and-consumer", "consumer-configuration"],
    track: "beginner-path",
    objectives: [
      "Explain what a Connect source and sink connector do, and why you'd reach for Connect instead of a hand-written client",
      "Describe how Connect tracks each connector's offsets and config, and where that state lives",
      "Distinguish a KStream from a KTable and say when each is the right shape",
      "Name the state a Streams aggregation or windowed join needs, where it's stored, and how a new instance rebuilds it",
      "Run and re-run a Streams app: start it, scale it, test its topology without a broker, and reprocess from the start",
    ],
    completionCriteria: [
      "Given a data-movement problem, you can decide between Connect, a hand-written client, or neither",
      "You have run Lab D — created a file source and a file sink connector through the REST API and watched records flow through a topic",
      "You have run Lab E — an order-total aggregation as a Streams app: watched it build a KTable, restart and restore its state from the changelog, and split its work across two instances",
      "You can sketch a Streams topology for a simple aggregation and name the state store and changelog topic it needs",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Kafka Connect", url: "https://kafka.apache.org/40/kafka-connect/" },
      { label: "Apache Kafka 4.0 — Kafka Streams", url: "https://kafka.apache.org/40/streams/" },
      { label: "Apache Kafka 4.0 — Streams: testing a topology", url: "https://kafka.apache.org/40/streams/developer-guide/testing/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-07",
    labs: [connectFileLab, orderTotalsLab],
    topics: [
      "Kafka Connect: source and sink connectors",
      "Connect standalone vs. distributed mode",
      "Kafka Streams: topologies, KStream, and KTable",
      "Stateful processing: joins, aggregations, and windows",
      "Running, testing, and operating a Streams app",
    ],
    topicDetail: {
      "Kafka Connect: source and sink connectors": {
        level: "intermediate",
        summary:
          "Connect is a worker process that runs pre-built connector plugins to move data between Kafka and other systems — you configure it, you don't write it.",
        configs: ["connector.class", "tasks.max", "key.converter", "value.converter"],
        points: [
          {
            term: "Source vs. sink — one connector, one direction",
            detail:
              "A source connector reads from an external system (a file, a database, an S3 bucket, another queue) and writes records into Kafka topics. A sink connector does the reverse — reads a topic and writes each record out to an external system. If you need both directions you run two connectors.",
          },
          {
            term: "You configure, you don't code",
            detail:
              "A connector is a JSON config: the plugin class, the topic(s), where the external system is, how to authenticate. You POST it to Connect's REST API and Connect runs it. The common integrations already exist as plugins — you'd write one only for a system nobody else has.",
          },
          {
            term: "Tasks are the unit of parallelism",
            detail:
              "Connect splits a connector's work into up to tasks.max tasks and spreads them across the worker cluster, the way partitions spread across a [[consumer-group|consumer group]]. A file source runs one task; a database source might run one per table.",
          },
          {
            term: "Converters do the serialization",
            detail:
              "key.converter / value.converter turn Connect's internal record shape into the bytes on the topic — JsonConverter, or an Avro / Protobuf converter backed by a [[schema-registry|registry]]. This is Connect's version of the serializer you set by hand in the producer/consumer module.",
          },
          {
            term: "Connect owns the offsets",
            detail:
              "A source connector's position in the external system (which file byte, which database row) is tracked by Connect — in an internal topic on a distributed worker, a local file in standalone. By default it's committed periodically, not per record, so a restart resumes from the last committed position and may re-emit a little: source delivery is at-least-once. Exactly-once source delivery is possible but needs both sides — `exactly.once.source.support` enabled on a distributed worker *and* a connector that declares it can support it for the given config. A sink connector commits ordinary Kafka consumer offsets, just like any [[consumer|consumer]].",
          },
        ],
        watchOut:
          "Connect is not a transformation engine. Single Message Transforms can rename or route a field, but anything stateful — joins, aggregations, windowing — is a job for Kafka Streams, not a connector.",
      },
      "Connect standalone vs. distributed mode": {
        level: "intermediate",
        summary:
          "The same connectors, run either by one process reading local config files, or by a cluster of workers that coordinate through Kafka.",
        configs: ["group.id", "config.storage.topic", "offset.storage.topic", "status.storage.topic"],
        points: [
          {
            term: "Standalone",
            detail:
              "One worker process, connector configs passed as .properties files at startup, source offsets in a local file. The REST API still runs and still accepts connector changes — but a connector you add or edit at runtime is held only in memory and gone on the next restart. Fine for a laptop demo or a single-machine edge collector — no fault tolerance.",
          },
          {
            term: "Distributed",
            detail:
              "Several worker processes sharing a group.id. Connector configs, source offsets, and connector status all live in internal Kafka topics, so any worker can pick up any task and a worker dying just moves its tasks elsewhere.",
          },
          {
            term: "The REST API is how you drive Connect",
            detail:
              "Both modes expose it on port 8083; distributed is where it matters. You PUT a connector config to any worker and the cluster rebalances the work and stores that config durably in a topic — no worker restart, and the change survives one. GET the same paths for status and offsets, DELETE to remove one.",
          },
          {
            term: "Even one worker runs distributed",
            detail:
              "A single-worker distributed cluster still behaves like the real thing — configs in topics, REST API, rebalancing — which is why the lab, and most production setups, run distributed even on one node.",
          },
        ],
        watchOut:
          "The three internal topics are the cluster's memory. Wipe offset.storage.topic and every source connector forgets its position and re-reads its source from the start; wipe config.storage.topic and the connectors themselves are gone.",
      },
      "Kafka Streams: topologies, KStream, and KTable": {
        level: "intermediate",
        summary:
          "A Java library — not a cluster — that reads topics, runs each record through a topology of operations, and writes the results back to topics.",
        configs: ["application.id", "num.stream.threads", "processing.guarantee", "default.key.serde", "default.value.serde"],
        points: [
          {
            term: "A library, not a service",
            detail:
              "Kafka Streams runs inside your application process: add the dependency, define a topology, call start(). You scale out by running more copies of your app with the same application.id — they form a consumer group and split the partitions, exactly like the consumers in the previous module.",
          },
          {
            term: "A topology is a graph of steps",
            detail:
              "Source (read a topic) → operations (map, filter, join, aggregate) → sink (write a topic). The DSL builds that [[topology|graph]]; Streams runs it record by record. builder.build() hands you the Topology object — the same one a unit test can run with no broker (see \"Running, testing, and operating a Streams app\").",
          },
          {
            term: "KStream — a stream of events",
            detail:
              "Every record is an independent fact: \"order 5 placed\", \"order 6 placed\". map / filter / flatMap over a KStream are stateless — each record is handled on its own.",
          },
          {
            term: "KTable — the latest value per key",
            detail:
              "A KTable is the current state built from a stream of updates: keyed by customer id, it holds each customer's latest record, and a new record for that key replaces the old one. It is the [[log-compaction|compacted-topic]] idea as a first-class type. A GlobalKTable is the variant every instance holds a full copy of — small reference data you join against without co-partitioning it.",
          },
          {
            term: "The stream/table duality",
            detail:
              "A KStream can be aggregated into a KTable (fold the events into a running total); a KTable's changes can be read back as a KStream (each update is an event). Choosing the right one is most of Streams design.",
          },
          {
            term: "Every edge needs a serde",
            detail:
              "A serde is a serializer+deserializer pair — Streams has to turn bytes into typed keys and values at every topic it reads, and back to bytes at every topic it writes, repartition, or state store. Set defaults with default.key.serde / default.value.serde, or pass one inline (Consumed.with, Produced.with, Grouped.with, Materialized.with) where a step's type differs. A missing or wrong serde is the most common first-run failure.",
          },
        ],
        watchOut:
          "application.id is also the consumer group id and the prefix for every internal topic Streams creates. Two different apps sharing an application.id will steal each other's partitions and corrupt each other's state.",
      },
      "Stateful processing: joins, aggregations, and windows": {
        level: "intermediate",
        summary:
          "The operations that have to remember something — a running count, the other side of a join, the events in the last five minutes — and where Streams keeps that memory.",
        configs: ["state.dir", "commit.interval.ms", "statestore.cache.max.bytes", "num.standby.replicas"],
        points: [
          {
            term: "State stores",
            detail:
              "A stateful operation keeps a local key/value [[state-store|store]] (RocksDB on disk by default) on the instance that owns that key's partition. count() by customer keeps each customer's running total there.",
          },
          {
            term: "Backed by a changelog topic",
            detail:
              "By default each state store is mirrored to a compacted Kafka changelog topic. If the instance dies, another replays that changelog to rebuild the store before taking over — the local store is a cache, the changelog is the truth. Two exceptions: you can disable changelogging for a store, and a store that just materializes an existing topic can rebuild straight from that topic instead.",
          },
          {
            term: "Aggregations",
            detail:
              "groupByKey().count() / .reduce() / .aggregate() fold a stream into a KTable. Each input record updates the stored value; the new result is emitted downstream — though not necessarily once per input (see the next point).",
          },
          {
            term: "Downstream output is deduplicated by default",
            detail:
              "A record cache (statestore.cache.max.bytes, ~10 MB by default) plus the commit interval (commit.interval.ms, 30s) mean many updates to one key collapse into a single emitted record — Streams forwards the latest value per key when the cache fills or the interval elapses, not on every input. Set the cache to 0 to see every intermediate result (useful in a lab; wasteful in production).",
          },
          {
            term: "Windows",
            detail:
              "Time-bound the aggregation: \"orders per customer per hour\" is a windowed count. Streams keeps one store entry per (key, window) and drops windows older than a retention you set; late records still update their window while it is within the grace period.",
          },
          {
            term: "Joins",
            detail:
              "A stream–table join enriches each event with the current value from a KTable (an order plus the customer's details). A stream–stream join matches events from two streams that arrive within a time window (a click and the purchase it led to). Both sides must be co-partitioned — same key, same partition count — so the matching keys land on the same instance; Streams checks this and fails fast if it doesn't hold. (A GlobalKTable join is the exception — the table is copied everywhere, so no co-partitioning.)",
          },
        ],
        watchOut:
          "A windowed store grows with distinct keys times live windows. A high-cardinality key (a UUID per event) with hour-long windows kept for a day is millions of entries per instance — window on something bounded, or keep the retention short.",
      },
      "Running, testing, and operating a Streams app": {
        level: "intermediate",
        summary:
          "A Streams app is just a program you run — no cluster to deploy. This is the operational side: starting and scaling the process, failing over its state, testing a topology with no broker, and reprocessing input from the beginning when the logic changes.",
        configs: ["num.stream.threads", "num.standby.replicas", "processing.guarantee", "state.dir"],
        points: [
          {
            term: "You run it; there is no cluster",
            detail:
              "Package the app as an ordinary JAR and run one or more copies. new KafkaStreams(topology, config).start() kicks off a state machine — CREATED → REBALANCING → RUNNING — and a StateListener lets you watch it. Add a shutdown hook that calls close() so a stopped instance leaves its consumer group cleanly.",
          },
          {
            term: "Scale and fail over through the consumer group",
            detail:
              "More copies with the same application.id, or a higher num.stream.threads, spread the partitions wider — same rebalance mechanics as any consumer group. When an instance dies, another picks up its partitions and rebuilds its state stores from the changelog first. num.standby.replicas (0 by default) keeps warm copies of each store on other instances, continuously tailing the changelog; on takeover a standby replays only whatever it hadn't yet caught up to — nothing if it was current, just the gap if it had fallen behind — never the whole changelog.",
          },
          {
            term: "Test the topology with no broker",
            detail:
              "TopologyTestDriver (the kafka-streams-test-utils artifact) runs a Topology entirely in memory: pipe records into a TestInputTopic, read them from a TestOutputTopic, and query the state stores directly. No Kafka, millisecond tests, deterministic — the topology builder should be a pure function of its topic names so a test can construct it. This is the harness Lab E's OrderTotalsTopologyTest uses.",
          },
          {
            term: "Reprocessing: the application reset tool",
            detail:
              "Change the aggregation logic and you often want to recompute from the start. kafka-streams-application-reset.sh (all instances stopped first) rewinds the group's committed offsets on the input topics and deletes the internal repartition and changelog topics. Three things it does not do: it leaves the consumer group itself (just seeked to the start); it does not touch the local state directories (the app must also call KafkaStreams.cleanUp() before start(), or you delete state.dir by hand); and it does not touch the output topics — a reprocessed run appends a fresh set of results after the old ones, so truncate or recreate an output topic if you need it clean.",
          },
          {
            term: "Interactive queries",
            detail:
              "The state store is queryable from inside the app — KafkaStreams.store(...) reads the running total for a key without a round trip through the output topic. Combined with the metadata API (which instance owns which key) it lets a Streams app serve its own aggregates over HTTP. The output topic is still the way to hand results to other systems.",
          },
        ],
        watchOut:
          "The reset tool clears the cluster-side state but not the local state.dir, and two instances on one machine share that directory — give each its own state.dir or the second fails to take the RocksDB lock. A \"reset\" that skips cleanUp() / the local directory silently resumes from stale local state.",
      },
    },
    knowledgeChecks: [
      {
        question: "You need to load rows from a Postgres table into a Kafka topic, and also write another topic's records into Elasticsearch. How many connectors?",
        options: [
          "One connector, configured for both directions",
          "Two — a source connector for Postgres to Kafka, and a sink connector for Kafka to Elasticsearch",
          "One source connector; sinks are automatic",
          "None — Connect cannot talk to databases",
        ],
        answerIndex: 1,
        explanation:
          "A connector moves data one direction: a source reads an external system into Kafka, a sink reads a topic out to an external system. Both directions means two connectors.",
      },
      {
        question: "How do you deploy a FileStreamSourceConnector on a Connect worker?",
        options: [
          "Compile it into the worker and restart",
          "POST a JSON config — plugin class, topic, file path — to Connect's REST API on port 8083",
          "Write a Java class that extends KafkaConsumer",
          "Add it to the broker's server.properties",
        ],
        answerIndex: 1,
        explanation:
          "A connector is a JSON config you POST to the REST API; Connect runs the pre-built plugin. You would write a connector only for a system no existing plugin covers.",
      },
      {
        question: "A distributed Connect worker restarts. Where does a source connector resume from, and what is the delivery guarantee?",
        options: [
          "From the exact last record; exactly-once by default",
          "From the last position committed to an internal offsets topic — committed periodically, not per record — so it may re-emit a little: at-least-once by default",
          "From the start of the source every time",
          "It does not resume; you recreate the connector",
        ],
        answerIndex: 1,
        explanation:
          "Connect tracks a source's external position (which file byte, which database row) in an internal topic on a distributed worker (a local file in standalone), committed on an interval. Exactly-once source delivery needs exactly.once.source.support on the worker AND a connector that declares it supports it.",
      },
      {
        question: "You need to join two topics and emit a running per-customer total. Connect or Kafka Streams?",
        options: [
          "Connect, with a Single Message Transform",
          "Kafka Streams — anything stateful (joins, aggregations, windows) is Streams' job, not a connector's",
          "A sink connector with a custom aggregator",
          "Either works equally well",
        ],
        answerIndex: 1,
        explanation:
          "Single Message Transforms can rename or route a field, but they are stateless and per-record. Joins and aggregations need Streams — Connect is not a transformation engine.",
      },
      {
        question: "You are modelling \"each customer's current loyalty-point balance\". Which Streams abstraction fits?",
        options: [
          "A KStream — every balance change is an independent event",
          "A KTable — the latest value per key, where a new record for a customer replaces the old one",
          "A windowed aggregation over five-minute buckets",
          "A stream-stream join",
        ],
        answerIndex: 1,
        explanation:
          "A KTable is the current state built from a stream of updates — the compacted-topic idea as a first-class type. A KStream treats every record as a standalone fact.",
      },
      {
        question: "Two different Streams apps are accidentally deployed with the same application.id. What goes wrong?",
        options: [
          "Nothing — application.id is only a label",
          "They form one consumer group and split each other's partitions, and they collide on the internal topics prefixed by that id — corrupting each other's state",
          "The second app refuses to start",
          "They merge into a single topology",
        ],
        answerIndex: 1,
        explanation:
          "application.id is both the consumer group id and the prefix for every internal (changelog, repartition) topic Streams creates. It has to be unique per application.",
      },
      {
        question: "A Streams instance running a per-customer count() crashes, and another instance takes over its partitions. How does it get the running totals?",
        options: [
          "It starts every customer's count from zero",
          "It replays the store's compacted changelog topic to rebuild the local state store before taking over — the local store is a cache, the changelog is the truth",
          "It reads the totals back from the output topic",
          "It queries the crashed instance over the network",
        ],
        answerIndex: 1,
        explanation:
          "Each state store is mirrored to a compacted changelog topic; on failover another instance replays it. A store that only materializes an existing topic can rebuild from that topic instead, and changelogging can be disabled per store.",
      },
      {
        question: "You change a Streams aggregation's logic and run kafka-streams-application-reset.sh with all instances stopped. Which of these does it NOT do?",
        options: [
          "Rewind the group's committed offsets on the input topics to the start",
          "Delete the internal repartition and changelog topics",
          "Delete the app's local RocksDB state directories and truncate the output topics",
          "Leave the consumer group itself in place, just seeked to the start",
        ],
        answerIndex: 2,
        explanation:
          "The reset tool only touches cluster-side state. It does not clear the local state.dir — the app must call KafkaStreams.cleanUp() before start(), or you delete it by hand — and it does not touch output topics, so a reprocessed run appends its results after the old ones.",
      },
    ],
    activities: [],
    status: "available",
  },
  {
    slug: "broker-topic-configuration",
    index: 9,
    title: "Broker and topic configuration",
    summary:
      "Replication, retention, compaction, request limits, quotas, and listener/security configuration.",
    difficulty: "advanced",
    estimatedMinutes: 100,
    prerequisites: ["mental-model", "producer-configuration", "consumer-configuration"],
    track: "reference",
    objectives: [
      "Explain how replication factor, min.insync.replicas, and the ISR interact during a failure",
      "Contrast delete and compact cleanup and pick one for a given topic",
      "Reason about retention.bytes as a per-partition limit when sizing a topic",
      "Describe how client quotas throttle rather than reject traffic",
    ],
    completionCriteria: [
      "You can size a topic's disk footprint from retention, partition count, and replication factor",
      "You can explain what NOT_ENOUGH_REPLICAS means and the safe ways to clear it",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Broker configs", url: "https://kafka.apache.org/40/configuration/broker-configs/" },
      { label: "Apache Kafka 4.0 — Topic configs", url: "https://kafka.apache.org/40/configuration/topic-level-configs/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    topics: [
      "Replication and durability",
      "Retention and compaction",
      "Segment management",
      "Request and record-size limits",
      "Network and I/O threads",
      "Quotas",
      "Controller and KRaft settings",
      "Listener configuration",
      "Security",
      "Rack awareness",
      "Automatic topic creation and defaults",
    ],
    topicDetail: {
      "Replication and durability": {
        level: "intermediate",
        summary:
          "How many copies of each partition exist, and how many must confirm a write before it counts.",
        configs: ["replication.factor", "min.insync.replicas", "unclean.leader.election.enable"],
        points: [
          {
            term: "replication.factor",
            detail:
              "The number of copies of each partition, on that many distinct brokers. Partitions use a leader plus its ISR, not quorum voting (that's KRaft metadata). 3 is the common production choice: lose one broker and two replicas remain — enough for min.insync.replicas=2 to keep acks=all writes flowing, as long as those survivors are in sync. Set per topic at creation, or via default.replication.factor.",
          },
          {
            term: "min.insync.replicas",
            detail:
              "With acks=all the leader waits for every replica currently in the ISR to have the batch. min.insync.replicas is the admission floor: if the ISR is smaller than it, the write is rejected. replication.factor=3 with min.insync.replicas=2 keeps writes flowing with one broker down; setting it equal to the replication factor tolerates none.",
          },
          {
            term: "unclean.leader.election.enable",
            detail:
              "Default false: a partition with no in-sync replica stays offline rather than promoting a stale one and losing committed records. Setting it true trades those records for availability.",
          },
          {
            term: "It's a per-topic decision",
            detail:
              "Broker defaults only apply at creation time; each topic can override. Changing a topic's replication factor afterward requires a partition reassignment, not just a config edit.",
          },
        ],
        watchOut:
          "replication.factor=2 with min.insync.replicas=2 is a trap: one broker down drops you below the floor and every acks=all produce starts failing. Keep the replication factor above min.insync.replicas.",
      },
      "Retention and compaction": {
        level: "intermediate",
        summary:
          "Two independent ways a partition sheds old data: delete by age or size, or compact to the latest value per key.",
        configs: ["cleanup.policy", "retention.ms", "retention.bytes"],
        points: [
          {
            term: "cleanup.policy=delete (default)",
            detail:
              "A segment ages out once all of its records are older than retention.ms, or the partition exceeds retention.bytes. Deletion is whole-segment, never per-record.",
          },
          {
            term: "cleanup.policy=compact",
            detail:
              "Keeps at least the latest value for each key indefinitely; older values for that key are removed over time. A key written with a null value (a tombstone) is kept briefly, then dropped — that's how deletes propagate to consumers.",
          },
          {
            term: "compact,delete",
            detail:
              "Both policies at once: compact by key, and also drop anything past the retention window.",
          },
          {
            term: "Retention is not a read guarantee",
            detail:
              "A consumer that falls further behind than retention skips whatever aged out before it got there. Lag alerts exist partly to catch that.",
          },
        ],
        watchOut:
          "Compaction only promises the latest value per key survives — never rely on replaying the full history of a compacted topic.",
      },
      "Segment management": {
        level: "advanced",
        summary:
          "A partition's log is a series of segment files; retention, compaction, and indexing all operate on whole segments.",
        preface:
          "A partition isn't one giant file — Kafka writes it as a stack of smaller files, and periodically closes the current one and starts a fresh one. You don't manage that directly, but the sizes below decide how coarse retention and compaction actually are, and how many files a busy broker ends up juggling.",
        configs: ["segment.bytes", "segment.ms", "index.interval.bytes"],
        points: [
          {
            term: "The active segment",
            detail:
              "Writes append to one active segment. When it reaches segment.bytes or segment.ms it's rolled closed and a new one opens. Only closed segments are eligible for deletion or compaction.",
          },
          {
            term: "Size is a trade-off",
            detail:
              "Large segments mean fewer files but coarser retention — a segment isn't removed until its newest record ages out. Small segments free data promptly but multiply file handles and index files.",
          },
          {
            term: "Indexes per segment",
            detail:
              "Each segment carries an offset index and a time index, so a lookup by offset or timestamp is a binary search plus a short scan rather than a full read.",
          },
        ],
        watchOut:
          "Retention granularity is the segment: retention.ms only takes effect once the whole segment is old enough, so a low-traffic partition can hold data well past retention.ms because its active segment hasn't rolled.",
      },
      "Request and record-size limits": {
        level: "advanced",
        summary:
          "The broker caps the size of a record batch it will accept — a hard limit the producer and topic must agree on, plus softer fetch limits on the replication and consume paths.",
        preface:
          "There's a ceiling on how big a single record (really, a batch) Kafka will store, and a separate, softer ceiling on how much a fetch returns at once. As a beginner you'll rarely hit either — it becomes relevant the day someone tries to push an unusually large payload through and the send fails outright instead of just going slowly.",
        configs: ["message.max.bytes", "max.message.bytes", "replica.fetch.max.bytes"],
        points: [
          {
            term: "message.max.bytes",
            detail:
              "The largest record batch the broker accepts; max.message.bytes overrides it per topic. A batch over the limit is rejected with RecordTooLargeException.",
          },
          {
            term: "The fetch limits are soft",
            detail:
              "If the first record batch is larger than replica.fetch.max.bytes, the leader returns it in full anyway so replication still progresses. Keeping replica.fetch.max.bytes at or above message.max.bytes just avoids single-batch fetches capping replication throughput.",
          },
          {
            term: "Consumer side",
            detail:
              "fetch.max.bytes and max.partition.fetch.bytes bound how much one fetch returns. A record batch larger than them is still returned in full (so a consumer can't get stuck), just one batch per fetch.",
          },
        ],
        watchOut:
          "The hard limit is message.max.bytes (or the topic's max.message.bytes): a batch over it is rejected outright with RecordTooLargeException. Set the producer's max.request.size and the broker/topic limit together so the producer never builds a batch the broker will refuse.",
      },
      "Network and I/O threads": {
        level: "advanced",
        summary:
          "Two broker thread pools: network threads move bytes on and off sockets; I/O threads do the actual request work.",
        preface:
          "Behind every request a broker serves, two pools of threads hand work to each other — one just moving bytes on and off the network, the other doing the real work of reading and writing the log. Nothing here to tune on day one; it starts to matter once a broker is struggling and you need to know which pool is actually the bottleneck.",
        configs: ["num.network.threads", "num.io.threads", "queued.max.requests"],
        points: [
          {
            term: "num.network.threads",
            detail:
              "Handle socket reads and writes and hand requests to a shared queue. Rarely the bottleneck; scale with connection count and raw byte throughput.",
          },
          {
            term: "num.io.threads",
            detail:
              "Pull from the request queue and do the work — appending to the log, serving fetches, updating metadata. The usual lever when request-handler idle time drops.",
          },
          {
            term: "The queue between them",
            detail:
              "queued.max.requests bounds the backlog. When it fills, network threads stop reading new requests — backpressure onto clients.",
          },
        ],
        watchOut:
          "The signal is request-handler-avg-idle-percent, not CPU. Low idle there means add I/O threads or faster disks; adding network threads instead does nothing, since I/O threads block on the page cache and disk.",
      },
      "Quotas": {
        level: "advanced",
        summary:
          "Per-client throttles on produce and fetch bandwidth and on request-handler time, so one client can't starve the cluster.",
        preface:
          "Quotas exist so one noisy or misbehaving client can't starve everyone else sharing the cluster — think of them as a speed bump, not a wall. You won't set these as a beginner; you'll meet them from the other side, when a client mysteriously slows down for no visible reason instead of throwing an error.",
        configs: ["producer_byte_rate", "consumer_byte_rate", "request_percentage"],
        points: [
          {
            term: "Bandwidth quotas",
            detail:
              "producer_byte_rate and consumer_byte_rate cap bytes per second per client. The broker enforces them by delaying the client's responses — it stays connected, just slower.",
          },
          {
            term: "Request quota",
            detail:
              "request_percentage caps the share of network + I/O thread time a client may consume — for clients that are cheap on bytes but heavy on request rate, like a metadata storm.",
          },
          {
            term: "How they're keyed",
            detail:
              "By client-id, by (user, client-id), or by user with authentication. Applied via kafka-configs.sh against the clients / users entities; dynamic, no restart.",
          },
        ],
        watchOut:
          "Throttling appears to the client as latency, not errors — a throttled producer just looks slow. The produce/fetch throttle-time metrics are how you tell it apart from real slowness.",
      },
      "Controller and KRaft settings": {
        level: "advanced",
        summary:
          "In KRaft a quorum of controller nodes keeps cluster metadata in its own replicated log; these settings define that quorum.",
        preface:
          "Somewhere in the cluster, a small group of nodes has to agree on which broker leads which partition — that's the controller's job, and KRaft is how it reaches that agreement without ZooKeeper. You met the idea of a leader and a controller back in the Keys, ordering, and delivery module; this is the operational detail of standing its quorum up and keeping it healthy.",
        configs: ["process.roles", "controller.quorum.voters", "controller.quorum.bootstrap.servers"],
        points: [
          {
            term: "process.roles",
            detail:
              "broker, controller, or both. Combined mode co-locates them (fine for small clusters); dedicated controllers isolate metadata from data-plane load.",
          },
          {
            term: "Defining the quorum",
            detail:
              "A static quorum is a fixed id@host:port list in controller.quorum.voters. Kafka 4.0's dynamic quorum instead uses controller.quorum.bootstrap.servers, with the initial members set at format time (--initial-controllers) and voters added or removed while running. Either way it's usually 3 nodes, tolerating one loss.",
          },
          {
            term: "The metadata log",
            detail:
              "__cluster_metadata is a single-partition Raft log the active controller writes and everyone else replicates. Brokers pull metadata changes from it rather than being pushed updates as under ZooKeeper.",
          },
        ],
        watchOut:
          "Losing quorum — 2 of 3 controllers down — freezes all metadata changes: no leader elections, no topic creation, even though existing partition leaders keep serving. Controller nodes are critical infrastructure.",
      },
      "Listener configuration": {
        level: "advanced",
        summary:
          "A broker exposes several named listeners on different ports for different traffic — internal, external, controller — each with its own security.",
        preface:
          "A broker doesn't have just one address — it can expose several, one for clients, one for other brokers, one for the controller quorum, each potentially with its own security. Getting this right is mostly an ordinary networking problem wearing a Kafka costume, and misconfiguring it produces one of the most confusing failure modes in the whole system.",
        configs: ["listeners", "advertised.listeners", "inter.broker.listener.name"],
        points: [
          {
            term: "listeners vs advertised.listeners",
            detail:
              "listeners is what the broker binds locally; advertised.listeners is the address it hands back to clients to reconnect on. They differ whenever there's NAT, a load balancer, or Docker port mapping.",
          },
          {
            term: "listener.security.protocol.map",
            detail:
              "Maps each listener name to a protocol — PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL — so different listeners can enforce different security.",
          },
          {
            term: "Separate listeners for separate roles",
            detail:
              "inter.broker.listener.name keeps broker-to-broker traffic off the client listener; controller.listener.names is the KRaft quorum's listener and must not be advertised to clients.",
          },
        ],
        watchOut:
          "A wrong advertised.listeners is the classic \"connects, then times out\": the client reaches the bootstrap broker, gets back an address it can't route to, and hangs on the next request.",
      },
      "Security": {
        level: "intermediate",
        summary:
          "Three independent layers: encryption in transit, authentication (who), and authorization (what they may do).",
        configs: ["security.protocol", "sasl.mechanism", "authorizer.class.name"],
        points: [
          {
            term: "Encryption",
            detail:
              "TLS on a listener encrypts traffic and, with mutual TLS, can also authenticate. SASL_SSL is SASL authentication over a TLS channel.",
          },
          {
            term: "Authentication",
            detail:
              "SASL mechanisms: PLAIN (only safe over TLS), SCRAM (salted, credentials in Kafka's own metadata), GSSAPI (Kerberos), OAUTHBEARER — or mutual TLS with the client certificate's DN as the principal.",
          },
          {
            term: "Authorization",
            detail:
              "An authorizer (StandardAuthorizer in KRaft) checks ACLs per principal, operation, and resource. Configuring one makes the cluster default-deny unless allow.everyone.if.no.acl.found is set.",
          },
        ],
        watchOut:
          "SASL/PLAIN sends the password in the clear, so it's only safe on a TLS listener. SCRAM uses a salted challenge-response and never transmits the password itself — but without TLS the channel still isn't confidential, so use SASL_SSL for anything exposed either way.",
      },
      "Rack awareness": {
        level: "advanced",
        summary:
          "Tell each broker its failure domain so a partition's replicas are spread across domains rather than stacked in one.",
        preface:
          "Replication factor 3 only makes a broker loss survivable if the replicas left standing are actually in sync — an out-of-sync copy doesn't count, and can't become leader without accepting data loss. Even when that holds, it protects you from nothing if all three replicas happen to sit in the same physical rack, data-center room, or cloud availability zone and that whole zone goes down together. Rack awareness is telling Kafka about that physical layout so it spreads replicas across it on purpose.",
        configs: ["broker.rack", "replica.selector.class", "client.rack"],
        points: [
          {
            term: "broker.rack",
            detail:
              "A label per broker — typically the availability zone. The replica assignor then places a partition's replicas across as many distinct racks as it can.",
          },
          {
            term: "Why it matters",
            detail:
              "Without it, all three replicas of a partition can land in one zone; that zone fails and the partition is offline despite replication.factor=3.",
          },
          {
            term: "Rack-aware fetching",
            detail:
              "Two settings, both required: the broker's replica.selector.class set to the rack-aware selector, and each consumer's client.rack set to its zone. The consumer can then fetch from an in-sync follower in its own rack instead of the leader, cutting cross-zone transfer cost.",
          },
        ],
        watchOut:
          "Rack-aware placement only affects new assignments — adding broker.rack to a running cluster won't spread existing replicas across racks without a partition reassignment. Rack-aware fetching, by contrast, starts working on existing partitions as soon as replica.selector.class and client.rack are set.",
      },
      "Automatic topic creation and defaults": {
        level: "intermediate",
        summary:
          "Whether a produce or fetch to a missing topic creates it, and the defaults it would inherit.",
        configs: ["auto.create.topics.enable", "num.partitions", "default.replication.factor"],
        points: [
          {
            term: "auto.create.topics.enable",
            detail:
              "Default true on the broker. A client referencing a topic that doesn't exist triggers creation with num.partitions and default.replication.factor.",
          },
          {
            term: "Why turn it off",
            detail:
              "Auto-created topics inherit generic defaults and a mistyped topic name silently becomes a real topic. Explicit creation forces a deliberate partition count and replication factor.",
          },
          {
            term: "The defaults still apply",
            detail:
              "Even with auto-create off, num.partitions and default.replication.factor are the fallback whenever a create request omits them.",
          },
        ],
        watchOut:
          "default.replication.factor=1 is the dangerous default on a multi-broker cluster: any topic created without an explicit factor has no redundancy at all.",
      },
    },
    activities: [
      "Shrink the ISR below min.insync.replicas and watch acks=all writes fail",
      "Compare delete and compact cleanup on the same keyed log",
      "Spread replicas across racks, then fail a rack",
      "Push a client past its byte-rate quota and watch it slow, not error",
    ],
    status: "available",
  },
  {
    slug: "observability",
    index: 10,
    title: "Observability",
    summary: "Moving from symptom to evidence across lag, ISR, latency, disk, network, and GC signals.",
    difficulty: "advanced",
    estimatedMinutes: 80,
    prerequisites: ["mental-model", "local-cluster-lab"],
    track: "reference",
    objectives: [
      "Read an unlabeled dashboard and name the bottleneck: producer, broker, consumer, disk, network, or downstream",
      "Tell a runaway lag slope from a flat-but-breaching backlog",
      "Break a request-latency total into its queue, local, and remote phases",
      "Localize ISR churn to one slow broker versus a shared cause",
    ],
    completionCriteria: [
      "Given a set of metrics, you can state the single most likely bottleneck and the next check",
      "You know which signals kafka-exporter alone cannot see (GC, heap) and why that matters",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Monitoring", url: "https://kafka.apache.org/40/operations/monitoring/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    topics: [
      "Consumer lag and lag growth rate",
      "Under-replicated and offline partitions",
      "ISR changes",
      "Request latency and request queues",
      "Produce and fetch error rates",
      "Disk usage and disk latency",
      "Network saturation",
      "Controller health",
      "JVM memory and garbage collection",
      "Rebalance frequency",
      "Log-cleaner performance",
    ],
    topicDetail: {
      "Consumer lag and lag growth rate": {
        level: "intermediate",
        summary:
          "How far behind a consumer group is, and whether the gap is stable, shrinking, or running away.",
        points: [
          {
            term: "Lag",
            detail:
              "log-end-offset minus the group's committed offset, per partition. A steadily rising lag means consumption can't keep up with production.",
          },
          {
            term: "Slope first, then the absolute value",
            detail:
              "A rising slope pages you regardless of where lag started. But flat isn't automatically fine: a steady 10k still has to clear your latency SLA — check time lag, how old the next unread record is — and sit well inside retention.",
          },
          {
            term: "Break it down by partition",
            detail:
              "Total lag can look flat while one partition is stuck — a poison message, a hot key — and the rest race ahead. Always look per partition, not just the group total.",
          },
        ],
        watchOut:
          "Lag on a short-retention topic is doubly urgent: fall further behind than retention and the records are deleted before the consumer reads them — the data is simply gone.",
      },
      "Under-replicated and offline partitions": {
        level: "intermediate",
        summary:
          "Partitions that don't currently have their full in-sync replica set — or no leader at all.",
        points: [
          {
            term: "UnderReplicatedPartitions",
            detail:
              "A broker gauge: partitions where the ISR is smaller than the replica set. Non-zero means a replica is down or lagging; it should return to zero on its own once the broker recovers.",
          },
          {
            term: "OfflinePartitionsCount",
            detail:
              "Partitions with no leader — every replica down, or no in-sync replica left and unclean election off. Unavailable for reads and writes.",
          },
          {
            term: "Where to look",
            detail:
              "ReplicaManager JMX metrics, or kafka-topics.sh --describe --under-replicated-partitions. The controller tracks it too.",
          },
        ],
        watchOut:
          "A brief spike during a rolling restart is normal. A sustained non-zero count, or any offline partition, is an incident — start with which brokers the affected replicas live on.",
      },
      "ISR changes": {
        level: "advanced",
        summary:
          "How often replicas drop out of and rejoin the in-sync set — a proxy for replication health.",
        points: [
          {
            term: "IsrShrinksPerSec / IsrExpandsPerSec",
            detail:
              "A shrink means a follower fell behind replica.lag.time.max.ms; an expand means it caught back up. One pair around an isolated event — a broker restart, a brief network blip — is expected. Repeated shrink/expand under normal load is not: it means a follower that can't sustain the load.",
          },
          {
            term: "What's behind it",
            detail:
              "An overloaded or slow-disk broker, a saturated inter-broker network, or a GC-pausing follower. Churn is the early warning before under-replication becomes chronic.",
          },
          {
            term: "Localize it first",
            detail:
              "Often it's one broker — the one whose followers keep falling behind, or that leads a hot partition. But shared causes (a saturated network fabric, a common storage backend, correlated GC under a load spike) churn ISRs across many brokers at once. Check whether it's one broker or several before diagnosing.",
          },
        ],
        watchOut:
          "Steady shrink/expand churn with min.insync.replicas set tight means acks=all produces are riding the edge — every shrink that crosses the floor rejects writes.",
      },
      "Request latency and request queues": {
        level: "advanced",
        summary:
          "Where time goes inside the broker for a produce or fetch — queue, local processing, remote wait, response.",
        points: [
          {
            term: "The phases",
            detail:
              "TotalTimeMs splits into RequestQueueTimeMs (waiting for an I/O thread), LocalTimeMs (leader processing), RemoteTimeMs (waiting on followers for acks=all, or on data for a long-poll fetch), then response queue and send time.",
          },
          {
            term: "Reading the breakdown",
            detail:
              "High RequestQueueTimeMs points to too few I/O threads or a saturated broker; high LocalTimeMs to slow disk or lock contention; high RemoteTimeMs on produce to a slow follower.",
          },
          {
            term: "Queue depth",
            detail:
              "RequestQueueSize climbing toward queued.max.requests means the broker is accepting requests faster than it can serve them.",
          },
        ],
        watchOut:
          "Watch p99, not the mean. Broker latency is bimodal — page-cache hit vs disk read — so a healthy average routinely hides a p99 that's far worse.",
      },
      "Produce and fetch error rates": {
        level: "intermediate",
        summary:
          "The rate and type of failed requests — the difference between \"slow\" and \"broken\".",
        points: [
          {
            term: "Where to see them",
            detail:
              "Broker: per-error-code request metrics, FailedProduceRequestsPerSec, FailedFetchRequestsPerSec. Client: producer record-error-rate, consumer metrics, and the exceptions in your app logs.",
          },
          {
            term: "The ones that matter",
            detail:
              "NOT_ENOUGH_REPLICAS (ISR below min.insync.replicas), NOT_LEADER_OR_FOLLOWER (stale metadata, usually transient during a leader change), REQUEST_TIMED_OUT, RecordTooLargeException.",
          },
          {
            term: "Retriable vs not",
            detail:
              "Most produce errors are retriable and the client handles them silently — they show up as elevated latency and retry-rate long before any delivery failure.",
          },
        ],
        watchOut:
          "NOT_LEADER_OR_FOLLOWER should be a brief burst around a leader election, then back to zero. A continuous low rate is not background noise — clients are persistently acting on stale metadata, so check metadata propagation and the controller.",
      },
      "Disk usage and disk latency": {
        level: "intermediate",
        summary:
          "How full the log directories are, and how long the disk takes to serve the reads and writes Kafka can't avoid.",
        points: [
          {
            term: "Capacity",
            detail:
              "Kafka writes until the disk is full, then the affected log directory goes offline — taking that broker's replicas of those partitions with it, not the partitions themselves. Reads and acks=1 writes continue from a surviving replica, but acks=all writes still fail if the remaining ISR drops below min.insync.replicas. Alert on free space with enough headroom to act; retention won't free it fast enough.",
          },
          {
            term: "Latency",
            detail:
              "Produce path: appends land in the page cache and return — the OS flushes to disk in the background, and durability comes from replication, not an fsync per write (unless flush.messages / flush.ms are set). Fetch path: reads that miss the page cache when a lagging consumer pulls cold data hit the disk directly. Rising disk await time surfaces as broker LocalTimeMs and log-flush latency.",
          },
          {
            term: "Page cache is the read cache",
            detail:
              "Kafka relies on the OS page cache, not a JVM cache. RAM used by page cache is healthy; a low cache-hit ratio — lots of cold reads — is what hurts.",
          },
        ],
        watchOut:
          "One slow disk on one broker drags down every partition it leads, and via replication the ISRs of partitions led elsewhere. Disk problems rarely stay contained to one broker's metrics.",
      },
      "Network saturation": {
        level: "advanced",
        summary:
          "Whether the NIC or the inter-broker links are the ceiling — replication and consumer fan-out both live here.",
        points: [
          {
            term: "Where the bytes go",
            detail:
              "Each record enters the cluster once from the producer, then each follower fetches it to replicate (replication.factor − 1 copies — regardless of acks; acks only controls whether the producer waits). On the read side each consumer group fetches it once, not each consumer. Cluster-wide with RF 3 and 3 consumer groups: roughly 3x the produce rate inbound (1 produce + 2 replication fetches) and 5x outbound (2 replication sends + 3 group reads).",
          },
          {
            term: "BytesInPerSec / BytesOutPerSec",
            detail:
              "Per-broker and per-topic; compare against the NIC's usable line rate. There's no universal safe percentage — pair it with retransmits, drops, and queue depth, and set a headroom target tested for your environment. Latency climbing as byte rate climbs is the real tell.",
          },
          {
            term: "Replication traffic is separate",
            detail:
              "ReplicationBytesInPerSec / OutPerSec is distinct from client traffic. A replica backfilling after a restart can saturate a link on its own.",
          },
        ],
        watchOut:
          "Cross-zone replication and cross-zone consumer fetches cost money as well as latency — rack-aware fetching and a budgeted replication quota are the levers.",
      },
      "Controller health": {
        level: "advanced",
        summary:
          "Whether the KRaft controller quorum is intact and metadata is propagating to brokers.",
        points: [
          {
            term: "Quorum state",
            detail:
              "One active controller, the rest hot standbys. Watch for a controller that can't reach quorum, or frequent active-controller changes — a flapping leader in the metadata Raft group.",
          },
          {
            term: "Metadata lag",
            detail:
              "Brokers replicate the __cluster_metadata log; a broker whose metadata offset trails the active controller's is slow to see leadership changes and topic updates.",
          },
          {
            term: "ActiveControllerCount",
            detail:
              "Should be exactly 1 across the cluster. 0 means metadata changes are frozen; more than 1 for more than a moment means a split.",
          },
        ],
        watchOut:
          "Controller problems are quiet — existing partition leaders keep serving, so dashboards look fine while topic creation hangs and failed brokers never get their partitions reassigned.",
      },
      "JVM memory and garbage collection": {
        level: "advanced",
        summary:
          "GC pauses on a broker stall replication and heartbeats — this is where \"the broker looks up but acts dead\" comes from.",
        points: [
          {
            term: "Heap sizing",
            detail:
              "Brokers want a modest heap (commonly ~6GB); most memory should go to the OS page cache, not the JVM. An oversized heap steals cache and lengthens GC.",
          },
          {
            term: "Pause time",
            detail:
              "A stop-the-world pause longer than replica.lag.time.max.ms drops a broker's followers from ISRs; longer than a consumer's session timeout looks like a dead consumer. Low-tens-of-ms pauses are a realistic target for G1 on a modest heap, not a guarantee — it depends on live-set size, allocation rate, CPU, and JVM version. Verify it against actual GC pause metrics.",
          },
          {
            term: "It's a client concern too",
            detail:
              "A GC-pausing consumer misses poll() deadlines and triggers rebalances; a GC-pausing producer stalls sends. Same signal, both ends.",
          },
        ],
        watchOut:
          "kafka-exporter doesn't expose JVM metrics — GC and heap need a JMX exporter or the JVM's own telemetry. A cluster watched only through kafka-exporter is blind to its most common latency cause.",
      },
      "Rebalance frequency": {
        level: "intermediate",
        summary:
          "How often consumer groups reassign partitions — cheap when rare, crippling when constant.",
        points: [
          {
            term: "The signal",
            detail:
              "Group rebalance rate and rebalance latency (client metrics), plus join/sync-group request rates on the broker. A group re-forming every few minutes is losing consumption time — how much depends on the protocol (below).",
          },
          {
            term: "Common causes",
            detail:
              "Processing that overruns max.poll.interval.ms, a session timeout too tight for GC pauses, unstable pod scheduling, or a consumer crash-looping.",
          },
          {
            term: "Eager vs cooperative",
            detail:
              "Under the classic eager protocol every rebalance is stop-the-world: the whole group stops consuming until it re-forms. Cooperative assignment keeps the partitions that aren't moving flowing throughout; the new consumer protocol (KIP-848) drops the global synchronization barrier so reassignment is incremental. Which one you run changes how much rebalance frequency you can tolerate.",
          },
        ],
        watchOut:
          "Frequent rebalances and rising lag are usually the same incident — the group can't progress because it keeps re-forming. Fix the rebalance cause, not the lag.",
      },
      "Log-cleaner performance": {
        level: "advanced",
        summary:
          "For compacted topics, whether the background cleaner keeps up with the un-compacted portion of the log.",
        points: [
          {
            term: "What it does",
            detail:
              "The log cleaner rewrites compacted-topic segments to keep only the latest value per key, working through the \"dirty\" section — everything appended since that partition was last cleaned.",
          },
          {
            term: "The signal",
            detail:
              "max-dirty-percent and per-partition cleaner lag. A cleaner falling behind lets compacted topics grow unbounded and slows consumer startup — more history to read.",
          },
          {
            term: "Why it falls behind",
            detail:
              "A dedupe map that can't hold every key in the dirty section limits how far one pass gets — heavy key cardinality then takes multiple passes to catch up. A log Kafka genuinely can't clean (a corrupt segment) is marked uncleanable and skipped; the cleaner moves on to other partitions rather than stalling.",
          },
        ],
        watchOut:
          "A crashed cleaner thread is silent. With the default log.cleaner.threads=1 it stops compaction entirely — every compacted topic (including __consumer_offsets) just grows; with more threads it only cuts throughput. Alert on max-dirty-percent and on live cleaner threads.",
      },
    },
    activities: [
      "Read an unlabeled dashboard and name the bottleneck: producer, broker, consumer, disk, network, or downstream",
      "Break a request-latency total into its queue, local, and remote phases",
      "Tell a runaway lag slope from a flat-but-breaching backlog, per partition",
      "Localize ISR churn to one slow broker vs. a shared network or storage cause",
    ],
    status: "available",
  },
  {
    slug: "troubleshooting-scenarios",
    index: 11,
    title: "Troubleshooting scenarios",
    summary:
      "A searchable symptom → evidence → cause → resolution catalog covering the most common Kafka incidents.",
    difficulty: "advanced",
    estimatedMinutes: 70,
    prerequisites: ["observability"],
    track: "reference",
    objectives: [
      "Move from a paging symptom to the specific evidence that confirms or rules out each cause",
      "Recognize the fixes that make a symptom disappear while making the system worse",
      "Match common errors (NOT_ENOUGH_REPLICAS, timeouts, rebalance storms) to their real signatures",
    ],
    completionCriteria: [
      "For each catalog entry you can name the evidence that distinguishes its causes",
      "You can explain why lowering a durability setting is rarely the right incident response",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Operations", url: "https://kafka.apache.org/40/operations/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-01",
    topics: [
      "Consumer lag",
      "Frequent consumer rebalances",
      "NOT_ENOUGH_REPLICAS",
      "Under-replicated partitions",
      "Timeout errors",
      "Disk usage growth",
      "Large-message failures",
      "Hot partitions",
      "Data loss, duplicates, and out-of-order records",
      "Connectivity and authentication",
    ],
    activities: [],
    status: "available",
  },
  {
    slug: "capstone-project",
    index: 12,
    title: "Capstone project",
    summary:
      "Build a complete order-processing pipeline on the three-broker cluster — schema, idempotent producer, consumer group with a dead-letter path, a Streams aggregation, a Connect export, a failure drill, and its observability — with no step-by-step walkthrough.",
    difficulty: "advanced",
    estimatedMinutes: 480,
    prerequisites: [
      "build-a-producer-and-consumer",
      "keys-ordering-and-delivery",
      "schemas-and-data-contracts",
      "consumer-configuration",
      "connect-and-streams",
    ],
    track: "beginner-path",
    objectives: [
      "Turn a business brief into a topic layout, a schema contract, and client configuration you can defend",
      "Assemble a producer, a consumer group, a Streams aggregation, and a Connect sink into one working pipeline",
      "Show the pipeline tolerates a broker loss and refuses — rather than loses — writes it cannot make durable",
      "Score your own work against correctness, reliability, observability, and operational-safety criteria",
    ],
    completionCriteria: [
      "All eleven spec requirements are met and checked off",
      "You have run the broker-loss drill and recorded what you observed",
      "You have scored every rubric dimension and written a next step for any that fall below \"Meets\"",
    ],
    furtherReading: [
      { label: "Apache Kafka 4.0 — Design", url: "https://kafka.apache.org/40/design/design/" },
      { label: "Apache Kafka 4.0 — Operations", url: "https://kafka.apache.org/40/operations/" },
    ],
    applicableVersions: ["4.3", "4.2", "4.1", "4.0"],
    lastReviewed: "2026-09-08",
    topics: [],
    activities: [],
    status: "available",
    capstone: capstoneProject,
  },
];

export function getModule(slug: string): Module | undefined {
  return modules.find((m) => m.slug === slug);
}
