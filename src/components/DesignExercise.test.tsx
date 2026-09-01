import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesignExercise from "./DesignExercise";
import { Exercise } from "@/lib/types";

const exercises: Exercise[] = [
  {
    prompt: "Decide whether system X should use Kafka.",
    successCriteria: ["give a clear recommendation", "name the deciding factor", "acknowledge the cost"],
  },
];

describe("DesignExercise", () => {
  it("renders the prompt and every success criterion", () => {
    render(<DesignExercise exercises={exercises} />);
    expect(screen.getByText("Decide whether system X should use Kafka.")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByTestId("de-progress")).toHaveTextContent("0 / 3 self-checked");
  });

  it("counts the criteria the learner ticks", async () => {
    const user = userEvent.setup();
    render(<DesignExercise exercises={exercises} />);

    await user.click(screen.getByLabelText("give a clear recommendation"));
    await user.click(screen.getByLabelText("acknowledge the cost"));

    expect(screen.getByTestId("de-progress")).toHaveTextContent("2 / 3 self-checked");
  });

  it("resets the checklist", async () => {
    const user = userEvent.setup();
    render(<DesignExercise exercises={exercises} />);

    await user.click(screen.getByLabelText("name the deciding factor"));
    await user.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByTestId("de-progress")).toHaveTextContent("0 / 3 self-checked");
  });

  it("starts fresh when remounted for a different module (keyed by slug)", async () => {
    const user = userEvent.setup();
    const other: Exercise[] = [{ prompt: "Other prompt", successCriteria: ["only one"] }];
    const { rerender } = render(
      <div>
        <DesignExercise key="mod-a" exercises={exercises} />
      </div>,
    );
    await user.click(screen.getByLabelText("give a clear recommendation"));
    expect(screen.getByTestId("de-progress")).toHaveTextContent("1 / 3 self-checked");

    rerender(
      <div>
        <DesignExercise key="mod-b" exercises={other} />
      </div>,
    );

    expect(screen.getByText("Other prompt")).toBeInTheDocument();
    expect(screen.getByTestId("de-progress")).toHaveTextContent("0 / 1 self-checked");
  });
});
