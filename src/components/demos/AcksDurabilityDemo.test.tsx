import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AcksDurabilityDemo from "./AcksDurabilityDemo";

function brokerCard(id: number) {
  return screen.getByTestId(`acks-broker-${id}`);
}

describe("AcksDurabilityDemo", () => {
  it("starts on acks=all with a clean, in-sync cluster", () => {
    render(<AcksDurabilityDemo />);
    expect(screen.getByRole("button", { name: "acks=all" })).toHaveClass("border-accent/50");
    expect(brokerCard(1)).toHaveTextContent("alive");
    expect(brokerCard(1)).toHaveTextContent("no record");
    expect(screen.getByText("waiting to produce a record.")).toBeInTheDocument();
  });

  it("acks=all with no crash: record is replicated and safely acknowledged", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("acknowledged — data safe")).toBeInTheDocument();
    expect(within(brokerCard(2)).getByText("has record")).toBeInTheDocument();
    expect(within(brokerCard(3)).getByText("has record")).toBeInTheDocument();
  });

  it("acks=all with the leader crashing after replicating: outcome is ambiguous even though the record survived", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: /crash leader/i }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("not acknowledged — outcome unknown")).toBeInTheDocument();
    // ground truth: the record actually made it to both followers, even though the
    // producer has no way to know that from the timeout alone
    expect(within(brokerCard(2)).getByText("has record")).toBeInTheDocument();
    expect(within(brokerCard(3)).getByText("has record")).toBeInTheDocument();
    expect(screen.getByText(/enable.idempotence=true is what makes that retry safe/)).toBeInTheDocument();
  });

  it("acks=1 with no crash: record is acknowledged and still replicates normally", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "acks=1" }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("acknowledged — data safe")).toBeInTheDocument();
  });

  it("acks=1 with the leader crashing before replication: acknowledged data loss", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "acks=1" }));
    await user.click(screen.getByRole("button", { name: /crash leader/i }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("acknowledged — data lost")).toBeInTheDocument();
    expect(
      screen.getByText(/A follower without this record can now be elected leader — the record is gone/),
    ).toBeInTheDocument();
  });

  it("acks=0 with no crash: no acknowledgment is ever requested, even when nothing fails", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "acks=0" }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("acknowledgment not requested — delivery unknown")).toBeInTheDocument();
    expect(screen.queryByText(/^acknowledged/)).not.toBeInTheDocument();
  });

  it("acks=0 with the leader crashing: the producer never knows anything was lost", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "acks=0" }));
    await user.click(screen.getByRole("button", { name: /crash leader/i }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("producer considered sent — record lost")).toBeInTheDocument();
    expect(screen.getByText(/it never asked in the first place/)).toBeInTheDocument();
  });

  it("resets to the initial state", async () => {
    const user = userEvent.setup();
    render(<AcksDurabilityDemo />);

    await user.click(screen.getByRole("button", { name: "acks=1" }));
    await user.click(screen.getByRole("button", { name: /crash leader/i }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByRole("button", { name: "acks=all" })).toHaveClass("border-accent/50");
    expect(brokerCard(1)).toHaveTextContent("alive");
    expect(screen.queryByText("acknowledged — data lost")).not.toBeInTheDocument();
    expect(screen.getByText("waiting to produce a record.")).toBeInTheDocument();
  });
});
