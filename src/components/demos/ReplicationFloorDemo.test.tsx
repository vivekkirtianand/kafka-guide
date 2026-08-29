import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReplicationFloorDemo from "./ReplicationFloorDemo";

const log = () => screen.getByText(/partition-0 · replication\.factor 3/).parentElement as HTMLElement;
const firstLogLine = () => (log().firstElementChild as HTMLElement).textContent ?? "";
const brokerBtn = (id: number, name: string | RegExp) =>
  within(screen.getByTestId(`broker-${id}`)).getByRole("button", { name });

describe("ReplicationFloorDemo", () => {
  it("starts with all three brokers in the ISR and one failure of headroom", () => {
    render(<ReplicationFloorDemo />);
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 2, 3} · leader broker-1");
    expect(screen.getByText("acks=all OK · 1 more loss tolerated")).toBeInTheDocument();
  });

  it("acks=1 does not claim the followers lack the record", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);
    await user.click(screen.getByRole("button", { name: "produce (acks=1) →" }));
    expect(firstLogLine()).toMatch(/without waiting for followers\. They may or may not have it yet/);
  });

  it("stopping a follower shrinks the ISR to two — acks=all still durable across a failure", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(brokerBtn(2, "stop broker"));
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 3}");
    expect(screen.getByText("acks=all OK · no headroom")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/replicated to all 2 in-sync replicas \{1, 3\} and acknowledged — durable/);
  });

  it("a one-replica ISR meets min.insync.replicas=1 but the demo does not call it durable", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(screen.getByRole("button", { name: "1" })); // min.insync.replicas = 1
    await user.click(brokerBtn(2, "stop broker"));
    await user.click(brokerBtn(3, "stop broker"));

    expect(screen.getByText("acks=all OK · single copy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/only the leader \(broker-1\).*single copy a broker failure would lose/);
  });

  it("below the floor acks=all is rejected while acks=1 still writes to the leader", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(brokerBtn(2, "stop broker"));
    await user.click(brokerBtn(3, "stop broker"));
    expect(screen.getByText("acks=all failing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "produce (acks=all) →" }));
    expect(firstLogLine()).toMatch(/below min\.insync\.replicas=2.*NOT_ENOUGH_REPLICAS/);
    await user.click(screen.getByRole("button", { name: "produce (acks=1) →" }));
    expect(firstLogLine()).toMatch(/leader broker-1 acknowledged/);
  });

  it("a restarted broker catches up before rejoining the ISR and does not reclaim leadership", async () => {
    const user = userEvent.setup();
    render(<ReplicationFloorDemo />);

    await user.click(brokerBtn(1, "stop broker"));
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("leader broker-2");

    await user.click(brokerBtn(1, "start broker"));
    // back but not in the ISR
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {2, 3}");
    expect(within(screen.getByTestId("broker-1")).getByText("catching up")).toBeInTheDocument();
    expect(firstLogLine()).toMatch(/replicating the backlog.*Not in the ISR yet/);

    await user.click(brokerBtn(1, "finish catch-up →"));
    expect(screen.getByTestId("isr-summary")).toHaveTextContent("ISR {1, 2, 3} · leader broker-2");
    expect(firstLogLine()).toMatch(/Leadership stays with broker-2/);
  });
});
