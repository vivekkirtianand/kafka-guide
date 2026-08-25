import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecordFlowDemo from "./RecordFlowDemo";

// mirrors the component's internal hash so expectations don't hardcode magic numbers
function hashPartition(key: string, partitions: number): number {
  let hash = 0;
  for (const ch of key) hash += ch.charCodeAt(0);
  return hash % partitions;
}

function partitionColumn(index: number) {
  return screen.getByTestId(`partition-column-${index}`);
}

describe("RecordFlowDemo", () => {
  it("starts idle with all partitions empty", () => {
    render(<RecordFlowDemo />);
    expect(screen.getByText("waiting to produce a record.")).toBeInTheDocument();
    expect(within(partitionColumn(0)).getByText("(empty)")).toBeInTheDocument();
    expect(within(partitionColumn(1)).getByText("(empty)")).toBeInTheDocument();
    expect(within(partitionColumn(2)).getByText("(empty)")).toBeInTheDocument();
  });

  it("marks a correct prediction when the guessed partition matches the hash", async () => {
    const user = userEvent.setup();
    render(<RecordFlowDemo />);

    const key = "user-42";
    const target = hashPartition(key, 3);

    await user.click(screen.getByRole("button", { name: `partition-${target}` }));
    await user.click(screen.getByRole("button", { name: /produce record/i }));

    expect(screen.getByText("prediction correct")).toBeInTheDocument();
    expect(within(partitionColumn(target)).getByText(`offset 0 · ${key}`)).toBeInTheDocument();
  });

  it("marks a missed prediction when the guessed partition does not match the hash", async () => {
    const user = userEvent.setup();
    render(<RecordFlowDemo />);

    const key = "user-42";
    const target = hashPartition(key, 3);
    const wrongGuess = (target + 1) % 3;

    await user.click(screen.getByRole("button", { name: `partition-${wrongGuess}` }));
    await user.click(screen.getByRole("button", { name: /produce record/i }));

    expect(screen.getByText("prediction missed")).toBeInTheDocument();
  });

  it("shows no prediction badge when no guess was made", async () => {
    const user = userEvent.setup();
    render(<RecordFlowDemo />);

    await user.click(screen.getByRole("button", { name: /produce record/i }));

    expect(screen.queryByText("prediction correct")).not.toBeInTheDocument();
    expect(screen.queryByText("prediction missed")).not.toBeInTheDocument();
  });

  it("spreads unkeyed records across partitions in turn", async () => {
    const user = userEvent.setup();
    render(<RecordFlowDemo />);

    const input = screen.getByPlaceholderText("e.g. user-42");
    await user.clear(input);

    await user.click(screen.getByRole("button", { name: /produce record/i }));
    await user.click(screen.getByRole("button", { name: /produce record/i }));
    await user.click(screen.getByRole("button", { name: /produce record/i }));

    expect(within(partitionColumn(0)).getByText("offset 0 · (none)")).toBeInTheDocument();
    expect(within(partitionColumn(1)).getByText("offset 0 · (none)")).toBeInTheDocument();
    expect(within(partitionColumn(2)).getByText("offset 0 · (none)")).toBeInTheDocument();
  });

  it("resets key, predictions, and partition logs", async () => {
    const user = userEvent.setup();
    render(<RecordFlowDemo />);

    await user.click(screen.getByRole("button", { name: /produce record/i }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText("waiting to produce a record.")).toBeInTheDocument();
    expect(within(partitionColumn(0)).getByText("(empty)")).toBeInTheDocument();
    expect(within(partitionColumn(1)).getByText("(empty)")).toBeInTheDocument();
    expect(within(partitionColumn(2)).getByText("(empty)")).toBeInTheDocument();
  });
});
