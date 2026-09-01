import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ModuleCard from "./ModuleCard";
import { Module } from "@/lib/types";

const base: Module = {
  slug: "demo",
  index: 3,
  title: "Demo module",
  summary: "A summary.",
  topics: ["a", "b"],
  activities: ["x"],
  status: "available",
  difficulty: "intermediate",
  estimatedMinutes: 45,
};

describe("ModuleCard", () => {
  it("shows difficulty and the time estimate alongside the topic/activity counts", () => {
    render(<ModuleCard module={base} />);
    expect(screen.getByText("intermediate")).toBeInTheDocument();
    expect(screen.getByText("~45 min")).toBeInTheDocument();
    expect(screen.getByText("2 topics")).toBeInTheDocument();
    expect(screen.getByText("1 activities")).toBeInTheDocument();
  });

  it("omits the estimate when a module has none", () => {
    render(<ModuleCard module={{ ...base, estimatedMinutes: undefined }} />);
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
  });

  it("links to the module page", () => {
    render(<ModuleCard module={base} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/modules/demo");
  });
});
