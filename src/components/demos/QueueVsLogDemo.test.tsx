import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueueVsLogDemo from "./QueueVsLogDemo";

const queue = () => screen.getByTestId("wk-queuelog-queue");
const log = () => screen.getByTestId("wk-queuelog-log");
const feed = () => screen.getByTestId("wk-queuelog-logfeed");

async function produce(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 0; i < n; i++) await user.click(screen.getByRole("button", { name: /produce event/i }));
}

describe("QueueVsLogDemo", () => {
  it("appends a produced event to both sides", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);

    expect(within(queue()).getByText("e0")).toBeInTheDocument();
    expect(within(queue()).getByText("e1")).toBeInTheDocument();
    expect(within(log()).getByText("e0")).toBeInTheDocument();
  });

  it("removes a message from the queue once a worker consumes it", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);
    await user.click(within(queue()).getByRole("button", { name: /consume next/i }));

    expect(within(queue()).queryByText("e0")).not.toBeInTheDocument();
    expect(within(queue()).getByText("1 consumed & gone")).toBeInTheDocument();
    expect(feed()).toHaveTextContent(/delivered once and removed — no one else will see it/i);
  });

  it("advances a consumer group's offset while the event stays on the log", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);
    await user.click(screen.getByRole("button", { name: "group A: read next" }));

    expect(screen.getByTestId("wk-queuelog-groupA")).toHaveTextContent("group A offset: 1");
    expect(within(log()).getByText("e0")).toBeInTheDocument();
  });

  it("gives a second group its own offset from 0", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);
    await user.click(screen.getByRole("button", { name: "group A: read next" }));
    await user.click(screen.getByRole("button", { name: /add group B/i }));

    expect(screen.getByTestId("wk-queuelog-groupB")).toHaveTextContent("group B offset: 0");

    await user.click(screen.getByRole("button", { name: "group B: read next" }));
    expect(screen.getByTestId("wk-queuelog-groupB")).toHaveTextContent("group B offset: 1");
  });

  it("replays group A by resetting its offset to 0", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);
    await user.click(screen.getByRole("button", { name: "group A: read next" }));
    await user.click(screen.getByRole("button", { name: "group A: read next" }));
    await user.click(screen.getByRole("button", { name: "group A: reset to 0" }));

    expect(screen.getByTestId("wk-queuelog-groupA")).toHaveTextContent("group A offset: 0");
    expect(feed()).toHaveTextContent(/replay costs nothing/i);
  });

  it("resets", async () => {
    const user = userEvent.setup();
    render(<QueueVsLogDemo />);

    await produce(user, 2);
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(within(queue()).getByText("(empty)")).toBeInTheDocument();
    expect(screen.getByTestId("wk-queuelog-groupB")).toHaveTextContent("not subscribed");
  });
});
