import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IncidentDiagnosis from "./IncidentDiagnosis";
import { getIncident } from "@/lib/data/incidents";

const inv = getIncident("poison-message")!.investigation!;

describe("IncidentDiagnosis", () => {
  it("hides clue evidence until the operator checks it", async () => {
    const user = userEvent.setup();
    render(<IncidentDiagnosis clues={inv.clues} options={inv.options} />);

    expect(screen.queryByText(/DeserializationException on orders-7/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /check consumer error logs/ }));
    expect(screen.getByText(/DeserializationException on orders-7/)).toBeInTheDocument();
  });

  it("marks the correct diagnosis and reports how many clues were checked first", async () => {
    const user = userEvent.setup();
    render(<IncidentDiagnosis clues={inv.clues} options={inv.options} />);

    await user.click(screen.getByRole("button", { name: /check offset commit history/ }));
    const correct = inv.options.find((o) => o.correct)!;
    await user.click(screen.getByRole("button", { name: correct.label }));

    expect(screen.getByText("correct diagnosis")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 clues checked before deciding")).toBeInTheDocument();
    expect(screen.getByText(correct.feedback)).toBeInTheDocument();
  });

  it("marks a wrong diagnosis and shows that cause's real signature", async () => {
    const user = userEvent.setup();
    render(<IncidentDiagnosis clues={inv.clues} options={inv.options} />);

    const wrong = inv.options.find((o) => !o.correct)!;
    await user.click(screen.getByRole("button", { name: wrong.label }));

    expect(screen.getByText("not quite")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 clues checked before deciding")).toBeInTheDocument();
  });

  it("locks the options after a pick and resets", async () => {
    const user = userEvent.setup();
    render(<IncidentDiagnosis clues={inv.clues} options={inv.options} />);

    await user.click(screen.getByRole("button", { name: inv.options[0].label }));
    expect(screen.getByRole("button", { name: inv.options[1].label })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(screen.getByRole("button", { name: inv.options[1].label })).not.toBeDisabled();
    expect(screen.queryByText("correct diagnosis")).not.toBeInTheDocument();
  });
});
