import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CodeWalkthrough from "./CodeWalkthrough";
import { ProgressProvider, __resetProgressCacheForTests } from "@/lib/context/ProgressContext";
import { Walkthrough } from "@/lib/types";

const walkthrough: Walkthrough = {
  slug: "test-walkthrough",
  title: "Test walkthrough",
  summary: "A tiny walkthrough.",
  repoPath: "examples/test-project",
  cloneNote: "Open examples/test-project/ in your editor.",
  lessons: [
    {
      id: "one",
      section: "Build it",
      title: "First lesson",
      intro: "Look at the config.",
      file: "src/Config.java",
      code: "props.put(ACKS_CONFIG, \"all\");",
      points: [
        { term: "acks", detail: "wait for the replicas" },
        { term: "bootstrap", detail: "a seed list" },
      ],
      run: "./gradlew build",
    },
    {
      id: "two",
      section: "Break it",
      title: "Second lesson",
      intro: "Look at the loop.",
      file: "src/Loop.java",
      code: "consumer.poll(timeout);",
      points: [{ term: "poll", detail: "returns a batch" }],
      watchOut: "do not stop polling",
    },
  ],
};

const renderWalkthrough = () =>
  render(
    <ProgressProvider>
      <CodeWalkthrough walkthrough={walkthrough} />
    </ProgressProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  __resetProgressCacheForTests();
});

describe("CodeWalkthrough", () => {
  it("renders every lesson with its file label, snippet, and points", () => {
    renderWalkthrough();
    expect(screen.getAllByTestId("walkthrough-lesson")).toHaveLength(2);
    expect(screen.getByText("First lesson")).toBeInTheDocument();
    expect(screen.getByText("src/Config.java")).toBeInTheDocument();
    expect(screen.getByText('props.put(ACKS_CONFIG, "all");')).toBeInTheDocument();
    expect(screen.getByText("wait for the replicas")).toBeInTheDocument();
    expect(screen.getByText("Open examples/test-project/ in your editor.")).toBeInTheDocument();
  });

  it("renders a section heading before each lesson that opens one", () => {
    renderWalkthrough();
    const sections = screen.getAllByTestId("walkthrough-section").map((el) => el.textContent);
    expect(sections).toEqual(["Build it", "Break it"]);
  });

  it("shows the 'Try it' command only where the lesson defines one", () => {
    renderWalkthrough();
    const [first, second] = screen.getAllByTestId("walkthrough-lesson");
    expect(within(first).getByText("Try it")).toBeInTheDocument();
    expect(within(first).getByText("./gradlew build")).toBeInTheDocument();
    expect(within(second).queryByText("Try it")).not.toBeInTheDocument();
    expect(within(second).getByText("do not stop polling")).toBeInTheDocument();
  });

  it("counts read lessons and persists them across a remount", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWalkthrough();

    expect(screen.getByTestId("walkthrough-progress")).toHaveTextContent("0 / 2 lessons read");
    await user.click(screen.getByLabelText("Mark read: First lesson"));
    expect(screen.getByTestId("walkthrough-progress")).toHaveTextContent("1 / 2 lessons read");

    unmount();
    __resetProgressCacheForTests();
    renderWalkthrough();
    expect(screen.getByLabelText("Mark read: First lesson")).toBeChecked();
    expect(screen.getByTestId("walkthrough-progress")).toHaveTextContent("1 / 2 lessons read");
  });

  it("marks the walkthrough complete once every lesson is checked", async () => {
    const user = userEvent.setup();
    renderWalkthrough();
    await user.click(screen.getByLabelText("Mark read: First lesson"));
    await user.click(screen.getByLabelText("Mark read: Second lesson"));
    expect(screen.getByTestId("walkthrough-progress")).toHaveTextContent("walkthrough complete");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });

  it("does not claim to have copied when the Clipboard API is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    try {
      renderWalkthrough();
      const copyButton = screen.getAllByRole("button", { name: "copy" })[0];
      fireEvent.click(copyButton);
      expect(copyButton).toHaveTextContent("copy");
      expect(copyButton).not.toHaveTextContent("copied");
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
    }
  });
});
