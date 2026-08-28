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
    summary: "First summary.",
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

describe("TopicExplorer", () => {
  it("renders only topics with structured detail, trailing parenthetical stripped from the heading", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(screen.getByRole("heading", { name: "First topic" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /\(foo, bar\)/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second topic" })).toBeInTheDocument();
    expect(screen.queryByText("Outline-only topic")).not.toBeInTheDocument();
  });

  it("opens the first topic by default and keeps the rest collapsed", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(firstButton()).toHaveAttribute("aria-expanded", "true");
    expect(secondButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("does the alpha thing")).toBeInTheDocument();
    expect(screen.queryByText("does the gamma thing")).not.toBeInTheDocument();
  });

  it("keeps summary and config chips visible while a topic is collapsed", () => {
    render(<TopicExplorer topics={topics} detail={detail} />);

    const secondRow = secondButton().closest("div") as HTMLElement;
    expect(within(secondRow).getByText("Second summary.")).toBeInTheDocument();
    expect(within(secondRow).getByText("baz")).toBeInTheDocument();
  });

  it("toggles an individual topic open and closed", async () => {
    const user = userEvent.setup();
    render(<TopicExplorer topics={topics} detail={detail} />);

    await user.click(secondButton());
    expect(secondButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("does the gamma thing")).toBeInTheDocument();

    await user.click(secondButton());
    expect(secondButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("does the gamma thing")).not.toBeInTheDocument();
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

  it("shows the watch-out callout only when the open topic defines one", async () => {
    const user = userEvent.setup();
    render(<TopicExplorer topics={topics} detail={detail} />);

    expect(screen.getByText("the classic foot-gun")).toBeInTheDocument();

    await user.click(secondButton());
    const secondPanel = screen.getByRole("region", { name: "Second topic" });
    expect(within(secondPanel).queryByText(/watch out/i)).not.toBeInTheDocument();
  });
});
