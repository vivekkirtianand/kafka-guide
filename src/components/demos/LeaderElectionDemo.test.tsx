import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeaderElectionDemo from "./LeaderElectionDemo";

function brokerCard(id: number) {
  return screen.getByTestId(`broker-card-${id}`);
}

describe("LeaderElectionDemo", () => {
  it("starts with broker-1 as leader and brokers 2/3 as in-sync followers", () => {
    render(<LeaderElectionDemo />);
    expect(brokerCard(1)).toHaveTextContent("leader");
    expect(brokerCard(2)).toHaveTextContent("follower");
    expect(brokerCard(3)).toHaveTextContent("follower");
    expect(screen.getByText(/broker-1 elected leader/)).toBeInTheDocument();
  });

  it("elects a new leader from the ISR when the leader fails", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));

    expect(brokerCard(1)).toHaveTextContent("offline");
    expect(brokerCard(2)).toHaveTextContent("leader");
    expect(screen.getByText(/broker-1 \(leader\) failed\. broker-2 elected from the ISR\./)).toBeInTheDocument();
  });

  it("drops a failed follower out of the ISR without re-electing", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));

    expect(brokerCard(1)).toHaveTextContent("leader");
    expect(brokerCard(2)).toHaveTextContent("offline");
    expect(screen.getByText(/broker-2 \(follower\) failed and dropped out of the ISR\./)).toBeInTheDocument();
  });

  it("puts a restarted broker into recovering, not directly back into the ISR", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /restart/i }));

    expect(brokerCard(2)).toHaveTextContent("recovering");
    expect(screen.getByText(/broker-2 restarted and is replicating from the leader — not yet in the ISR\./)).toBeInTheDocument();
  });

  it("only admits a recovering broker to the ISR once it has caught up", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /restart/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /catch up/i }));

    expect(brokerCard(2)).toHaveTextContent("follower");
    expect(screen.getByText(/broker-2 caught up and rejoined the ISR as a follower\./)).toBeInTheDocument();
  });

  it("does not consider a recovering broker for leader election", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    // broker-2 restarts but hasn't caught up yet
    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /restart/i }));
    expect(brokerCard(2)).toHaveTextContent("recovering");

    // the leader now fails — only broker-3 is in-sync, so it must be elected, not the recovering broker-2
    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));

    expect(brokerCard(2)).toHaveTextContent("recovering");
    expect(brokerCard(3)).toHaveTextContent("leader");
    expect(screen.getByText(/broker-1 \(leader\) failed\. broker-3 elected from the ISR\./)).toBeInTheDocument();
  });

  it("does not offer a clean catch-up when no leader exists to replicate from", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    // take down every broker so the partition is offline
    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(3)).getByRole("button", { name: /kill broker/i }));

    await user.click(within(brokerCard(1)).getByRole("button", { name: /restart/i }));

    expect(brokerCard(1)).toHaveTextContent("recovering");
    expect(within(brokerCard(1)).queryByRole("button", { name: /^catch up/i })).not.toBeInTheDocument();
    expect(within(brokerCard(1)).getByRole("button", { name: /elect anyway \(unclean\)/i })).toBeInTheDocument();
    expect(
      screen.getByText(/broker-1 restarted with no leader in place — it has nothing to replicate from and cannot catch up\./),
    ).toBeInTheDocument();
  });

  it("requires an explicit unclean-election decision to promote a broker with no confirmed catch-up", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(3)).getByRole("button", { name: /kill broker/i }));

    await user.click(within(brokerCard(1)).getByRole("button", { name: /restart/i }));
    await user.click(within(brokerCard(1)).getByRole("button", { name: /elect anyway \(unclean\)/i }));

    expect(brokerCard(1)).toHaveTextContent("leader");
    expect(
      screen.getByText(
        /broker-1 promoted with no confirmed catch-up — unclean election\. Records only acknowledged to the previous leader may be lost\./,
      ),
    ).toBeInTheDocument();
  });

  it("does not admit a recovering broker that fails before catching up", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /restart/i }));
    await user.click(within(brokerCard(2)).getByRole("button", { name: /^kill$/i }));

    expect(brokerCard(2)).toHaveTextContent("offline");
    expect(screen.getByText(/broker-2 failed while still catching up — it was never admitted to the ISR\./)).toBeInTheDocument();
  });

  it("takes the partition offline once every broker has failed", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    // broker-1 (leader) fails -> broker-2 elected
    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));
    // broker-2 (new leader) fails -> broker-3 elected
    await user.click(within(brokerCard(2)).getByRole("button", { name: /kill broker/i }));
    // broker-3 (last leader) fails -> no in-sync replicas remain
    await user.click(within(brokerCard(3)).getByRole("button", { name: /kill broker/i }));

    expect(
      screen.getByText(/broker-3 \(leader\) failed\. No in-sync replica available — partition is offline\./),
    ).toBeInTheDocument();
  });

  it("resets to the initial state", async () => {
    const user = userEvent.setup();
    render(<LeaderElectionDemo />);

    await user.click(within(brokerCard(1)).getByRole("button", { name: /kill broker/i }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(brokerCard(1)).toHaveTextContent("leader");
    expect(brokerCard(2)).toHaveTextContent("follower");
    expect(brokerCard(3)).toHaveTextContent("follower");
    expect(screen.getByText(/broker-1 elected leader/)).toBeInTheDocument();
  });
});
