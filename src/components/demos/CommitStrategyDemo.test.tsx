import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommitStrategyDemo from "./CommitStrategyDemo";

async function poll(user: ReturnType<typeof userEvent.setup>, times = 1) {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole("button", { name: "poll() →" }));
  }
}

describe("CommitStrategyDemo", () => {
  it("starts at the beginning of the partition in auto-commit mode", () => {
    render(<CommitStrategyDemo />);

    expect(screen.getByRole("button", { name: "enable.auto.commit=true" })).toHaveClass("border-accent/50");
    expect(screen.getByTestId("read-position")).toHaveTextContent("0");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
  });

  it("auto-commit fires on the interval clock, not every batch, so it can trail several polls", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await poll(user, 3);
    // 3 polls at 2000ms each -> clock 6000ms, but no commit has run yet (interval is 5000ms
    // and each check happened before 5000ms had elapsed since the last commit)
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
    expect(screen.getByTestId("read-position")).toHaveTextContent("6");

    await poll(user, 1);
    expect(screen.getByTestId("committed-position")).toHaveTextContent("6");
    expect(screen.getByTestId("read-position")).toHaveTextContent("8");
    expect(screen.getByTestId("redelivered-gap")).toHaveTextContent("2 records");
    expect(screen.getByText(/auto-commit fired at 6000ms — committed offset advanced to 6/)).toBeInTheDocument();
  });

  it("slow polls let auto-commit keep up to within one batch", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await user.click(screen.getByRole("button", { name: "6000ms/poll" }));
    await poll(user, 2);

    expect(screen.getByTestId("committed-position")).toHaveTextContent("2");
    expect(screen.getByTestId("read-position")).toHaveTextContent("4");
    expect(screen.getByTestId("redelivered-gap")).toHaveTextContent("2 records");
  });

  it("manual mode commits exactly when commitSync is called", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await user.click(screen.getByRole("button", { name: "enable.auto.commit=false" }));
    await poll(user, 1);

    expect(screen.getByTestId("read-position")).toHaveTextContent("2");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
    expect(screen.getByTestId("redelivered-gap")).toHaveTextContent("2 records");

    await user.click(screen.getByRole("button", { name: "commitSync() →" }));
    expect(screen.getByTestId("committed-position")).toHaveTextContent("2");
    expect(screen.getByTestId("redelivered-gap")).toHaveTextContent("0 records");
    expect(screen.getByText("commitSync(): committed offset 0 → 2, right after processing records 0–1.")).toBeInTheDocument();
  });

  it("switching mode resets progress", async () => {
    const user = userEvent.setup();
    render(<CommitStrategyDemo />);

    await poll(user, 1);
    await user.click(screen.getByRole("button", { name: "enable.auto.commit=false" }));

    expect(screen.getByTestId("read-position")).toHaveTextContent("0");
    expect(screen.getByTestId("committed-position")).toHaveTextContent("0");
  });
});
