import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PoisonMessageDemo from "./PoisonMessageDemo";

function step(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: "poll + process next →" }));
}

describe("PoisonMessageDemo", () => {
  it("with no handling, the poison record blocks the partition forever", async () => {
    const user = userEvent.setup();
    render(<PoisonMessageDemo />);

    await step(user); // record 0
    await step(user); // record 1
    await step(user); // record 2 - poison
    await step(user); // record 2 again

    expect(screen.getByText("partition stuck on offset 2")).toBeInTheDocument();
    expect(screen.getByText(/record 2 threw \(attempt 2\)\. The error handler seeks back to offset 2/)).toBeInTheDocument();
    expect(screen.getByTestId("dlt")).toHaveTextContent("orders.DLT: (empty)");
  });

  it("the dead-letter strategy routes the poison record aside after bounded retries", async () => {
    const user = userEvent.setup();
    render(<PoisonMessageDemo />);

    await user.click(screen.getByRole("button", { name: "dead-letter topic" }));

    await step(user); // 0
    await step(user); // 1
    await step(user); // retry 1
    await step(user); // retry 2
    await step(user); // retry 3
    await step(user); // route to DLT

    expect(screen.getByTestId("dlt")).toHaveTextContent("orders.DLT: record 2");
    expect(screen.getByText(/exhausted 3 retries — produced to orders.DLT/)).toBeInTheDocument();

    await step(user); // 3
    await step(user); // 4
    await step(user); // 5
    await step(user); // end

    expect(screen.getByText("partition drained")).toBeInTheDocument();
  });

  it("the retry-topics strategy forwards the poison record to a delayed retry topic", async () => {
    const user = userEvent.setup();
    render(<PoisonMessageDemo />);

    await user.click(screen.getByRole("button", { name: "retry topics" }));

    await step(user); // 0
    await step(user); // 1
    await step(user); // retry 1
    await step(user); // retry 2
    await step(user); // retry 3
    await step(user); // forward to retry topic

    expect(screen.getByTestId("retry-topic")).toHaveTextContent("orders.retry.5s: record 2");
    expect(screen.getByText(/forwarded to orders.retry.5s/)).toBeInTheDocument();
    expect(screen.getByTestId("dlt")).toHaveTextContent("(empty)");
  });

  it("resets the run when the strategy changes", async () => {
    const user = userEvent.setup();
    render(<PoisonMessageDemo />);

    await user.click(screen.getByRole("button", { name: "dead-letter topic" }));
    await step(user);
    await user.click(screen.getByRole("button", { name: "no handling" }));

    expect(screen.getByTestId("main-partition")).toBeInTheDocument();
    expect(screen.getByText("consumer subscribed to orders-0. Nothing processed yet.")).toBeInTheDocument();
  });
});
