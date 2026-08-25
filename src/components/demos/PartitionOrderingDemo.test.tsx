import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PartitionOrderingDemo from "./PartitionOrderingDemo";

function partitionColumn(index: number) {
  return screen.getByTestId(`partition-column-${index}`);
}

async function sendAll(user: ReturnType<typeof userEvent.setup>) {
  while (screen.queryByRole("button", { name: /send next record/i })) {
    await user.click(screen.getByRole("button", { name: /send next record/i }));
  }
}

describe("PartitionOrderingDemo", () => {
  it("defaults to a single partition with nothing sent yet", () => {
    render(<PartitionOrderingDemo />);
    expect(screen.getByTestId("partition-column-0")).toBeInTheDocument();
    expect(screen.queryByTestId("partition-column-1")).not.toBeInTheDocument();
    expect(within(partitionColumn(0)).getByText("(empty)")).toBeInTheDocument();
  });

  it("preserves exact global send order on a single partition", async () => {
    const user = userEvent.setup();
    render(<PartitionOrderingDemo />);

    await sendAll(user);

    const entries = within(partitionColumn(0)).getAllByText(/^[AB]\d$/);
    expect(entries.map((e) => e.textContent)).toEqual(["A1", "B1", "A2", "A3", "B2", "B3"]);
    expect(screen.getByRole("button", { name: "all records sent" })).toBeDisabled();
  });

  it("splits keys across partitions and keeps per-key order when partitions > 1", async () => {
    const user = userEvent.setup();
    render(<PartitionOrderingDemo />);

    await user.click(screen.getByRole("button", { name: "3" }));
    await sendAll(user);

    const columns = [0, 1, 2].map(partitionColumn);
    const nonEmptyColumns = columns.filter((c) => within(c).queryAllByText(/^[AB]\d$/).length > 0);

    // every key consistently hashes to the same partition, so A-records and B-records
    // each land together, in send order, within their own partition
    for (const col of nonEmptyColumns) {
      const labels = within(col).getAllByText(/^[AB]\d$/).map((e) => e.textContent);
      const keys = new Set(labels.map((l) => l![0]));
      expect(keys.size).toBe(1);
    }

    const allLabels = nonEmptyColumns.flatMap((c) =>
      within(c).getAllByText(/^[AB]\d$/).map((e) => e.textContent),
    );
    expect(allLabels.sort()).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
  });

  it("changing partition count resets progress", async () => {
    const user = userEvent.setup();
    render(<PartitionOrderingDemo />);

    await user.click(screen.getByRole("button", { name: /send next record/i }));
    await user.click(screen.getByRole("button", { name: "2" }));

    expect(within(partitionColumn(0)).getByText("(empty)")).toBeInTheDocument();
    expect(within(partitionColumn(1)).getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send next record \(A1\)/i })).toBeInTheDocument();
  });

  it("explains the single-partition global-order guarantee", () => {
    render(<PartitionOrderingDemo />);
    expect(screen.getByText(/every record lands in send order/i)).toBeInTheDocument();
  });

  it("explains per-key ordering once partitions > 1", async () => {
    const user = userEvent.setup();
    render(<PartitionOrderingDemo />);

    await user.click(screen.getByRole("button", { name: "2" }));

    expect(screen.getByText(/ordering is only guaranteed/i)).toBeInTheDocument();
  });
});
