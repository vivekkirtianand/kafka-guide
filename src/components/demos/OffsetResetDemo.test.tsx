import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OffsetResetDemo from "./OffsetResetDemo";

const view = () => screen.getByTestId("partition-view");
const countWithStatus = (status: string) => view().querySelectorAll(`[data-status="${status}"]`).length;

describe("OffsetResetDemo", () => {
  it("starts with a committed offset partway through the log", () => {
    render(<OffsetResetDemo />);

    expect(screen.getByTestId("committed-offset")).toHaveTextContent(
      "committed offset: 8 / 12 · 4 records not yet consumed by this group",
    );
    expect(countWithStatus("consumed")).toBe(8);
    expect(countWithStatus("pending")).toBe(4);
  });

  it("--to-earliest re-queues every record for redelivery", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 0 / 12");
    expect(countWithStatus("pending")).toBe(12);
    expect(screen.getByText(/8 records \(offsets 0–7\) will be redelivered on the next poll/)).toBeInTheDocument();
  });

  it("--to-latest makes the group jump past the unconsumed tail, without calling it permanent", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-latest" }));

    expect(countWithStatus("skipped")).toBe(4);
    expect(
      screen.getByText(/The group jumps past 4 records \(offsets 8–11\) — they won't be delivered unless a later reset moves the bookmark back/),
    ).toBeInTheDocument();
  });

  it("a later backward reset picks skipped records back up", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-latest" }));
    expect(countWithStatus("skipped")).toBe(4);

    await user.click(screen.getByRole("button", { name: "--to-offset 5" }));

    expect(countWithStatus("skipped")).toBe(0);
    expect(countWithStatus("pending")).toBe(7);
    expect(screen.getByText(/7 records \(offsets 5–11\) will be redelivered/)).toBeInTheDocument();
  });

  it("resets to the initial committed offset", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 8 / 12");
    expect(countWithStatus("consumed")).toBe(8);
  });
});
