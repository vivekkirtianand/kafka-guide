import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RetentionCompactionDemo from "./RetentionCompactionDemo";

const raw = () => screen.getByTestId("raw-replay").textContent ?? "";
const state = () => screen.getByTestId("materialized").textContent ?? "";
const partitionLog = () => screen.getByTestId("partition-log");

async function produceKey(user: ReturnType<typeof userEvent.setup>, k: string, times = 1) {
  await user.click(screen.getByRole("button", { name: k }));
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole("button", { name: new RegExp(`produce ${k}=`) }));
  }
}

describe("RetentionCompactionDemo", () => {
  it("distinguishes a raw replay from materialized state from the start", () => {
    render(<RetentionCompactionDemo />);
    expect(raw()).toBe("a=a0, b=b1, a=a2, c=c3, b=b4");
    expect(state()).toBe("a=a2, b=b4, c=c3");
  });

  it("delete ages out the oldest closed segment whole and never the active one", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);

    await user.click(screen.getByRole("button", { name: "retention elapsed →" }));
    // segment 0 (offsets 0-3) gone; only offset 4 (active) remains
    expect(screen.queryByTestId("entry-0")).not.toBeInTheDocument();
    expect(screen.getByTestId("entry-4")).toBeInTheDocument();
    expect(screen.getByText(/dropped 4 record\(s\) whole, regardless of key/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "retention elapsed →" }));
    expect(screen.getByText(/every record is still in the active segment/)).toBeInTheDocument();
  });

  it("compaction leaves the active segment alone even when it holds superseded values", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);
    await user.click(screen.getByRole("button", { name: "compact" }));

    // offsets 5 and 6 both land in the active segment (4-7)
    await produceKey(user, "a", 2);
    await user.click(screen.getByRole("button", { name: "run compaction →" }));

    // both survive — a5 is superseded by a6 but the cleaner doesn't touch the active segment
    expect(screen.getByTestId("entry-5")).toHaveTextContent("5a=a5");
    expect(screen.getByTestId("entry-6")).toHaveTextContent("6a=a6");
    // the closed-segment a2 is collapsed
    expect(screen.queryByTestId("entry-2")).not.toBeInTheDocument();
  });

  it("the tombstone retention clock starts when it is produced, not at the first compaction", async () => {
    const user = userEvent.setup();
    render(<RetentionCompactionDemo />);
    await user.click(screen.getByRole("button", { name: "compact" }));

    // advance time *before* producing the tombstone
    await user.click(screen.getByRole("button", { name: "time advances →" }));
    await user.click(screen.getByRole("button", { name: "time advances →" }));

    await produceKey(user, "a", 2); // offsets 5, 6
    await user.click(screen.getByRole("button", { name: "produce tombstone →" })); // offset 7, key a
    await produceKey(user, "b"); // offset 8 -> segment 1 (4-7) closed
    expect(screen.getByText(/its delete\.retention\.ms clock starts now \(tick 2\)/)).toBeInTheDocument();

    // one compaction while still inside the window (clock 2, producedAt 2)
    await user.click(screen.getByRole("button", { name: "run compaction →" }));
    expect(raw()).toContain("a=∅");
    expect(state()).not.toContain("a=");
    expect(screen.getByText(/still inside delete\.retention\.ms/)).toBeInTheDocument();

    // two more ticks put it past delete.retention.ms; next pass drops it
    await user.click(screen.getByRole("button", { name: "time advances →" }));
    await user.click(screen.getByRole("button", { name: "time advances →" }));
    await user.click(screen.getByRole("button", { name: "run compaction →" }));
    expect(screen.getByText(/removed 1 tombstone\(s\) past delete\.retention\.ms/)).toBeInTheDocument();
    expect(partitionLog().textContent).not.toContain("a=");
  });
});
