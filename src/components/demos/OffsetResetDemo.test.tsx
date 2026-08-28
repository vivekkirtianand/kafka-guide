import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OffsetResetDemo from "./OffsetResetDemo";

const view = () => screen.getByTestId("partition-view");
const countWithStatus = (status: string) => view().querySelectorAll(`[data-status="${status}"]`).length;

describe("OffsetResetDemo", () => {
  it("starts with a committed offset partway through the log", () => {
    render(<OffsetResetDemo />);

    expect(screen.getByTestId("reset-committed")).toHaveTextContent(
      "committed offset: 8 / 12 · next poll delivers 4 records (0 replayed, 4 new)",
    );
    expect(countWithStatus("consumed")).toBe(8);
    expect(countWithStatus("pending")).toBe(4);
  });

  it("--to-earliest replays already-consumed records rather than calling them new", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));

    expect(screen.getByTestId("reset-committed")).toHaveTextContent(
      "committed offset: 0 / 12 · next poll delivers 12 records (8 replayed, 4 new)",
    );
    expect(countWithStatus("replay")).toBe(8);
    expect(countWithStatus("pending")).toBe(4);
    expect(countWithStatus("consumed")).toBe(0);
    expect(screen.getByText(/Records 0–7 will be redelivered on the next poll — 8 already consumed \(a replay\), 0 not yet seen/)).toBeInTheDocument();
  });

  it("--to-latest makes the group jump past the unconsumed tail, without calling it permanent", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-latest" }));

    expect(countWithStatus("skipped")).toBe(4);
    expect(screen.getByTestId("reset-committed")).toHaveTextContent("4 skipped without being consumed");
    expect(
      screen.getByText(/The group jumps past records 8–11 — 4 never consumed \(skipped\), 0 already consumed\. Another reset can move the bookmark back/),
    ).toBeInTheDocument();
  });

  it("a later backward reset restores skipped records and keeps consumption history", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-latest" }));
    expect(countWithStatus("skipped")).toBe(4);

    await user.click(screen.getByRole("button", { name: "--to-offset 5" }));

    expect(countWithStatus("skipped")).toBe(0);
    expect(countWithStatus("replay")).toBe(3); // offsets 5,6,7 — consumed before, now re-read
    expect(countWithStatus("pending")).toBe(4); // offsets 8–11 — genuinely never seen
    expect(screen.getByTestId("reset-committed")).toHaveTextContent("next poll delivers 7 records (3 replayed, 4 new)");
  });

  it("resets to the initial committed offset", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("reset-committed")).toHaveTextContent("committed offset: 8 / 12");
    expect(countWithStatus("consumed")).toBe(8);
  });
});
