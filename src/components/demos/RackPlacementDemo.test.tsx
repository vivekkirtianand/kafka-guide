import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RackPlacementDemo from "./RackPlacementDemo";

const status = () => screen.getByTestId("partition-status").textContent ?? "";
const fetchStatus = () => screen.getByTestId("fetch-status").textContent ?? "";
const failRack = (r: string) =>
  within(screen.getByTestId(`rack-${r}`)).getByRole("button", { name: "fail rack" });

describe("RackPlacementDemo", () => {
  it("rack-aware placement puts one replica in each rack and survives any single rack failure", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    expect(status()).toMatch(/online · ISR 3 across racks A, B, C/);
    expect(screen.getByText("acks=all OK")).toBeInTheDocument();

    await user.click(failRack("A"));
    expect(status()).toMatch(/online · ISR 2 across racks B, C/);
    expect(screen.getByText("acks=all OK")).toBeInTheDocument();
  });

  it("without broker.rack, two replicas share rack A and losing it drops below the floor", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(screen.getByRole("button", { name: /broker\.rack set/ }));
    expect(screen.getByText(/two in rack A/)).toBeInTheDocument();

    await user.click(failRack("A"));
    expect(status()).toMatch(/online · ISR 1/);
    expect(screen.getByText("acks=all failing")).toBeInTheDocument();
  });

  it("losing every rack that holds a replica takes the partition offline", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(failRack("A"));
    await user.click(failRack("B"));
    await user.click(failRack("C"));
    expect(status()).toMatch(/offline · no surviving replica/);
    expect(fetchStatus()).toMatch(/partition offline/);
  });

  it("the rack-C consumer fetches cross-rack from the leader until rack-aware fetching is enabled", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    // default: leader b1 in rack A, consumer in rack C
    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rack-aware fetching off/ }));
    expect(fetchStatus()).toMatch(/fetches from b5 \(rack C\)/);
    expect(screen.getByText("same-rack, no transfer cost")).toBeInTheDocument();
  });

  it("with no in-sync replica in the consumer's rack, rack-aware fetching falls back to the leader", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(screen.getByRole("button", { name: /rack-aware fetching off/ })); // turn on
    await user.click(failRack("C")); // kill the rack-C replica

    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();
  });
});
