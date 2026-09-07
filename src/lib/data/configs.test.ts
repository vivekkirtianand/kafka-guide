import { describe, expect, it } from "vitest";
import { configs, configGoals, configScopes } from "./configs";
import { configAvailable, configIsEarlyAccess } from "@/lib/types";

function get(key: string) {
  const entry = configs.find((c) => c.key === key);
  if (!entry) throw new Error(`no config entry for ${key}`);
  return entry;
}

// Config keys that legitimately appear in relatedConfigs without their own entry — broker
// listener plumbing the explorer does not document as beginner client configuration.
const KNOWN_EXTERNAL = new Set(["listeners", "listener.security.protocol.map"]);

describe("config catalog shape", () => {
  it("has unique keys", () => {
    const keys = configs.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("fills every prose field on every entry", () => {
    for (const c of configs) {
      for (const field of ["controls", "defaultValue", "goal", "whenToChange", "performanceImpact", "reliabilityImpact"] as const) {
        expect(c[field].trim().length, `${c.key}: ${field}`).toBeGreaterThan(0);
      }
      expect(c.failureModes.length, c.key).toBeGreaterThan(0);
      for (const f of c.failureModes) expect(f.trim().length, c.key).toBeGreaterThan(0);
    }
  });

  it("cross-references only real config keys", () => {
    const keys = new Set(configs.map((c) => c.key));
    for (const c of configs) {
      for (const r of c.relatedConfigs) {
        expect(keys.has(r) || KNOWN_EXTERNAL.has(r), `${c.key} → ${r}`).toBe(true);
      }
    }
  });

  it("covers the beginner client configuration a newcomer meets first", () => {
    const keys = new Set(configs.map((c) => c.key));
    for (const k of [
      "bootstrap.servers",
      "client.id",
      "security.protocol",
      "key.serializer",
      "value.serializer",
      "key.deserializer",
      "value.deserializer",
      "compression.type",
      "fetch.min.bytes",
      "max.partition.fetch.bytes",
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
  });

  it("groups the shared producer/consumer connection properties under the client scope", () => {
    expect(configScopes).toContain("client");
    for (const k of ["bootstrap.servers", "client.id", "security.protocol", "sasl.mechanism"]) {
      expect(get(k).scope, k).toBe("client");
    }
    // serializers stay producer-only, deserializers consumer-only
    expect(get("key.serializer").scope).toBe("producer");
    expect(get("key.deserializer").scope).toBe("consumer");
  });

  it("exposes every goal used by an entry in the filter list", () => {
    for (const c of configs) expect(configGoals, c.key).toContain(c.goal);
  });
});

describe("config version gating", () => {
  it("records group.protocol's true introduction line (3.7), not the oldest selectable one", () => {
    expect(get("group.protocol").availableFromVersion).toBe("3.7");
  });

  it("keeps group.protocol available across every selectable version (3.7 predates them all)", () => {
    const gp = get("group.protocol");
    expect(configAvailable(gp, "3.9")).toBe(true);
    expect(configAvailable(gp, "4.0")).toBe(true);
    expect(configAvailable(gp, "4.3")).toBe(true);
  });

  it("flags group.protocol as early access on 3.9 but not on 4.0+", () => {
    const gp = get("group.protocol");
    expect(configIsEarlyAccess(gp, "3.9")).toBe(true);
    expect(configIsEarlyAccess(gp, "4.0")).toBe(false); // production-ready
    expect(configIsEarlyAccess(gp, "4.3")).toBe(false);
  });

  it("treats a config with no version metadata as always available and never early access", () => {
    const acks = get("acks");
    expect(configAvailable(acks, "3.9")).toBe(true);
    expect(configIsEarlyAccess(acks, "3.9")).toBe(false);
  });

  it("states the corrected fetch.max.bytes default", () => {
    expect(get("fetch.max.bytes").defaultValue).toBe("52428800 (50 MiB)");
  });
});
