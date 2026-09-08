import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import ConfigExplorer from "./ConfigExplorer";
import { ClusterProvider } from "@/lib/context/ClusterContext";

const renderExplorer = () =>
  render(
    <ClusterProvider initialVersion="4.3">
      <ConfigExplorer />
    </ClusterProvider>,
  );

describe("ConfigExplorer", () => {
  it("filters by risk of changing", () => {
    const { getByLabelText, container } = renderExplorer();
    const before = container.querySelectorAll("button > span.font-mono.text-sm").length;
    fireEvent.change(getByLabelText("Filter by risk of changing"), { target: { value: "high-risk" } });
    const after = container.querySelectorAll("button > span.font-mono.text-sm").length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    // every visible risk badge reads high-risk
    const riskBadges = [...container.querySelectorAll("button")].flatMap((b) =>
      [...b.querySelectorAll("span")].map((s) => s.textContent).filter((t) => ["safe", "caution", "high-risk"].includes(t ?? "")),
    );
    expect(riskBadges.length).toBeGreaterThan(0);
    expect(riskBadges.every((t) => t === "high-risk")).toBe(true);
  });

  it("shows the enrichment fields and a doc link on an enriched entry", () => {
    const { getByPlaceholderText, getByText, container } = renderExplorer();
    fireEvent.change(getByPlaceholderText("Filter by key…"), { target: { value: "acks" } });
    fireEvent.click(getByText("acks"));
    expect(container.textContent).toContain("Safe baseline");
    expect(container.textContent).toContain("How to verify the change");
    const link = container.querySelector('a[href*="kafka.apache.org/40/configuration/producer-configs"]');
    expect(link?.getAttribute("href")).toContain("#producerconfigs_acks");
  });
});
