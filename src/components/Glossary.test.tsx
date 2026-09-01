import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Glossary from "./Glossary";

beforeEach(() => {
  // jsdom has no layout engine.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.location.hash = "";
});

const row = (slug: string) => document.getElementById(slug);

describe("Glossary", () => {
  it("filters rows by term and definition text", async () => {
    const user = userEvent.setup();
    render(<Glossary />);

    await user.type(screen.getByRole("searchbox", { name: /search the glossary/i }), "bootstrap");

    expect(row("bootstrap-servers")).toBeInTheDocument();
    expect(row("broker")).not.toBeInTheDocument();
  });

  it("clears the filter when a see-also link points at a currently-hidden term, then scrolls to it", async () => {
    const user = userEvent.setup();
    render(<Glossary />);

    const search = screen.getByRole("searchbox", { name: /search the glossary/i });
    await user.type(search, "bootstrap");
    expect(row("broker")).not.toBeInTheDocument();

    // "bootstrap.servers" lists "Broker" under See also — filtered out right now.
    await user.click(screen.getByRole("link", { name: "Broker" }));

    expect(search).toHaveValue("");
    expect(row("broker")).toBeInTheDocument();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    expect(window.location.hash).toBe("#broker");
  });
});
