import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ModuleCard from "./ModuleCard";
import { ProgressProvider, __resetProgressCacheForTests } from "@/lib/context/ProgressContext";
import { Module } from "@/lib/types";

const renderCard = (module: Module) =>
  render(
    <ProgressProvider>
      <ModuleCard module={module} />
    </ProgressProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  __resetProgressCacheForTests();
});

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
    renderCard(base);
    expect(screen.getByText("intermediate")).toBeInTheDocument();
    expect(screen.getByText("~45 min")).toBeInTheDocument();
    expect(screen.getByText("2 topics")).toBeInTheDocument();
    expect(screen.getByText("1 activities")).toBeInTheDocument();
  });

  it("omits the estimate when a module has none", () => {
    renderCard({ ...base, estimatedMinutes: undefined });
    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
  });

  it("links to the module page", () => {
    renderCard(base);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/modules/demo");
  });
});
