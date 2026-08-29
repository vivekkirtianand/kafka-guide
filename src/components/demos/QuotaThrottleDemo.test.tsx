import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuotaThrottleDemo from "./QuotaThrottleDemo";

const effective = () => screen.getByTestId("effective").textContent ?? "";
const throttleMs = () => Number((screen.getByTestId("throttle").textContent ?? "").replace(/\D/g, ""));
const brokerResponse = () => screen.getByTestId("broker-response").textContent ?? "";

describe("QuotaThrottleDemo", () => {
  it("under quota there is no latency and the broker response is immediate", () => {
    render(<QuotaThrottleDemo />);
    expect(effective()).toBe("4 MB/s");
    expect(throttleMs()).toBe(0);
    expect(screen.getByText("under quota")).toBeInTheDocument();
    expect(brokerResponse()).toBe("immediate");
  });

  it("over quota caps throughput, adds latency, and delays rather than rejects", () => {
    render(<QuotaThrottleDemo />);
    fireEvent.change(screen.getByLabelText("client produce rate"), { target: { value: "9" } });

    expect(effective()).toBe("6 MB/s");
    expect(throttleMs()).toBeGreaterThan(0);
    expect(screen.getByText("throttled")).toBeInTheDocument();
    expect(brokerResponse()).toBe("delayed, never rejected");
    expect(screen.getByText(/produce-throttle-time-avg/)).toBeInTheDocument();
  });

  it("the timeout warning tracks the configured request.timeout.ms, not a fixed threshold", () => {
    render(<QuotaThrottleDemo />);

    // 8 MB/s over a 6 MB/s quota -> ~333 ms throttle
    fireEvent.change(screen.getByLabelText("client produce rate"), { target: { value: "8" } });
    expect(throttleMs()).toBeGreaterThan(0);
    expect(screen.queryByTestId("timeout-note")).not.toBeInTheDocument();

    // drop request.timeout.ms below the throttle delay -> the warning appears
    fireEvent.change(screen.getByLabelText("client request.timeout.ms"), { target: { value: "300" } });
    expect(screen.getByTestId("timeout-note")).toHaveTextContent(/exceeds this client's request\.timeout\.ms \(300 ms\)/);

    // raise it back above the delay -> gone again
    fireEvent.change(screen.getByLabelText("client request.timeout.ms"), { target: { value: "1500" } });
    expect(screen.queryByTestId("timeout-note")).not.toBeInTheDocument();
  });

  it("the request quota is combined network + I/O thread time, throttled the same way", async () => {
    const user = userEvent.setup();
    render(<QuotaThrottleDemo />);

    await user.click(screen.getByRole("button", { name: "request_percentage" }));
    expect(screen.getByText(/network \+ I\/O thread time demanded/)).toBeInTheDocument();
    expect(effective()).toBe("100%");
    expect(brokerResponse()).toBe("immediate");

    fireEvent.change(screen.getByLabelText("network and I/O thread time demanded"), { target: { value: "300" } });
    expect(effective()).toBe("150%");
    expect(throttleMs()).toBeGreaterThan(0);
    expect(screen.getByText(/metadata storm behind a request quota looks like latency, not errors/)).toBeInTheDocument();
  });

  it("resets to the bandwidth scenario at 4 MB/s", async () => {
    const user = userEvent.setup();
    render(<QuotaThrottleDemo />);
    fireEvent.change(screen.getByLabelText("client produce rate"), { target: { value: "18" } });
    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(effective()).toBe("4 MB/s");
    expect(throttleMs()).toBe(0);
    expect(brokerResponse()).toBe("immediate");
  });
});
