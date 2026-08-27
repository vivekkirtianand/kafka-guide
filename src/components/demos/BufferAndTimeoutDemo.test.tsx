import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BufferAndTimeoutDemo from "./BufferAndTimeoutDemo";

describe("BufferAndTimeoutDemo", () => {
  it("fills the buffer, then blocks send() once full", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    const produce = screen.getByRole("button", { name: "produce record →" });
    for (let i = 0; i < 5; i++) await user.click(produce);

    expect(screen.getByText("record buffered (5/5).")).toBeInTheDocument();
    expect(screen.queryByText(/send\(\) blocked/)).not.toBeInTheDocument();

    await user.click(produce);

    expect(screen.getByText("send() blocked — waiting for buffer space")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wait past max.block.ms/i })).toBeInTheDocument();
  });

  it("draining while blocked immediately completes the blocked send", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    const produce = screen.getByRole("button", { name: "produce record →" });
    for (let i = 0; i < 6; i++) await user.click(produce);

    await user.click(screen.getByRole("button", { name: /broker acks a batch/i }));

    expect(screen.getByText(/the blocked send\(\) completed immediately/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wait past max.block.ms/i })).not.toBeInTheDocument();
  });

  it("exceeding max.block.ms while blocked throws a TimeoutException", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    const produce = screen.getByRole("button", { name: "produce record →" });
    for (let i = 0; i < 6; i++) await user.click(produce);

    await user.click(screen.getByRole("button", { name: /wait past max.block.ms/i }));

    expect(screen.getByText("TimeoutException")).toBeInTheDocument();
    expect(screen.getByText(/The record was never sent\./)).toBeInTheDocument();
  });

  it("rejects an oversized record synchronously, independent of the buffer", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    await user.click(screen.getByRole("button", { name: "oversized record" }));

    await user.click(screen.getByRole("button", { name: /send normal record/i }));
    expect(screen.getByText("accepted")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /send oversized record/i }));
    expect(screen.getByText("RecordTooLargeException")).toBeInTheDocument();
    expect(screen.getByText(/rejected immediately by send\(\)/)).toBeInTheDocument();
  });

  it("exhausts delivery.timeout.ms after enough retry attempts", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    await user.click(screen.getByRole("button", { name: "delivery timeout" }));
    const retry = screen.getByRole("button", { name: /retry attempt/i });

    await user.click(retry);
    await user.click(retry);
    await user.click(retry);
    expect(screen.queryByText("TimeoutException")).not.toBeInTheDocument();

    await user.click(retry);
    expect(screen.getByText("TimeoutException")).toBeInTheDocument();
    expect(screen.getByText(/exceeded after 4 attempts/)).toBeInTheDocument();
  });

  it("delivers successfully if the broker recovers before delivery.timeout.ms elapses", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    await user.click(screen.getByRole("button", { name: "delivery timeout" }));
    await user.click(screen.getByRole("button", { name: /retry attempt/i }));
    await user.click(screen.getByRole("button", { name: /broker recovers/i }));

    expect(screen.getByText("delivered")).toBeInTheDocument();
    expect(screen.getByText(/delivered successfully after 1 attempt\(s\)/)).toBeInTheDocument();
  });

  it("resets every scenario", async () => {
    const user = userEvent.setup();
    render(<BufferAndTimeoutDemo />);

    const produce = screen.getByRole("button", { name: "produce record →" });
    await user.click(produce);
    await user.click(produce);

    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText("buffer empty (0/5).")).toBeInTheDocument();
    expect(produce).not.toBeDisabled();
  });
});
