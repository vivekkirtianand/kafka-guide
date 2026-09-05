import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TopicExplorer from "./TopicExplorer";
import { TopicDetail } from "@/lib/types";

const topics = [
  "First topic (foo, bar)",
  "Second topic (baz)",
  "Outline-only topic",
];

const detail: Record<string, TopicDetail> = {
  "First topic (foo, bar)": {
    level: "advanced",
    summary: "First summary.",
    preface: "Before the mechanics: here is the plain-language version.",
    configs: ["foo", "bar"],
    points: [
      { term: "alpha", detail: "does the alpha thing" },
      { term: "beta", detail: "does the beta thing" },
    ],
    watchOut: "the classic foot-gun",
  },
  "Second topic (baz)": {
    summary: "Second summary.",
    configs: ["baz"],
    points: [{ term: "gamma", detail: "does the gamma thing" }],
  },
};

const firstButton = () => screen.getByRole("button", { name: /First topic/ });
const secondButton = () => screen.getByRole("button", { name: /Second topic/ });

function panelFor(button: HTMLElement): HTMLElement {
  const id = button.getAttribute("aria-controls");
  const panel = id && document.getElementById(id);
  if (!panel) throw new Error(`no panel found for aria-controls=${id}`);
  return panel;
}

describe("TopicExplorer", () => {
  it("strips the trailing parenthetical from the heading but renders every topic", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(screen.getByRole("heading", { name: "First topic" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /\(foo, bar\)/ })).not.toBeInTheDocument();
    // A topic with no detail entry still shows, as a non-interactive stub.
    expect(screen.getByRole("heading", { name: "Outline-only topic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Outline-only topic/ })).not.toBeInTheDocument();
  });

  it("shows a level badge only for topics that declare one", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    const firstRow = firstButton().closest("div.overflow-hidden") as HTMLElement;
    expect(within(firstRow).getByText("advanced")).toBeInTheDocument();

    const secondRow = secondButton().closest("div.overflow-hidden") as HTMLElement;
    expect(within(secondRow).queryByText(/beginner|intermediate|advanced/)).not.toBeInTheDocument();
  });

  it("keeps every panel mounted so aria-controls always resolves, and links it back with aria-labelledby", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    const panel = panelFor(secondButton());
    expect(panel).toBeInTheDocument();
    expect(panel).not.toBeVisible();
    expect(panel).toHaveAttribute("aria-labelledby", secondButton().id);
  });

  it("opens the first topic by default and keeps the rest collapsed", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(firstButton()).toHaveAttribute("aria-expanded", "true");
    expect(secondButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("does the alpha thing")).toBeVisible();
    expect(screen.getByText("does the gamma thing")).not.toBeVisible();
  });

  it("keeps summary and config chips visible while a topic is collapsed", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    const secondRow = secondButton().closest("div") as HTMLElement;
    expect(within(secondRow).getByText("Second summary.")).toBeVisible();
    expect(within(secondRow).getByText("baz")).toBeVisible();
  });

  it("toggles an individual topic open and closed", async () => {
    const user = userEvent.setup();
    render(<TopicExplorer topics={topics} detail={detail} />);

    await user.click(secondButton());
    expect(secondButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("does the gamma thing")).toBeVisible();

    await user.click(secondButton());
    expect(secondButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("does the gamma thing")).not.toBeVisible();
  });

  it("expand all opens every topic and flips its label to collapse all", async () => {
    const user = userEvent.setup();
    render(<TopicExplorer topics={topics} detail={detail} />);

    await user.click(screen.getByRole("button", { name: "expand all" }));
    expect(firstButton()).toHaveAttribute("aria-expanded", "true");
    expect(secondButton()).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "collapse all" }));
    expect(firstButton()).toHaveAttribute("aria-expanded", "false");
    expect(secondButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the plain-language preface only when the open topic defines one", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    const panel = panelFor(firstButton());
    expect(within(panel).getByText(/plain-language version/)).toBeVisible();
    expect(within(panel).getByText("In plain terms")).toBeVisible();

    expect(within(panelFor(secondButton())).queryByText("In plain terms")).not.toBeInTheDocument();
  });

  it("places the preface before the points and before watch-out in the DOM, not just anywhere in the panel", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    // Use compareDocumentPosition rather than a plain textContent substring search, so this
    // fails if the preface were ever moved below the mechanics or the watch-out callout.
    const panel = panelFor(firstButton());
    const preface = within(panel).getByText("In plain terms").closest("div")!;
    const firstPointTerm = within(panel).getByText("alpha");
    const watchOut = within(panel).getByText("the classic foot-gun");

    expect(preface.compareDocumentPosition(firstPointTerm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preface.compareDocumentPosition(watchOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the watch-out callout only when the open topic defines one", async () => {
    const user = userEvent.setup();
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(screen.getByText("the classic foot-gun")).toBeVisible();

    await user.click(secondButton());
    expect(within(panelFor(secondButton())).queryByText(/watch out/i)).not.toBeInTheDocument();
  });
});
