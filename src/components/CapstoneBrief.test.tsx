import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CapstoneBrief from "./CapstoneBrief";
import { ProgressProvider, __resetProgressCacheForTests } from "@/lib/context/ProgressContext";
import { Capstone } from "@/lib/types";

const capstone: Capstone = {
  brief: "You have been handed the backbone for **Larkspur**.\n\nBuild it yourself.",
  stack: "The Lab B three-broker cluster.",
  requirements: [
    { id: "topics", title: "Design the topics", detail: "Create them with RF 3.", buildsOn: ["mental-model"] },
    { id: "schema", title: "Add a schema", detail: "Register it BACKWARD.", buildsOn: ["schemas-and-data-contracts"] },
  ],
  rubric: [
    {
      name: "Correctness",
      focus: "Right data.",
      levels: [
        { label: "Meets", descriptor: "Totals match a hand computation." },
        { label: "Partial", descriptor: "Close but not reconciled." },
        { label: "Missing", descriptor: "Totals disagree." },
      ],
    },
  ],
  submission: ["A branch with the code.", "A write-up.", "Your rubric scores."],
};

const renderBrief = () =>
  render(
    <ProgressProvider>
      <CapstoneBrief capstone={capstone} slug="capstone-project" />
    </ProgressProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  __resetProgressCacheForTests();
});

describe("CapstoneBrief", () => {
  it("renders the brief, the spec, the rubric, and the submission list", () => {
    renderBrief();
    expect(screen.getByText("Larkspur")).toBeInTheDocument();
    expect(screen.getByTestId("capstone-spec").children).toHaveLength(2);
    expect(screen.getByText("Design the topics")).toBeInTheDocument();
    expect(screen.getByText(/Right data\./)).toBeInTheDocument();
    expect(screen.getByText("A write-up.")).toBeInTheDocument();
  });

  it("tracks and persists spec progress", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBrief();

    expect(screen.getByRole("progressbar")).toHaveTextContent("0 / 2 done");
    await user.click(screen.getByLabelText("Mark done: Design the topics"));
    expect(screen.getByRole("progressbar")).toHaveTextContent("1 / 2 done");

    unmount();
    __resetProgressCacheForTests();
    renderBrief();
    expect(screen.getByLabelText("Mark done: Design the topics")).toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveTextContent("1 / 2 done");
  });
});
