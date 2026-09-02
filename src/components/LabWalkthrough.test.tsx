import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabWalkthrough from "./LabWalkthrough";
import { ProgressProvider, __resetProgressCacheForTests } from "@/lib/context/ProgressContext";
import { Lab } from "@/lib/types";

const lab: Lab = {
  slug: "test-lab",
  title: "Test lab",
  summary: "A tiny lab.",
  prerequisites: ["Docker running"],
  setup: [{ command: "docker run kafka", note: "starts the broker" }],
  steps: [
    {
      id: "one",
      title: "First step",
      intro: "Do the first thing.",
      command: "echo one",
      expected: "one",
      observe: "Did you see one?",
      commonError: { symptom: "nothing", cause: "typo", recovery: "retry" },
    },
    {
      id: "two",
      title: "Second step",
      intro: "Do the second thing.",
      command: "echo two",
      expected: "two",
      observe: "Did you see two?",
    },
  ],
  teardown: [{ command: "docker rm -f kafka", note: "removes it" }],
  teardownWarning: "This deletes your data.",
};

const richLab: Lab = {
  ...lab,
  slug: "rich-lab",
  platformNotes: [
    { platform: "macOS", note: "raise the memory limit" },
    { platform: "Linux", note: "join the docker group" },
  ],
  resourceFloor: "at least 4 GB of memory",
  verify: { command: "./verify-lab.sh", note: "checks every port" },
  troubleshooting: [{ symptom: "containers restart", cause: "low memory", fix: "raise it" }],
};

const renderLab = (props: { defaultCollapsed?: boolean } = {}) =>
  render(
    <ProgressProvider>
      <LabWalkthrough lab={lab} {...props} />
    </ProgressProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  __resetProgressCacheForTests();
});

describe("LabWalkthrough", () => {
  it("renders prerequisites, setup, every step, and the teardown warning", () => {
    renderLab();
    expect(screen.getByText("Docker running")).toBeInTheDocument();
    expect(screen.getByText("starts the broker")).toBeInTheDocument();
    expect(screen.getAllByTestId("lab-step")).toHaveLength(2);
    expect(screen.getByText("First step")).toBeInTheDocument();
    expect(screen.getByText("Did you see one?")).toBeInTheDocument();
    expect(screen.getByTestId("lab-teardown-warning")).toHaveTextContent("This deletes your data.");
  });

  it("shows a common-error disclosure only where the step defines one", () => {
    renderLab();
    const [first, second] = screen.getAllByTestId("lab-step");
    expect(within(first).getByText("Something went wrong?")).toBeInTheDocument();
    expect(within(first).getByText("typo")).toBeInTheDocument();
    expect(within(second).queryByText("Something went wrong?")).not.toBeInTheDocument();
  });

  it("counts checked steps and persists them across a remount", async () => {
    const user = userEvent.setup();
    const { unmount } = renderLab();

    expect(screen.getByTestId("lab-progress")).toHaveTextContent("0 / 2 steps done");
    await user.click(screen.getByLabelText("Mark done: First step"));
    expect(screen.getByTestId("lab-progress")).toHaveTextContent("1 / 2 steps done");

    unmount();
    __resetProgressCacheForTests();
    renderLab();
    expect(screen.getByLabelText("Mark done: First step")).toBeChecked();
    expect(screen.getByTestId("lab-progress")).toHaveTextContent("1 / 2 steps done");
  });

  it("does not claim to have copied when the Clipboard API is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    try {
      renderLab();
      const copyButton = screen.getAllByRole("button", { name: "copy" })[0];
      fireEvent.click(copyButton);
      expect(copyButton).toHaveTextContent("copy");
      expect(copyButton).not.toHaveTextContent("copied");
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
    }
  });

  it("marks the lab complete once every step is checked", async () => {
    const user = userEvent.setup();
    renderLab();
    await user.click(screen.getByLabelText("Mark done: First step"));
    await user.click(screen.getByLabelText("Mark done: Second step"));
    expect(screen.getByTestId("lab-progress")).toHaveTextContent("lab complete");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });

  it("renders the OS matrix, resource floor, verify command, and troubleshooting when present", () => {
    render(
      <ProgressProvider>
        <LabWalkthrough lab={richLab} />
      </ProgressProvider>,
    );
    expect(screen.getByText("Setup by platform")).toBeInTheDocument();
    expect(screen.getByText("raise the memory limit")).toBeInTheDocument();
    expect(screen.getByText(/Resource floor/i)).toBeInTheDocument();
    expect(screen.getByText("at least 4 GB of memory")).toBeInTheDocument();
    expect(screen.getByText("./verify-lab.sh")).toBeInTheDocument();
    expect(screen.getByText("Troubleshooting")).toBeInTheDocument();
    expect(screen.getByText("containers restart")).toBeInTheDocument();
  });

  it("renders collapsed: a summary with step count, steps hidden until opened", () => {
    render(
      <ProgressProvider>
        <div>
          <LabWalkthrough lab={richLab} defaultCollapsed />
        </div>
      </ProgressProvider>,
    );
    const details = screen.getByTestId("lab-walkthrough").querySelector("details")!;
    expect(details.open).toBe(false);
    // the summary carries the title + step count
    expect(screen.getByText("· 2 steps")).toBeInTheDocument();
    // content is in the DOM (so progress still persists) but the <details> is closed
    expect(screen.getByTestId("lab-progress")).toBeInTheDocument();

    fireEvent.click(screen.getByText(richLab.title));
    expect(details.open).toBe(true);
  });
});
