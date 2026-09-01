import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TechnologyChoiceDemo from "./TechnologyChoiceDemo";

describe("TechnologyChoiceDemo", () => {
  it("shows the first scenario and no verdict yet", () => {
    render(<TechnologyChoiceDemo />);
    expect(screen.getByText(/scenario 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByTestId("wk-tech-prompt")).toHaveTextContent(/billing, email, the warehouse, and analytics/i);
    expect(screen.queryByTestId("wk-tech-verdict")).not.toBeInTheDocument();
  });

  it("confirms a correct pick with the rationale", async () => {
    const user = userEvent.setup();
    render(<TechnologyChoiceDemo />);

    await user.click(screen.getByRole("button", { name: "Kafka" }));

    const verdict = screen.getByTestId("wk-tech-verdict");
    expect(within(verdict).getByText("good call")).toBeInTheDocument();
    expect(within(verdict).getByText(/retained log with multiple readers/i)).toBeInTheDocument();
  });

  it("marks a wrong pick and still names the right answer", async () => {
    const user = userEvent.setup();
    render(<TechnologyChoiceDemo />);

    await user.click(screen.getByRole("button", { name: "Object storage" }));

    const verdict = screen.getByTestId("wk-tech-verdict");
    expect(within(verdict).getByText("not the best fit")).toBeInTheDocument();
    expect(within(verdict).getByText(/^Kafka\./)).toBeInTheDocument();
  });

  it("tallies a score once every scenario is answered", async () => {
    const user = userEvent.setup();
    render(<TechnologyChoiceDemo />);

    const answers = [
      "Kafka",
      "Relational database",
      "Object storage",
      "Message queue",
      "Direct API call",
    ];
    for (let i = 0; i < answers.length; i++) {
      await user.click(screen.getByRole("button", { name: answers[i] }));
      await user.click(screen.getByRole("button", { name: i === answers.length - 1 ? /see summary/i : /next scenario/i }));
    }

    expect(screen.getByTestId("wk-tech-summary")).toHaveTextContent("5 / 5 correct");
  });

  it("resets back to the first scenario", async () => {
    const user = userEvent.setup();
    render(<TechnologyChoiceDemo />);

    await user.click(screen.getByRole("button", { name: "Kafka" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText(/scenario 1 of 5/i)).toBeInTheDocument();
    expect(screen.queryByTestId("wk-tech-verdict")).not.toBeInTheDocument();
  });
});
