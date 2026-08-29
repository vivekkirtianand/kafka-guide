import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuotaThrottleDemo from "./QuotaThrottleDemo";

const effective = () => screen.getByTestId("effective").textContent ?? "";
const throttleMs = () => Number((screen.getByTestId("throttle").textContent ?? "").replace(/\D/g, ""));

describe("QuotaThrottleDemo", () => {
  it("under the byte-rate quota there is no throttling and no added latency", () => {
    render(<QuotaThrottleDemo />);
    expect(effective()).toBe("4 MB/s");
    expect(throttleMs()).toBe(0);
    expect(screen.getByText("under quota")).toBeInTheDocument();
  });

  it("over the byte-rate quota caps throughput and adds latency, never errors", () => {
    render(<QuotaThrottleDemo />);

    fireEvent.change(screen.getByLabelText("client produce rate"), { target: { value: "12" } });

    expect(effective()).toBe("6 MB/s");
    expect(throttleMs()).toBeGreaterThan(0);
    expect(screen.getByText("throttled")).toBeInTheDocument();
    expect(screen.getByText("none")).toBeInTheDocument(); // errors row
    expect(screen.getByText(/produce-throttle-time-avg/)).toBeInTheDocument();
  });

  it("the request-percentage scenario throttles handler-time-heavy clients the same way", async () => {
    const user = userEvent.setup();
    render(<QuotaThrottleDemo />);

    await user.click(screen.getByRole("button", { name: "request_percentage" }));
    expect(effective()).toBe("100%"); // default, under the 150% quota
    expect(screen.getByText("under quota")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("request-handler time demanded"), { target: { value: "300" } });
    expect(effective()).toBe("150%");
    expect(throttleMs()).toBeGreaterThan(0);
    expect(screen.getByText("throttled")).toBeInTheDocument();
    expect(screen.getByText(/metadata storm behind a request quota looks like latency, not errors/)).toBeInTheDocument();
  });

  it("resets back to the bandwidth scenario at 4 MB/s", async () => {
    const user = userEvent.setup();
    render(<QuotaThrottleDemo />);

    fireEvent.change(screen.getByLabelText("client produce rate"), { target: { value: "18" } });
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(effective()).toBe("4 MB/s");
    expect(throttleMs()).toBe(0);
  });
});
