import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PollIntervalDemo from "./PollIntervalDemo";

describe("PollIntervalDemo", () => {
  it("defaults to a batch that fits inside the poll interval", () => {
    render(<PollIntervalDemo />);

    expect(screen.getByTestId("batch-time")).toHaveTextContent(
      "batch = 5 records × 150ms = 750ms · budget = 1000ms max.poll.interval.ms",
    );
    expect(screen.getByText("poll loop healthy")).toBeInTheDocument();
    expect(screen.getByTestId("poll-outcome")).toHaveTextContent("no rebalance is triggered");
  });

  it("a slow batch that exceeds the interval forces the consumer out of the group", async () => {
    const user = userEvent.setup();
    render(<PollIntervalDemo />);

    await user.click(screen.getByRole("button", { name: "400ms/record" }));

    expect(screen.getByTestId("batch-time")).toHaveTextContent("= 2000ms");
    expect(screen.getByText("consumer rebalanced out")).toBeInTheDocument();
    expect(screen.getByTestId("poll-outcome")).toHaveTextContent("a rebalance loop");
  });

  it("raising max.poll.interval.ms brings the same slow batch back inside budget", async () => {
    const user = userEvent.setup();
    render(<PollIntervalDemo />);

    await user.click(screen.getByRole("button", { name: "400ms/record" }));
    expect(screen.getByText("consumer rebalanced out")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "raise max.poll.interval.ms to 5000" }));

    expect(screen.getByTestId("batch-time")).toHaveTextContent("budget = 5000ms max.poll.interval.ms");
    expect(screen.getByText("poll loop healthy")).toBeInTheDocument();
  });

  it("resets to the default configuration", async () => {
    const user = userEvent.setup();
    render(<PollIntervalDemo />);

    await user.click(screen.getByRole("button", { name: "400ms/record" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("batch-time")).toHaveTextContent("= 750ms");
    expect(screen.getByText("poll loop healthy")).toBeInTheDocument();
  });
});
