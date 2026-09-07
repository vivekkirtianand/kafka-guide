import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import VersionApplicability from "./VersionApplicability";
import { ClusterProvider } from "@/lib/context/ClusterContext";
import { KafkaVersion } from "@/lib/types";

const renderAt = (version: KafkaVersion, props: Parameters<typeof VersionApplicability>[0]) =>
  render(
    <ClusterProvider initialVersion={version}>
      <VersionApplicability {...props} />
    </ClusterProvider>,
  ).container;

describe("VersionApplicability", () => {
  it("shows the applicable range and the review date", () => {
    const c = renderAt("4.3", { versions: ["4.3", "4.2", "4.1", "4.0"], reviewed: "2026-09-07" });
    expect(c.textContent).toMatch(/Kafka 4\.0–4\.3 · reviewed 2026-09-07/);
  });

  it("stays quiet when the selected version is in range", () => {
    const c = renderAt("4.1", { versions: ["4.3", "4.2", "4.1", "4.0"] });
    expect(c.textContent).not.toMatch(/you have kafka/i);
  });

  it("warns when the selected version is outside the range", () => {
    const c = renderAt("3.9", { versions: ["4.3", "4.2", "4.1", "4.0"], subject: "runbook" });
    expect(c.textContent).toMatch(/You have Kafka 3\.9 selected/);
    expect(c.textContent).toMatch(/this runbook covers the Kafka 4\.0–4\.3 line/i);
  });

  it("falls back to just the date when no versions are given", () => {
    const c = renderAt("4.3", { versions: [], reviewed: "2026-09-01" });
    expect(c.textContent).toBe("Reviewed 2026-09-01");
  });
});
