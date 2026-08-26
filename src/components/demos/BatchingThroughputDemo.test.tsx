import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchingThroughputDemo from "./BatchingThroughputDemo";

function batchList() {
  return screen.getByTestId("batch-list");
}

describe("BatchingThroughputDemo", () => {
  it("defaults to linger.ms=5 and batch.size=default, producing 4 batches", () => {
    render(<BatchingThroughputDemo />);

    expect(screen.getByRole("button", { name: "linger.ms=5" })).toHaveClass("border-accent/50");
    expect(screen.getByRole("button", { name: /batch.size: default/ })).toHaveClass("border-stream/50");
    expect(batchList().children).toHaveLength(4);
    expect(screen.getByText(/4 requests sent for 10 records/)).toBeInTheDocument();
    expect(screen.getByText(/average time from arrival to send: 3\.4ms/)).toBeInTheDocument();
  });

  it("linger.ms=0 sends every record as its own batch (no batching)", async () => {
    const user = userEvent.setup();
    render(<BatchingThroughputDemo />);

    await user.click(screen.getByRole("button", { name: "linger.ms=0" }));

    expect(batchList().children).toHaveLength(10);
    expect(screen.getByText(/10 requests sent for 10 records/)).toBeInTheDocument();
    expect(screen.getByText(/average time from arrival to send: 0\.0ms/)).toBeInTheDocument();
  });

  it("a small batch.size flushes as soon as it fills, producing more, smaller batches", async () => {
    const user = userEvent.setup();
    render(<BatchingThroughputDemo />);

    await user.click(screen.getByRole("button", { name: /batch.size: small/ }));

    expect(batchList().children).toHaveLength(5);
    expect(screen.getByText(/5 requests sent for 10 records/)).toBeInTheDocument();
  });

  it("a long linger.ms combined with a size limit still flushes on size first", async () => {
    const user = userEvent.setup();
    render(<BatchingThroughputDemo />);

    await user.click(screen.getByRole("button", { name: "linger.ms=100" }));

    expect(batchList().children).toHaveLength(2);
    expect(screen.getByText(/2 requests sent for 10 records/)).toBeInTheDocument();
    // the record at t=10 waits all the way until the batch fills at t=92 — a much higher latency
    expect(screen.getByTestId("batch-1")).toHaveTextContent("5 records · sent at t=92ms");
  });

  it("resets to the default configuration", async () => {
    const user = userEvent.setup();
    render(<BatchingThroughputDemo />);

    await user.click(screen.getByRole("button", { name: "linger.ms=0" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByRole("button", { name: "linger.ms=5" })).toHaveClass("border-accent/50");
    expect(batchList().children).toHaveLength(4);
  });
});
