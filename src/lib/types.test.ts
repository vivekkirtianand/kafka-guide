import { describe, expect, it } from "vitest";
import {
  KAFKA_VERSIONS,
  KAFKA_VERSION_INFO,
  availableDeployments,
  getDefaultValue,
  versionAtLeast,
  versionIsArchived,
  versionRangeLabel,
  type ConfigEntry,
} from "./types";

describe("Kafka version model", () => {
  it("lists versions newest-first with no gaps in the info table", () => {
    expect(KAFKA_VERSIONS).toEqual(["4.3", "4.2", "4.1", "4.0", "3.9"]);
    for (const v of KAFKA_VERSIONS) {
      const info = KAFKA_VERSION_INFO[v];
      expect(info.released).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(info.latestPatch.startsWith(v)).toBe(true);
    }
  });

  it("marks 4.1–4.3 current and 4.0 / 3.9 archived", () => {
    expect(versionIsArchived("4.3")).toBe(false);
    expect(versionIsArchived("4.2")).toBe(false);
    expect(versionIsArchived("4.1")).toBe(false);
    expect(versionIsArchived("4.0")).toBe(true);
    expect(versionIsArchived("3.9")).toBe(true);
  });

  it("drops ZooKeeper as a deployment from 4.0 onward, keeps it on 3.9", () => {
    for (const v of ["4.0", "4.1", "4.2", "4.3"] as const) {
      expect(availableDeployments(v)).toEqual(["kraft", "managed"]);
    }
    expect(availableDeployments("3.9")).toContain("zookeeper");
  });

  it("versionRangeLabel collapses a contiguous run and lists gaps", () => {
    expect(versionRangeLabel(["4.3", "4.2", "4.1", "4.0"])).toBe("4.0–4.3");
    expect(versionRangeLabel(["4.0"])).toBe("4.0");
    expect(versionRangeLabel(["4.3", "4.2"])).toBe("4.2–4.3");
    expect(versionRangeLabel(["4.0", "4.2", "4.3"])).toBe("4.0, 4.2–4.3");
    expect(versionRangeLabel([])).toBe("");
  });

  it("versionRangeLabel treats 3.9 and 4.0 as contiguous (adjacent release lines)", () => {
    expect(versionRangeLabel(["3.9", "4.0"])).toBe("3.9–4.0");
    expect(versionRangeLabel(["3.9", "4.0", "4.1", "4.2", "4.3"])).toBe("3.9–4.3");
    expect(versionRangeLabel(["3.9", "4.1"])).toBe("3.9, 4.1");
  });

  it("versionAtLeast compares release lines numerically, not by picker position", () => {
    expect(versionAtLeast("4.3", "4.0")).toBe(true);
    expect(versionAtLeast("4.0", "4.0")).toBe(true);
    expect(versionAtLeast("3.9", "4.0")).toBe(false);
    // a boundary the picker no longer offers still resolves
    expect(versionAtLeast("3.9", "3.7")).toBe(true);
    expect(versionAtLeast("3.6", "3.7")).toBe(false);
    // numeric, not lexicographic
    expect(versionAtLeast("4.10", "4.9")).toBe(true);
  });
});

describe("getDefaultValue walk-back", () => {
  const linger: ConfigEntry = {
    key: "linger.ms",
    scope: "producer",
    goal: "Improve batching",
    controls: "",
    defaultValue: "0",
    defaultValueByVersion: { "4.0": "5" },
    changeMechanism: "recreate-client",
    riskOfChange: "safe",
    managedAvailability: "full",
    whenToChange: "",
    performanceImpact: "",
    reliabilityImpact: "",
    relatedConfigs: [],
    failureModes: [],
  };

  it("holds a changed default across every newer line", () => {
    expect(getDefaultValue(linger, "4.0")).toBe("5");
    expect(getDefaultValue(linger, "4.1")).toBe("5");
    expect(getDefaultValue(linger, "4.3")).toBe("5");
  });

  it("falls through to defaultValue for versions older than every key", () => {
    expect(getDefaultValue(linger, "3.9")).toBe("0");
  });

  it("resolves keys for release boundaries the picker no longer offers", () => {
    const c: ConfigEntry = { ...linger, defaultValueByVersion: { "3.6": "1", "4.0": "5" } };
    expect(getDefaultValue(c, "3.9")).toBe("1"); // >= 3.6, < 4.0
    expect(getDefaultValue(c, "4.3")).toBe("5");
  });

  it("returns defaultValue when there is no per-version table", () => {
    expect(getDefaultValue({ ...linger, defaultValueByVersion: undefined }, "4.3")).toBe("0");
  });
});
