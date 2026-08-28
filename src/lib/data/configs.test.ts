import { describe, expect, it } from "vitest";
import { configs } from "./configs";
import { configAvailable, configIsEarlyAccess } from "@/lib/types";

function get(key: string) {
  const entry = configs.find((c) => c.key === key);
  if (!entry) throw new Error(`no config entry for ${key}`);
  return entry;
}

describe("config version gating", () => {
  it("hides group.protocol only before its early-access debut (3.7)", () => {
    const gp = get("group.protocol");
    expect(configAvailable(gp, "3.5")).toBe(false);
    expect(configAvailable(gp, "3.7")).toBe(true);
    expect(configAvailable(gp, "3.9")).toBe(true);
    expect(configAvailable(gp, "4.0")).toBe(true);
  });

  it("flags group.protocol as early access on 3.7–3.9 but not on 4.0", () => {
    const gp = get("group.protocol");
    expect(configIsEarlyAccess(gp, "3.5")).toBe(false); // not available at all
    expect(configIsEarlyAccess(gp, "3.7")).toBe(true);
    expect(configIsEarlyAccess(gp, "3.9")).toBe(true);
    expect(configIsEarlyAccess(gp, "4.0")).toBe(false); // production-ready
  });

  it("treats a config with no version metadata as always available and never early access", () => {
    const acks = get("acks");
    expect(configAvailable(acks, "3.5")).toBe(true);
    expect(configIsEarlyAccess(acks, "3.5")).toBe(false);
  });

  it("states the corrected fetch.max.bytes default", () => {
    expect(get("fetch.max.bytes").defaultValue).toBe("52428800 (50 MiB)");
  });
});
