import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottleneckDiagnosis from "./BottleneckDiagnosis";

const dashboard = (n: number) => screen.getByRole("button", { name: `dashboard ${n}` });
const cause = (name: string | RegExp) => screen.getByRole("button", { name });
const feedback = () => screen.getByTestId("bd-feedback").textContent ?? "";

describe("BottleneckDiagnosis", () => {
  it("starts on dashboard 1 with no feedback until a cause is picked", () => {
    render(<BottleneckDiagnosis />);
    expect(screen.queryByTestId("bd-feedback")).not.toBeInTheDocument();
    expect(screen.getByTestId("bd-brief")).toHaveTextContent(/breached its SLA on one broker/);
  });

  it("dashboard 1 is the disk: award and LocalTimeMs move together", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(cause("Broker disk"));
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(feedback()).toMatch(/Disk await \(45 ms\) and LocalTimeMs \(95 ms\) rose together/);
  });

  it("a wrong pick explains that cause's real signature and still gives the answer", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(cause("Producer application"));
    expect(screen.getByText("not the bottleneck")).toBeInTheDocument();
    expect(feedback()).toMatch(/A producer application bottleneck would show throughput well under target/);
    expect(feedback()).toMatch(/the producer's own send buffer near-empty/);
    expect(feedback()).toMatch(/answer: Broker disk/);
  });

  it("locks the choices after the first pick", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(cause("Network"));
    expect(cause("Broker disk")).toBeDisabled();
  });

  it("dashboard 5 (consumer) and dashboard 6 (downstream) are told apart by the sink-call panel", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);

    await user.click(dashboard(5));
    const panels5 = within(screen.getByTestId("bd-panels"));
    expect(panels5.getByText("25 ms")).toBeInTheDocument(); // downstream healthy
    await user.click(cause("Consumer application"));
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(feedback()).toMatch(/crossed max\.poll\.interval\.ms/);

    await user.click(dashboard(6));
    expect(screen.queryByTestId("bd-feedback")).not.toBeInTheDocument(); // pick reset on switch
    const panels6 = within(screen.getByTestId("bd-panels"));
    expect(panels6.getByText("220 ms (baseline 20 ms)")).toBeInTheDocument();
    await user.click(cause("Downstream processing"));
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(feedback()).toMatch(/The consumers really are fine; their downstream dependency/);
  });

  it("dashboard 3 (broker threads) is not the disk: queue deep, handlers idle 3%, disk clean", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(dashboard(3));
    await user.click(cause("Broker (CPU / threads)"));
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(feedback()).toMatch(/request queue is 28 deep and request-handler threads are 3% idle/);
  });

  it("dashboard 4 (producer) has an idle broker and a near-empty send buffer — the app isn't feeding send()", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(dashboard(4));
    await user.click(cause("Producer application"));
    expect(screen.getByText("correct")).toBeInTheDocument();
    expect(feedback()).toMatch(/broker acks in 14 ms and sits 82% idle/);
    expect(feedback()).toMatch(/the producer's own send buffer sits 89% free/);
    expect(feedback()).toMatch(/A near-full buffer would point the other way/);
  });

  it("reset returns to dashboard 1", async () => {
    const user = userEvent.setup();
    render(<BottleneckDiagnosis />);
    await user.click(dashboard(4));
    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByTestId("bd-brief")).toHaveTextContent(/breached its SLA on one broker/);
    expect(dashboard(1)).toHaveClass("border-accent/50");
  });
});
