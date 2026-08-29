import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IsrChurnDemo from "./IsrChurnDemo";

const verdict = () => screen.getByTestId("isrc-verdict").textContent ?? "";
const total = () => screen.getByTestId("isrc-total").textContent ?? "";
const broker = (b: number) => screen.getByTestId(`isrc-broker-${b}`).textContent ?? "";
const advance = () => screen.getByRole("button", { name: /advance 1 min/ });

describe("IsrChurnDemo", () => {
  it("starts clean and prompts to step the clock", () => {
    render(<IsrChurnDemo />);
    expect(total()).toMatch(/cumulative\): 0/);
    expect(verdict()).toMatch(/Step the clock a few minutes/);
  });

  it("the slow-broker scenario keeps every shrink on the same broker", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    await user.click(advance());
    expect(broker(3)).toMatch(/shrinks 4/);
    expect(broker(1)).toMatch(/shrinks 0/);
    expect(verdict()).toMatch(/Localized: every shrink is broker-3 leaving/);
  });

  it("the saturated-fabric scenario spreads churn across the cluster", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(screen.getByRole("button", { name: "saturated fabric" }));
    await user.click(advance());
    await user.click(advance());
    expect(verdict()).toMatch(/Not localized: a different replica drops out each minute/);
  });

  it("healthy + spike is one pair, then stable — not an incident", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(screen.getByRole("button", { name: "healthy" }));
    await user.click(screen.getByRole("button", { name: /load:/ }));
    await user.click(advance());
    await user.click(advance());
    await user.click(advance());
    expect(total()).toMatch(/cumulative\): 1/);
    expect(verdict()).toMatch(/One shrink\/expand pair around the load spike, then back to zero — expected/);
  });

  it("min.insync.replicas=2 warns that churn is one shrink from rejecting writes", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    expect(screen.getByTestId("isrc-floor")).toHaveTextContent(/rejects the write with NOT_ENOUGH_REPLICAS/);

    // drop min.insync.replicas to 1 — no floor to cross
    await user.click(within(screen.getByText("min.insync.replicas").parentElement as HTMLElement).getByRole("button", { name: "1" }));
    expect(screen.queryByTestId("isrc-floor")).not.toBeInTheDocument();
  });

  it("changing the scenario resets the accumulated counts", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    expect(total()).toMatch(/cumulative\): 2/);
    await user.click(screen.getByRole("button", { name: "healthy" }));
    expect(total()).toMatch(/cumulative\): 0/);
  });
});
