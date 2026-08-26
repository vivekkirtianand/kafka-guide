import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IdempotenceDemo from "./IdempotenceDemo";

function partitionLog() {
  return screen.getByTestId("partition-log");
}

describe("IdempotenceDemo", () => {
  it("starts idempotent, with an empty log and the retry button disabled", () => {
    render(<IdempotenceDemo />);

    expect(screen.getByRole("button", { name: "enable.idempotence=true" })).toBeInTheDocument();
    expect(partitionLog()).toHaveTextContent("(empty)");
    expect(screen.getByRole("button", { name: /ack lost/i })).toBeDisabled();
  });

  it("produces a record with sequence 0", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));

    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(screen.getByRole("button", { name: /ack lost/i })).not.toBeDisabled();
  });

  it("discards a retried send as a duplicate when idempotence is enabled", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack lost/i }));

    expect(partitionLog()).not.toHaveTextContent("offset 1");
    expect(screen.getByText(/discarded as a duplicate/)).toBeInTheDocument();
  });

  it("appends a genuine duplicate when idempotence is disabled", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "enable.idempotence=true" }));
    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: /ack lost/i }));

    expect(partitionLog()).toHaveTextContent("offset 0 · seq=0");
    expect(partitionLog()).toHaveTextContent("offset 1 · seq=0");
    expect(screen.getByText(/no idempotence, so the broker has no way to detect this is a retry/)).toBeInTheDocument();
  });

  it("resets to the initial state", async () => {
    const user = userEvent.setup();
    render(<IdempotenceDemo />);

    await user.click(screen.getByRole("button", { name: "produce record →" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(partitionLog()).toHaveTextContent("(empty)");
    expect(screen.getByRole("button", { name: "enable.idempotence=true" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ack lost/i })).toBeDisabled();
  });
});
