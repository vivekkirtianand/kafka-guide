import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommitCrashDemo from "./CommitCrashDemo";

const processBtn = () => screen.getByRole("button", { name: "process one record →" });
const commitBtn = () => screen.getByRole("button", { name: "commit offset 3 →" });
const crashBtn = () => screen.getByRole("button", { name: "crash consumer →" });

async function processAll(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 3; i++) await user.click(processBtn());
}

describe("CommitCrashDemo", () => {
  it("enforces the commit-after-processing policy through the buttons", async () => {
    render(<CommitCrashDemo />);
    // can't commit before all records are processed
    expect(commitBtn()).toBeDisabled();

    const user = userEvent.setup();
    await processAll(user);
    expect(commitBtn()).not.toBeDisabled();
  });

  it("enforces the commit-before-processing policy through the buttons", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await user.click(screen.getByRole("button", { name: "commit before processing" }));
    // can't process before committing
    expect(processBtn()).toBeDisabled();

    await user.click(commitBtn());
    expect(processBtn()).not.toBeDisabled();
  });

  it("committing after processing, then a clean crash, redelivers nothing", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await processAll(user);
    await user.click(commitBtn());
    await user.click(crashBtn());
    await user.click(screen.getByRole("button", { name: "another consumer takes over →" }));

    expect(screen.getByText("clean handoff")).toBeInTheDocument();
    expect(screen.getByText(/nothing to redeliver, clean handoff/)).toBeInTheDocument();
  });

  it("a partial crash redelivers the whole batch but only counts finished records as duplicates", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await user.click(processBtn()); // process only record 0
    await user.click(crashBtn());
    await user.click(screen.getByRole("button", { name: "another consumer takes over →" }));

    expect(screen.getByTestId("committed-offset")).toHaveTextContent("0");
    expect(screen.getByText("3 redelivered · 1 duplicate")).toBeInTheDocument();
    expect(
      screen.getByText(/Records 0–2 are redelivered — 1 already processed by the crashed consumer \(duplicate\), 2 never processed before/),
    ).toBeInTheDocument();
  });

  it("committing before processing skips records on a crash", async () => {
    const user = userEvent.setup();
    render(<CommitCrashDemo />);

    await user.click(screen.getByRole("button", { name: "commit before processing" }));
    await user.click(commitBtn());
    await user.click(processBtn()); // process only record 0
    await user.click(crashBtn());
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
