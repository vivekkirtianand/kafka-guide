import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsumerGroupScalingDemo from "./ConsumerGroupScalingDemo";

describe("ConsumerGroupScalingDemo", () => {
  it("starts with two consumers splitting six partitions evenly", () => {
    render(<ConsumerGroupScalingDemo />);

    expect(within(screen.getByTestId("consumer-1")).getByText("p0, p1, p2")).toBeInTheDocument();
    expect(within(screen.getByTestId("consumer-2")).getByText("p3, p4, p5")).toBeInTheDocument();
  });

  it("adding a consumer triggers a rebalance and redistributes partitions", async () => {
    const user = userEvent.setup();
    render(<ConsumerGroupScalingDemo />);

    await user.click(screen.getByRole("button", { name: "add consumer →" }));

    expect(within(screen.getByTestId("consumer-3")).getByText("p4, p5")).toBeInTheDocument();
    expect(
      screen.getByText("consumer-3 joined — rebalance: 3 consumers now share 6 partitions."),
    ).toBeInTheDocument();
  });

  it("a consumer beyond the partition count sits idle", async () => {
    const user = userEvent.setup();
    render(<ConsumerGroupScalingDemo />);

    // 2 -> 7 consumers
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole("button", { name: "add consumer →" }));
    }

    expect(within(screen.getByTestId("consumer-7")).getByText("idle — no partitions")).toBeInTheDocument();
    expect(screen.getByText(/consumer-7 joined — rebalance triggered, but all 6 partitions are already assigned/)).toBeInTheDocument();
  });

  it("removing a consumer rebalances its partitions onto the rest", async () => {
    const user = userEvent.setup();
    render(<ConsumerGroupScalingDemo />);

    await user.click(screen.getByRole("button", { name: "add consumer →" }));
    await user.click(screen.getByRole("button", { name: "remove consumer →" }));

    expect(screen.getByText("consumer-3 left — rebalance: its partitions reassigned across the remaining 2.")).toBeInTheDocument();
    expect(screen.queryByTestId("consumer-3")).not.toBeInTheDocument();
  });

  it("resets to two consumers", async () => {
    const user = userEvent.setup();
    render(<ConsumerGroupScalingDemo />);

    await user.click(screen.getByRole("button", { name: "add consumer →" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("consumer-2")).toBeInTheDocument();
    expect(screen.queryByTestId("consumer-3")).not.toBeInTheDocument();
  });
});
