import { describe, expect, it } from "vitest";
import { configs } from "./configs";
import { configAvailable, configIsEarlyAccess } from "@/lib/types";

function get(key: string) {
  const entry = configs.find((c) => c.key === key);
  if (!entry) throw new Error(`no config entry for ${key}`);
  return entry;
}

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
