import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KnowledgeCheck from "./KnowledgeCheck";
import { KnowledgeCheck as Check } from "@/lib/types";

const checks: Check[] = [
  {
    question: "First question?",
    options: ["wrong one", "right one"],
    answerIndex: 1,
    explanation: "because reasons",
  },
  {
    question: "Second question?",
    options: ["correct", "incorrect"],
    answerIndex: 0,
    explanation: "second explanation",
  },
];

describe("KnowledgeCheck", () => {
  it("shows the first question and its progress", () => {
    render(<KnowledgeCheck checks={checks} />);
    expect(screen.getByText("question 1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("kc-question")).toHaveTextContent("First question?");
    expect(screen.queryByTestId("kc-verdict")).not.toBeInTheDocument();
  });

  it("reveals the explanation and locks the options after a pick", async () => {
    const user = userEvent.setup();
    render(<KnowledgeCheck checks={checks} />);

    await user.click(screen.getByRole("button", { name: "right one" }));

    const verdict = screen.getByTestId("kc-verdict");
    expect(within(verdict).getByText("correct")).toBeInTheDocument();
    expect(within(verdict).getByText("because reasons")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "wrong one" })).toBeDisabled();
  });

  it("marks a wrong pick, names the correct option in text, and exposes the verdict as a status", async () => {
    const user = userEvent.setup();
    render(<KnowledgeCheck checks={checks} />);

    await user.click(screen.getByRole("button", { name: "wrong one" }));

    const verdict = screen.getByTestId("kc-verdict");
    expect(verdict).toHaveAttribute("role", "status");
    expect(within(verdict).getByText("not quite")).toBeInTheDocument();
    expect(within(verdict).getByText(/The correct answer:/)).toHaveTextContent("right one");
    // the right/picked options carry a text marker, not just colour
    expect(screen.getByRole("button", { name: /right one\s*·\s*✓ correct answer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wrong one\s*·\s*✗ your answer/ })).toBeInTheDocument();
  });

  it("starts fresh when it is remounted for a different module (keyed by slug)", async () => {
    const user = userEvent.setup();
    const other: Check[] = [
      { question: "Other module question?", options: ["a", "b"], answerIndex: 0, explanation: "x" },
    ];
    const { rerender } = render(
      <div>
        <KnowledgeCheck key="mod-a" checks={checks} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "right one" }));
    expect(screen.getByTestId("kc-verdict")).toBeInTheDocument();

    rerender(
      <div>
        <KnowledgeCheck key="mod-b" checks={other} />
      </div>,
    );

    expect(screen.getByTestId("kc-question")).toHaveTextContent("Other module question?");
    expect(screen.queryByTestId("kc-verdict")).not.toBeInTheDocument();
  });

  it("tallies a score after the last question", async () => {
    const user = userEvent.setup();
    render(<KnowledgeCheck checks={checks} />);

    await user.click(screen.getByRole("button", { name: "right one" }));
    await user.click(screen.getByRole("button", { name: /next question/i }));
    await user.click(screen.getByRole("button", { name: "incorrect" }));
    await user.click(screen.getByRole("button", { name: /see score/i }));

    expect(screen.getByTestId("kc-summary")).toHaveTextContent("1 / 2 correct");
  });

  it("resets to the first question", async () => {
    const user = userEvent.setup();
    render(<KnowledgeCheck checks={checks} />);

    await user.click(screen.getByRole("button", { name: "right one" }));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByText("question 1 of 2")).toBeInTheDocument();
    expect(screen.queryByTestId("kc-verdict")).not.toBeInTheDocument();
  });
});
