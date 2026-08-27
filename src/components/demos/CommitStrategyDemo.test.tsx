import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommitStrategyDemo from "./CommitStrategyDemo";

describe("CommitStrategyDemo", () => {
  it("starts at the beginning of the partition in auto-commit mode", () => {
    render(<CommitStrategyDemo />);

    expect(screen.getByRole("button", { name: "enable.auto.commit=true" })).toHaveClass("border-accent/50");
    expect(screen.getByTestId("read-position")).toHaveTextContent("0");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
  });

  it("auto-commit lags the read position by one batch", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await user.click(screen.getByRole("button", { name: "poll() →" }));
    expect(screen.getByTestId("read-position")).toHaveTextContent("2");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
    expect(screen.getByText(/poll 1: returned records 0–1\. Nothing to auto-commit yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "poll() →" }));
    expect(screen.getByTestId("read-position")).toHaveTextContent("4");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("2");
    expect(screen.getByTestId("uncommitted-gap")).toHaveTextContent("2 records");
    expect(screen.getByText(/poll 2: auto-commit first advanced the committed offset to 2/)).toBeInTheDocument();
  });

  it("manual mode commits exactly when commitSync is called", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await user.click(screen.getByRole("button", { name: "enable.auto.commit=false" }));
    await user.click(screen.getByRole("button", { name: "poll() →" }));

    expect(screen.getByTestId("read-position")).toHaveTextContent("2");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
    expect(screen.getByTestId("uncommitted-gap")).toHaveTextContent("2 records");

    await user.click(screen.getByRole("button", { name: "commitSync() →" }));
    expect(screen.getByTestId("committed-position")).toHaveTextContent("2");
    expect(screen.getByTestId("uncommitted-gap")).toHaveTextContent("0 records");
    expect(screen.getByText("commitSync(): committed offset 0 → 2, right after processing records 0–1.")).toBeInTheDocument();
  });

  it("switching mode resets progress", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await user.click(screen.getByRole("button", { name: "poll() →" }));
    await user.click(screen.getByRole("button", { name: "enable.auto.commit=false" }));

    expect(screen.getByTestId("read-position")).toHaveTextContent("0");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
  });
});
