import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RackPlacementDemo from "./RackPlacementDemo";

const status = () => screen.getByTestId("partition-status").textContent ?? "";
const fetchStatus = () => screen.getByTestId("fetch-status").textContent ?? "";
const rackBtn = (r: string, name: string | RegExp) =>
  within(screen.getByTestId(`rack-${r}`)).getByRole("button", { name });

describe("RackPlacementDemo", () => {
  it("rack-aware placement spreads one replica per rack and survives a rack failure", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    expect(status()).toMatch(/online · ISR 3 across racks A, B, C/);
    await user.click(rackBtn("A", "fail rack"));
    expect(status()).toMatch(/online · ISR 2 across racks B, C/);
    expect(screen.getByText("acks=all OK")).toBeInTheDocument();
  });

  it("changing broker.rack does not move an existing partition — a reassignment does", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(screen.getByRole("button", { name: /broker\.rack set/ }));
    // replicas are still one-per-rack
    expect(status()).toMatch(/ISR 3 across racks A, B, C/);
    expect(screen.getByTestId("config-drift")).toBeInTheDocument();
    expect(screen.getByText(/applies to new topics and reassignments, not this partition/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "reassign partition →" }));
    expect(screen.queryByTestId("config-drift")).not.toBeInTheDocument();
    await user.click(rackBtn("A", "fail rack"));
    // now two replicas were in rack A, so losing it drops below the floor
    expect(status()).toMatch(/ISR 1/);
    expect(screen.getByText("acks=all failing")).toBeInTheDocument();
  });

  it("a restored rack catches up before rejoining the ISR and leadership does not move back", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(rackBtn("A", "fail rack")); // b1 is leader and in rack A
    expect(status()).toMatch(/ISR 2 across racks B, C/);
    // leader moved to b3
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·L")).toBeInTheDocument();

    await user.click(rackBtn("A", "restore rack"));
    // b1 is back but catching up, not in the ISR
    expect(status()).toMatch(/ISR 2 across racks B, C/);
    expect(within(screen.getByTestId("broker-1")).getByText("b1 ·↑")).toBeInTheDocument();

    await user.click(rackBtn("A", "b1 finish catch-up →"));
    expect(status()).toMatch(/ISR 3 across racks A, B, C/);
    // leadership still with b3
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·L")).toBeInTheDocument();
  });

  it("losing every rack with a replica takes the partition offline", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);
    await user.click(rackBtn("A", "fail rack"));
    await user.click(rackBtn("B", "fail rack"));
    await user.click(rackBtn("C", "fail rack"));
    expect(status()).toMatch(/offline · no surviving replica/);
    expect(fetchStatus()).toMatch(/partition offline/);
  });

  it("the rack-C consumer fetches cross-rack until rack-aware fetching is enabled, then falls back if its local replica is gone", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rack-aware fetching off/ }));
    expect(fetchStatus()).toMatch(/fetches from b5 \(rack C\)/);
    expect(screen.getByText("same-rack, no transfer cost")).toBeInTheDocument();

    await user.click(rackBtn("C", "fail rack"));
    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();
  });
});
