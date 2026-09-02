import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { producerConsumerWalkthrough } from "./walkthroughs";
import { modules, getModule } from "./modules";

// Collapse indentation and blank lines so a snippet still matches if it was transcribed with
// slightly different leading whitespace — but a renamed method or a changed config value
// (real drift) still fails.
const norm = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");

describe("producer/consumer code walkthrough", () => {
  const w = producerConsumerWalkthrough;

  it("has 11 lessons with unique, stable ids", () => {
    expect(w.lessons).toHaveLength(11);
    const ids = w.lessons.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every lesson has an intro, a snippet, and at least two points", () => {
    for (const l of w.lessons) {
      expect(l.intro.length, l.id).toBeGreaterThan(0);
      expect(l.code.trim().length, l.id).toBeGreaterThan(0);
      expect(l.file.length, l.id).toBeGreaterThan(0);
      expect(l.points.length, l.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("every snippet is a verbatim slice of the file it names", () => {
    for (const l of w.lessons) {
      const source = readFileSync(join(process.cwd(), w.repoPath, l.file), "utf8");
      expect(norm(source), `${l.id} → ${l.file}`).toContain(norm(l.code));
    }
  });

  it("covers the concepts the module promises", () => {
    const allText = w.lessons
      .flatMap((l) => [l.intro, ...l.points.flatMap((p) => [p.term, p.detail]), l.watchOut ?? ""])
      .join(" ");
    expect(allText).toMatch(/asynchronous/i);
    expect(allText).toMatch(/acks=all/);
    expect(allText).toMatch(/at-least-once/i);
    expect(allText).toMatch(/rebalance/i);
    expect(allText).toMatch(/wakeup\(\)/);
  });

  it("does not claim poll() sends heartbeats", () => {
    const pollLoop = w.lessons.find((l) => l.id === "the-poll-loop")!;
    const text = pollLoop.points.map((p) => p.detail).join(" ");
    expect(text).not.toMatch(/poll[^.]*sends heartbeats/i);
    expect(text).toMatch(/background thread sends them|heartbeat\.interval\.ms/i);
    expect(text).toMatch(/max\.poll\.interval\.ms/);
  });

  it("frames consumer-group delivery as at-least-once, not once-only", () => {
    const groups = w.lessons.find((l) => l.id === "consumer-groups")!;
    const text = groups.points.map((p) => `${p.term} ${p.detail}`).join(" ");
    expect(text).not.toMatch(/handled once across the group/i);
    expect(text).toMatch(/at-least-once|redeliver|pick(s)? the partition up/i);
  });

  it("notes auto-commit is poll-driven and only unsafe once work outlives the loop", () => {
    const commit = w.lessons.find((l) => l.id === "offsets-and-commit")!;
    expect(commit.watchOut).toMatch(/previous poll\(\)|inside poll\(\)/i);
    expect(commit.watchOut).toMatch(/another thread|outlives one loop turn/i);
  });

  it("only marks a lesson runnable when it has a command", () => {
    for (const l of w.lessons) {
      if (l.run !== undefined) expect(l.run.trim().length, l.id).toBeGreaterThan(0);
    }
    // the read-only config lessons carry no command
    expect(w.lessons.find((l) => l.id === "producer-config")!.run).toBeUndefined();
  });
});

describe("Module 3 — build a producer and consumer", () => {
  const m = getModule("build-a-producer-and-consumer")!;

  it("slots in at index 3 on the beginner path, after the local lab", () => {
    expect(m.index).toBe(3);
    expect(m.track).toBe("beginner-path");
    expect(m.status).toBe("available");
    expect(m.prerequisites).toEqual(["mental-model", "local-cluster-lab"]);
  });

  it("renders as a walkthrough, not topic content", () => {
    expect(m.walkthrough).toBe(producerConsumerWalkthrough);
    expect(m.topicDetail).toBeUndefined();
    expect(m.topicNarrative).toBeUndefined();
  });

  it("lists one topic per lesson", () => {
    expect(m.topics).toHaveLength(producerConsumerWalkthrough.lessons.length);
  });

  it("pushed the reference config modules down by one", () => {
    expect(getModule("producer-configuration")!.index).toBe(4);
    expect(getModule("consumer-configuration")!.index).toBe(5);
    expect(getModule("broker-topic-configuration")!.index).toBe(6);
    expect(getModule("observability")!.index).toBe(7);
    expect(getModule("troubleshooting-scenarios")!.index).toBe(8);
  });

  it("keeps indexes 0-based and sequential across the whole list", () => {
    expect(modules.map((x) => x.index)).toEqual(modules.map((_, i) => i));
  });
});
