import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IsrChurnDemo from "./IsrChurnDemo";

const verdict = () => screen.getByTestId("isrc-verdict").textContent ?? "";
const total = () => screen.getByTestId("isrc-total").textContent ?? "";
const meter = (b: number) => screen.getByTestId(`isrc-broker-${b}`).textContent ?? "";
const removed = (b: number) => screen.getByTestId(`isrc-removed-${b}`).textContent ?? "";
const advance = () => screen.getByRole("button", { name: /advance 1 min/ });

describe("IsrChurnDemo", () => {
  it("starts clean and prompts to compare the meters with the removed-replica tally", () => {
    render(<IsrChurnDemo />);
    expect(total()).toMatch(/Count \(all brokers\): 0/);
    expect(verdict()).toMatch(/read the meters against the removed-replica tally/);
  });

  it("the slow-broker meters fire on the leaders while the removed replica is always broker-3", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    await user.click(advance());

    // partitions 1 and 2 are led by brokers 1 and 2 — their meters tick
    expect(meter(1)).toMatch(/Count 2/);
    expect(meter(2)).toMatch(/Count 2/);
    expect(meter(3)).toMatch(/Count 0/);
    // but broker-3 is the replica removed every time
    expect(removed(3)).toMatch(/removed 4×/);
    expect(removed(1)).toMatch(/removed 0×/);
    expect(verdict()).toMatch(/meters fire on brokers 1 and 2/);
    expect(verdict()).toMatch(/removed every single time is broker-3/);
    // the removed-replica tally is a derived signal, not a live partition field
    expect(screen.getByText(/derived from ISR-snapshot diffs \/ shrink log lines, not a live field/)).toBeInTheDocument();
  });

  it("the saturated-fabric scenario spreads the removed replica across the cluster", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(screen.getByRole("button", { name: "saturated fabric" }));
    await user.click(advance());
    await user.click(advance());
    expect(verdict()).toMatch(/spread across the cluster — a different replica lags each minute/);
  });

  it("healthy is a single first-minute blip, then quiet — not an incident", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(screen.getByRole("button", { name: "healthy" }));
    await user.click(advance());
    await user.click(advance());
    await user.click(advance());
    expect(total()).toMatch(/Count \(all brokers\): 1/);
    expect(verdict()).toMatch(/One shrink\/expand pair in the first minute, then nothing/);
  });

  it("min.insync.replicas=2 warns that churn is one more failure from rejecting writes", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    expect(screen.getByTestId("isrc-floor")).toHaveTextContent(/drops the ISR to 1 and rejects the write with NOT_ENOUGH_REPLICAS/);

    await user.click(
      within(screen.getByText("min.insync.replicas").parentElement as HTMLElement).getByRole("button", { name: "1" }),
    );
    expect(screen.queryByTestId("isrc-floor")).not.toBeInTheDocument();
  });

  it("changing the scenario resets the accumulated counts", async () => {
    const user = userEvent.setup();
    render(<IsrChurnDemo />);
    await user.click(advance());
    expect(total()).toMatch(/Count \(all brokers\): 2/);
    await user.click(screen.getByRole("button", { name: "healthy" }));
    expect(total()).toMatch(/Count \(all brokers\): 0/);
  });
});
