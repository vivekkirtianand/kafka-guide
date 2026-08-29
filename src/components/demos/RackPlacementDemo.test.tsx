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
    expect(status()).toMatch(/ISR 3 across racks A, B, C/);
    expect(screen.getByTestId("config-drift")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "reassign partition →" }));
    expect(screen.queryByTestId("config-drift")).not.toBeInTheDocument();
    await user.click(rackBtn("A", "fail rack"));
    expect(status()).toMatch(/ISR 1/);
    expect(screen.getByText("acks=all failing")).toBeInTheDocument();
  });

  it("reassigning does not resurrect replicas whose rack is still down", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(rackBtn("B", "fail rack"));
    expect(status()).toMatch(/ISR 2 across racks A, C/);

    await user.click(screen.getByRole("button", { name: /broker\.rack set/ }));
    await user.click(screen.getByRole("button", { name: "reassign partition →" }));

    expect(status()).toMatch(/ISR 2/);
    expect(within(screen.getByTestId("broker-3")).getByText("b3")).toHaveClass("line-through");
    expect(screen.getByText(/Replicas in down racks \(b3\) start out of the ISR/)).toBeInTheDocument();
    expect(rackBtn("B", "restore rack")).toBeInTheDocument();
  });

  it("a restored rack catches up before rejoining the ISR and leadership does not move back", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(rackBtn("A", "fail rack"));
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·L")).toBeInTheDocument();

    await user.click(rackBtn("A", "restore rack"));
    expect(status()).toMatch(/ISR 2 across racks B, C/);
    expect(within(screen.getByTestId("broker-1")).getByText("b1 ·↑")).toBeInTheDocument();

    await user.click(rackBtn("A", "b1 finish catch-up →"));
    expect(status()).toMatch(/ISR 3 across racks A, B, C/);
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·L")).toBeInTheDocument();
  });

  it("a stale replica recovers as ineligible and only catches up once an eligible leader is back", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    // fail A, then B, then C — last non-empty ISR is {b5}
    await user.click(rackBtn("A", "fail rack"));
    await user.click(rackBtn("B", "fail rack"));
    await user.click(rackBtn("C", "fail rack"));
    expect(status()).toMatch(/offline · no surviving replica/);

    // b3 was not in the last ISR {b5}: recovers as ineligible, still offline, no leader
    await user.click(rackBtn("B", "restore rack"));
    await user.click(rackBtn("B", "b3 finish catch-up →"));
    expect(status()).toMatch(/offline · recovered replica ineligible to lead/);
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·!")).toBeInTheDocument();
    expect(fetchStatus()).toMatch(/partition offline/);

    // b5 (eligible) comes back and leads; b3 must now catch up from it
    await user.click(rackBtn("C", "restore rack"));
    await user.click(rackBtn("C", "b5 finish catch-up →"));
    expect(status()).toMatch(/online · ISR 1/);
    expect(within(screen.getByTestId("broker-3")).getByText("b3 ·↑")).toBeInTheDocument();

    await user.click(rackBtn("B", "b3 finish catch-up →"));
    expect(status()).toMatch(/online · ISR 2/);
    expect(screen.getByText(/b3 caught up from leader b5/)).toBeInTheDocument();
  });

  it("unclean.leader.election.enable lets a stale replica lead, with a data-loss badge", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(rackBtn("A", "fail rack"));
    await user.click(rackBtn("B", "fail rack"));
    await user.click(rackBtn("C", "fail rack")); // last ISR {b5}

    await user.click(screen.getByRole("button", { name: /unclean\.leader\.election\.enable=false/ }));
    await user.click(rackBtn("A", "restore rack"));
    await user.click(rackBtn("A", "b1 finish catch-up →"));

    expect(status()).toMatch(/online · ISR/);
    expect(screen.getByText("unclean election — data lost")).toBeInTheDocument();
    expect(screen.getByText(/leads from behind\. Records only those replicas held are lost/)).toBeInTheDocument();
  });

  it("enabling unclean election after a replica is already ineligible elects it instead of staying offline", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    await user.click(rackBtn("A", "fail rack"));
    await user.click(rackBtn("B", "fail rack"));
    await user.click(rackBtn("C", "fail rack")); // last ISR {b5}

    // b1 recovers first and is ineligible (unclean still off)
    await user.click(rackBtn("A", "restore rack"));
    await user.click(rackBtn("A", "b1 finish catch-up →"));
    expect(status()).toMatch(/offline · recovered replica ineligible to lead/);

    // flip the toggle — the stuck partition elects the ineligible replica
    await user.click(screen.getByRole("button", { name: /unclean\.leader\.election\.enable=false/ }));
    expect(status()).toMatch(/online · ISR 1 across rack A/);
    expect(screen.getByText("unclean election — data lost")).toBeInTheDocument();
    expect(screen.getByText(/no eligible replica, so the controller elects b1/)).toBeInTheDocument();
  });

  it("rack-aware fetching removes cross-rack transfer for a same-rack replica", async () => {
    const user = userEvent.setup();
    render(<RackPlacementDemo />);

    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rack-aware fetching off/ }));
    expect(fetchStatus()).toMatch(/fetches from b5 \(rack C\)/);
    expect(screen.getByText("same-rack — no cross-rack transfer")).toBeInTheDocument();

    await user.click(rackBtn("C", "fail rack"));
    expect(fetchStatus()).toMatch(/fetches from b1 \(rack A\)/);
    expect(screen.getByText("cross-rack transfer")).toBeInTheDocument();
  });
});
