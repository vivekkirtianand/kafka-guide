import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderEventFanoutDemo from "./OrderEventFanoutDemo";

const log = () => screen.getByTestId("wk-fanout-log");
const consumer = (name: string) => screen.getByTestId(`wk-fanout-${name}`);

describe("OrderEventFanoutDemo", () => {
  it("starts with nothing published", () => {
    render(<OrderEventFanoutDemo />);
    expect(log()).toHaveTextContent("checkout has not published anything yet.");
    expect(within(consumer("billing")).getByText("offset 0")).toBeInTheDocument();
  });

  it("publishes one event without calling anyone", async () => {
    const user = userEvent.setup();
    render(<OrderEventFanoutDemo />);

    await user.click(screen.getByRole("button", { name: /publish order-placed/i }));

    expect(log()).toHaveTextContent(/appends one order-placed event to topic "orders" — offset 0. It does not call anyone/i);
  });

  it("lets each consumer read the event independently and confirms the fan-out", async () => {
    const user = userEvent.setup();
    render(<OrderEventFanoutDemo />);

    await user.click(screen.getByRole("button", { name: /publish order-placed/i }));
    for (const name of ["billing", "email", "warehouse", "analytics"]) {
      await user.click(within(consumer(name)).getByRole("button", { name: "poll" }));
    }

    expect(within(consumer("billing")).getByText("offset 1")).toBeInTheDocument();
    expect(screen.getByTestId("wk-fanout-verdict")).toHaveTextContent(/every downstream reacted to the same event/i);
  });

  it("adds a new consumer that starts at offset 0 without changing checkout", async () => {
    const user = userEvent.setup();
    render(<OrderEventFanoutDemo />);

    await user.click(screen.getByRole("button", { name: /publish order-placed/i }));
    await user.click(screen.getByRole("button", { name: /add loyalty service/i }));

    expect(consumer("loyalty")).toBeInTheDocument();
    expect(within(consumer("loyalty")).getByText("offset 0")).toBeInTheDocument();
    expect(log()).toHaveTextContent(/starts at offset 0 and can read the whole history — checkout's code never changed/i);
  });

  it("resets", async () => {
    const user = userEvent.setup();
    render(<OrderEventFanoutDemo />);

    await user.click(screen.getByRole("button", { name: /publish order-placed/i }));
    await user.click(screen.getByRole("button", { name: /add loyalty service/i }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(log()).toHaveTextContent("checkout has not published anything yet.");
    expect(screen.queryByTestId("wk-fanout-loyalty")).not.toBeInTheDocument();
  });
});
