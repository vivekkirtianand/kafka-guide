import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LagSlopeVsAbsolute from "./LagSlopeVsAbsolute";

const verdict = () => screen.getByTestId("lag-verdict").textContent ?? "";
const total = () => screen.getByTestId("lag-total").textContent ?? "";
const clock = () => screen.getByTestId("lag-clock").textContent ?? "";
const advance = () => screen.getByRole("button", { name: /advance/ });

describe("LagSlopeVsAbsolute", () => {
  it("at t=0 a flat but high backlog already breaches the latency SLA", () => {
    render(<LagSlopeVsAbsolute />);
    expect(clock()).toBe("t = 0s");
    expect(total()).toMatch(/group total lag: 2,000/);
    expect(verdict()).toMatch(/Nothing has moved yet, but partition 2 already holds a steady backlog/);
  });

  it("keeping pace holds the backlog flat — slope fine, absolute value still a problem", async () => {
    const user = userEvent.setup();
    render(<LagSlopeVsAbsolute />);
    await user.click(advance());
    expect(clock()).toBe("t = 10s");
    expect(total()).toMatch(/group total lag: 2,000/);
    expect(screen.getByText("slope flat")).toBeInTheDocument();
    expect(verdict()).toMatch(/Lag is flat — the slope is fine — but partition 2 holds a steady backlog/);
  });

  it("a stuck partition runs away while the group total still looks like a gentle slope", async () => {
    const user = userEvent.setup();
    render(<LagSlopeVsAbsolute />);
    await user.click(screen.getByLabelText("partition 0 stuck on a poison message"));
    await user.click(advance());
    expect(within(screen.getByTestId("lag-p0")).getByText(/lag 1,000/)).toBeInTheDocument();
    expect(within(screen.getByTestId("lag-p1")).getByText(/lag 0 /)).toBeInTheDocument();
    expect(verdict()).toMatch(/the rise is entirely partition 0/);
  });

  it("stepping a stuck partition far enough pushes it past retention", async () => {
    const user = userEvent.setup();
    render(<LagSlopeVsAbsolute />);
    await user.click(screen.getByLabelText("partition 0 stuck on a poison message"));
    for (let i = 0; i < 7; i++) await user.click(advance());
    expect(verdict()).toMatch(/past the ~6000-record retention window/);
    expect(within(screen.getByTestId("lag-p0")).getByText(/past retention/)).toBeInTheDocument();
  });

  it("producing above the consume ceiling climbs every partition at the same slope", async () => {
    const user = userEvent.setup();
    render(<LagSlopeVsAbsolute />);
    fireEvent.change(screen.getByLabelText("produce rate per partition"), { target: { value: "160" } });
    await user.click(advance());
    expect(verdict()).toMatch(/Every partition is climbing at the same slope — this is genuine under-provisioning/);
  });

  it("resets the clock, rate, and stuck toggle", async () => {
    const user = userEvent.setup();
    render(<LagSlopeVsAbsolute />);
    await user.click(screen.getByLabelText("partition 0 stuck on a poison message"));
    await user.click(advance());
    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(clock()).toBe("t = 0s");
    expect(screen.getByLabelText("partition 0 stuck on a poison message")).not.toBeChecked();
  });
});
