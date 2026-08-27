import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OffsetResetDemo from "./OffsetResetDemo";

describe("OffsetResetDemo", () => {
  it("starts with a committed offset partway through the log", () => {
    render(<OffsetResetDemo />);

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 8 / 12 · 4 records pending");
  });

  it("--to-earliest replays every record", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 0 / 12 · 12 records pending");
    expect(screen.getByText(/8 records \(offsets 0–7\) will be replayed on the next poll/)).toBeInTheDocument();
  });

  it("--to-latest skips the unconsumed tail permanently", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-latest" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 12 / 12 · 0 records pending");
    expect(screen.getByText(/4 records \(offsets 8–11\) are skipped — never delivered to this group/)).toBeInTheDocument();
  });

  it("--shift-by -3 replays the last three consumed records", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--shift-by -3" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 5 / 12");
    expect(screen.getByText(/3 records \(offsets 5–7\) will be replayed/)).toBeInTheDocument();
  });

  it("resets to the initial committed offset", async () => {
    const user = userEvent.setup();
    render(<OffsetResetDemo />);

    await user.click(screen.getByRole("button", { name: "--to-earliest" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("committed offset: 8 / 12");
  });
});
