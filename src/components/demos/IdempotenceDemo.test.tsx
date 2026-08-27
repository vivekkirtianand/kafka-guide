import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IdempotenceDemo from "./IdempotenceDemo";

function partitionLog() {
  return screen.getByTestId("partition-log");
}

describe("IdempotenceDemo", () => {
  it("starts idempotent, with an empty log and no pending record", () => {
    render(<IdempotenceDemo />);

    expect(screen.getByRole("button", { name: "enable.idempotence=true" })).toBeInTheDocument();
    expect(partitionLog()).toHaveTextContent("(empty)");
    expect(screen.getByRole("button", { name: "produce record →" })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /ack received normally/i })).not.toBeInTheDocument();
  });

  it("leaves the outcome unresolved immediately after sending", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("record sent (seq=0) — outcome not yet known.")).toBeInTheDocument();
    expect(partitionLog()).toHaveTextContent("(empty)");
    expect(screen.getByRole("button", { name: "produce record →" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /ack received normally/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ack lost in transit/i })).toBeInTheDocument();
  });

  it("a normal acknowledgment confirms the write and frees up the next send", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack received normally/i }));

    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(screen.getByText("ack received for seq=0 — write confirmed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "produce record →" })).not.toBeDisabled();
  });

  it("a lost ack still lands the write — the producer just doesn't know it yet", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack lost in transit/i }));

    // ground truth: the write already landed
    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(screen.getByText(/the write actually reached the broker, but the producer doesn't know/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /producer retries/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ack received normally/i })).not.toBeInTheDocument();
  });

  it("discards a retry as a duplicate when idempotence is enabled", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack lost in transit/i }));
    await user.click(screen.getByRole("button", { name: /producer retries/i }));

    expect(partitionLog()).not.toHaveTextContent("offset 1");
    expect(screen.getByText(/discarded as a duplicate/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "produce record →" })).not.toBeDisabled();
  });

  it("toggling idempotence recreates the producer without touching existing broker data", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack received normally/i }));
    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");

    await user.click(screen.getByRole("button", { name: "enable.idempotence=true" }));

    // recreating the producer resets its own identity, not records the broker already has
    expect(screen.getByRole("button", { name: "enable.idempotence=false" })).toBeInTheDocument();
    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(screen.getByText(/producer recreated with the new setting/)).toBeInTheDocument();

    // the new (non-idempotent) producer's send appends alongside the old entry, not in place of it
    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack received normally/i }));
    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(partitionLog()).toHaveTextContent("offset 1");
  });

  it("appends a genuine duplicate when idempotence is disabled, with no sequence number shown", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "enable.idempotence=true" }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(screen.getByText("record sent — outcome not yet known.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ack lost in transit/i }));
    await user.click(screen.getByRole("button", { name: /producer retries/i }));

    const log = partitionLog();
    expect(log).toHaveTextContent("offset 0");
    expect(log).toHaveTextContent("offset 1");
    expect(log).not.toHaveTextContent("seq=");
    expect(screen.getByText(/without a sequence-number protocol, the broker can't tell this apart/)).toBeInTheDocument();
  });

  it("resets to the initial state", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack received normally/i }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(partitionLog()).toHaveTextContent("(empty)");
    expect(screen.getByRole("button", { name: "enable.idempotence=true" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "produce record →" })).not.toBeDisabled();
  });
});
