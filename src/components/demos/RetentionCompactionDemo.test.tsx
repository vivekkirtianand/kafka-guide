import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RetentionCompactionDemo from "./RetentionCompactionDemo";

const replay = () => screen.getByTestId("replay").textContent ?? "";
const partitionLog = () => screen.getByTestId("partition-log");

describe("RetentionCompactionDemo", () => {
  it("starts on delete policy with five records and the latest value per key in replay", () => {
    render(<RetentionCompactionDemo />);
    // a2 supersedes a0 for reads only after compaction; a full replay still sees both.
    expect(replay()).toBe("a=a0, b=b1, a=a2, c=c3, b=b4");
  });

  it("delete ages out the oldest closed segment whole, ignoring keys", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);

    // Push offsets up so segment 0 (offsets 0-3) is closed.
    await user.click(screen.getByRole("button", { name: /produce a=/ }));
    await user.click(screen.getByRole("button", { name: /produce a=/ }));
    await user.click(screen.getByRole("button", { name: /produce a=/ }));

    await user.click(screen.getByRole("button", { name: "retention elapsed →" }));

    // offsets 0-3 gone (a0, b1, a2, c3), so key a's only surviving early value is gone
    // but its newer values remain.
    expect(screen.queryByTestId("entry-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entry-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("entry-4")).toBeInTheDocument();
    expect(screen.getByText(/dropped 4 record\(s\) whole, regardless of key/)).toBeInTheDocument();
  });

  it("never deletes the active segment", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);
    // First press clears closed segment 0 (offsets 0-3); only offset 4 is left, in the active segment.
    await user.click(screen.getByRole("button", { name: "retention elapsed →" }));
    await user.click(screen.getByRole("button", { name: "retention elapsed →" }));
    expect(screen.getByText(/every record is still in the active segment/)).toBeInTheDocument();
  });

  it("compaction keeps only the latest value per key and preserves offsets", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);

    await user.click(screen.getByRole("button", { name: "compact" }));
    await user.click(screen.getByRole("button", { name: "run compaction →" }));

    // a0 and b1 are superseded by a2 / b4; c3 stays.
    expect(screen.queryByTestId("entry-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entry-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("entry-2")).toHaveTextContent("2a=a2");
    expect(screen.getByTestId("entry-3")).toHaveTextContent("3c=c3");
    expect(screen.getByTestId("entry-4")).toHaveTextContent("4b=b4");
    expect(replay()).toBe("a=a2, c=c3, b=b4");
  });

  it("a tombstone survives one compaction pass, then is removed on the next", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);

    await user.click(screen.getByRole("button", { name: "compact" }));
    // key defaults to "a" — tombstone it
    await user.click(screen.getByRole("button", { name: "produce tombstone →" }));

    await user.click(screen.getByRole("button", { name: "run compaction →" }));
    // tombstone for a is kept, marked expiring; a's value is gone from replay
    expect(screen.getByText(/kept for one more pass/)).toBeInTheDocument();
    expect(replay()).toBe("c=c3, b=b4");

    await user.click(screen.getByRole("button", { name: "run compaction →" }));
    expect(screen.getByText(/dropped 1 expired tombstone/)).toBeInTheDocument();
    // key "a" is now completely absent from the log
    expect(partitionLog().textContent).not.toContain("a=");
  });
});
