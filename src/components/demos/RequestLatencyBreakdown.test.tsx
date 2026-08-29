import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequestLatencyBreakdown from "./RequestLatencyBreakdown";

const phase = (k: string) => Number((screen.getByTestId(`rlb-phase-${k}`).textContent ?? "").replace(/\D/g, ""));
const total = () => Number((screen.getByTestId("rlb-total").textContent ?? "").replace(/\D/g, ""));
const diagnosis = () => screen.getByTestId("rlb-diagnosis").textContent ?? "";

describe("RequestLatencyBreakdown", () => {
  it("the default (acks=all, nothing wrong) is balanced and low", () => {
    render(<RequestLatencyBreakdown />);
    expect(total()).toBe(10);
    expect(screen.getByText("balanced and low")).toBeInTheDocument();
    expect(diagnosis()).toMatch(/No single phase owns the total/);
  });

  it("a slow follower drives RemoteTimeMs and only shows up on the acks=all path", async () => {
    const user = userEvent.setup();
    render(<RequestLatencyBreakdown />);

    await user.click(screen.getByLabelText("one slow follower"));
    expect(phase("remote")).toBe(51);
    expect(screen.getByText("RemoteTimeMs dominates")).toBeInTheDocument();
    expect(diagnosis()).toMatch(/waiting on followers to acknowledge for acks=all/);

    // drop to acks=1 — the slow follower no longer counts
    await user.click(screen.getByLabelText("acks=all (wait for the ISR)"));
    expect(phase("remote")).toBe(0);
    expect(screen.getByLabelText("one slow follower")).toBeDisabled();
  });

  it("a slow disk drives LocalTimeMs", async () => {
    const user = userEvent.setup();
    render(<RequestLatencyBreakdown />);
    await user.click(screen.getByLabelText("slow disk on the leader"));
    expect(phase("local")).toBe(34);
    expect(screen.getByText("LocalTimeMs dominates")).toBeInTheDocument();
    expect(diagnosis()).toMatch(/Slow disk .* or lock contention/);
  });

  it("too few I/O threads drives RequestQueueTimeMs", async () => {
    const user = userEvent.setup();
    render(<RequestLatencyBreakdown />);
    await user.click(screen.getByLabelText("too few I/O threads"));
    expect(phase("queue")).toBe(29);
    expect(screen.getByText("RequestQueueTimeMs dominates")).toBeInTheDocument();
    expect(diagnosis()).toMatch(/num\.io\.threads/);
  });

  it("resets every toggle", async () => {
    const user = userEvent.setup();
    render(<RequestLatencyBreakdown />);
    await user.click(screen.getByLabelText("slow disk on the leader"));
    await user.click(screen.getByLabelText("too few I/O threads"));
    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(total()).toBe(10);
    expect(screen.getByText("balanced and low")).toBeInTheDocument();
  });
});
