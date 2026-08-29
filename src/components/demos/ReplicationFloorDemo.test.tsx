import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReplicationFloorDemo from "./ReplicationFloorDemo";

const log = () => screen.getByText(/partition-0 · replication\.factor 3/).parentElement as HTMLElement;
const firstLogLine = () => (log().firstElementChild as HTMLElement).textContent ?? "";

describe("ReplicationFloorDemo", () => {
  it("starts with all three brokers in the ISR and acks=all healthy with headroom", () => {
    render(<ReplicationFloorDemo />);
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 2, 3} · leader broker-1");
    expect(screen.getByText("acks=all OK · 1 more loss tolerated")).toBeInTheDocument();
  });

  it("stopping a follower shrinks the ISR but keeps acks=all working at min.insync.replicas=2", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(within(screen.getByTestId("broker-2")).getByRole("button", { name: "stop broker" }));

    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 3} · leader broker-1");
    expect(screen.getByText("acks=all OK · no headroom")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/replicated to all 2 in-sync replica\(s\) \{1, 3\}/);
  });

  it("a second broker loss drops the ISR below the floor and acks=all is rejected", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(within(screen.getByTestId("broker-2")).getByRole("button", { name: "stop broker" }));
    await user.click(within(screen.getByTestId("broker-3")).getByRole("button", { name: "stop broker" }));

    expect(screen.getByText("acks=all failing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/below min\.insync\.replicas=2.*NOT_ENOUGH_REPLICAS/);

    // acks=1 still succeeds off the surviving leader.
    await user.click(screen.getByRole("button", { name: "produce (acks=1) →" }));
    expect(firstLogLine()).toMatch(/leader broker-1 wrote it and acknowledged/);
  });

  it("stopping the leader elects a new one from the ISR; restart does not reclaim leadership", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(within(screen.getByTestId("broker-1")).getByRole("button", { name: "stop broker" }));
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("leader broker-2");
    expect(firstLogLine()).toMatch(/controller elects broker-2/);

    await user.click(within(screen.getByTestId("broker-1")).getByRole("button", { name: "start broker" }));
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 2, 3} · leader broker-2");
    expect(firstLogLine()).toMatch(/leadership stays with broker-2/);
  });

  it("with every broker down the partition is offline and produce fails", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    for (const id of [1, 2, 3]) {
      await user.click(within(screen.getByTestId(`broker-${id}`)).getByRole("button", { name: "stop broker" }));
    }

    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {} · leader none");
    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/partition offline, no leader.*LEADER_NOT_AVAILABLE/);
  });

  it("raising min.insync.replicas to 3 removes all failure headroom", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("acks=all OK · no headroom")).toBeInTheDocument();

    await user.click(within(screen.getByTestId("broker-3")).getByRole("button", { name: "stop broker" }));
    expect(screen.getByText("acks=all failing")).toBeInTheDocument();
  });
});
