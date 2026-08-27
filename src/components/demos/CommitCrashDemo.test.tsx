import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommitCrashDemo from "./CommitCrashDemo";

async function processAll(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 3; i++) {
    await user.click(screen.getByRole("button", { name: "process one record →" }));
  }
}

describe("CommitCrashDemo", () => {
  it("committing after processing, then a clean crash, replays nothing", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await processAll(user);
    await user.click(screen.getByRole("button", { name: "commit offset 3 →" }));
    await user.click(screen.getByRole("button", { name: "crash consumer →" }));
    await user.click(screen.getByRole("button", { name: "another consumer takes over →" }));

    expect(screen.getByText("clean handoff")).toBeInTheDocument();
    expect(screen.getByText(/nothing to replay, clean handoff/)).toBeInTheDocument();
  });

  it("crashing after processing but before committing reprocesses the batch", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await processAll(user);
    await user.click(screen.getByRole("button", { name: "crash consumer →" }));
    await user.click(screen.getByRole("button", { name: "another consumer takes over →" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("0");
    expect(screen.getByText("3 records reprocessed")).toBeInTheDocument();
    expect(screen.getByText(/3 records reprocessed \(at-least-once\)/)).toBeInTheDocument();
  });

  it("committing before processing skips records on a crash", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await user.click(screen.getByRole("button", { name: "commit before processing" }));
    await user.click(screen.getByRole("button", { name: "commit offset 3 →" }));
    await user.click(screen.getByRole("button", { name: "process one record →" }));
    await user.click(screen.getByRole("button", { name: "crash consumer →" }));
    await user.click(screen.getByRole("button", { name: "another consumer takes over →" }));

    expect(screen.getByText("2 records skipped")).toBeInTheDocument();
    expect(screen.getByText(/silently skipped \(at-most-once\)/)).toBeInTheDocument();
  });

  it("resets to the start of the batch", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await processAll(user);
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("processed-count")).toHaveTextContent("0 / 3");
    expect(screen.getByTestId("committed-offset")).toHaveTextContent("0");
  });
});
