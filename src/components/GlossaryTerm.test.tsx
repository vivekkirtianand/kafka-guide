import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GlossaryTerm, { renderGlossaryText } from "./GlossaryTerm";

describe("GlossaryTerm", () => {
  it("links a known slug to its glossary anchor, defaulting the label to the term", () => {
    render(<GlossaryTerm slug="offset" />);
    const link = screen.getByRole("link", { name: "Offset" });
    expect(link).toHaveAttribute("href", "/glossary#offset");
  });

  it("uses child text as the label when given", () => {
    render(<GlossaryTerm slug="partition">partitions</GlossaryTerm>);
    expect(screen.getByRole("link", { name: "partitions" })).toHaveAttribute(
      "href",
      "/glossary#partition",
    );
  });

  it("renders unknown slugs as plain text, not a dead link", () => {
    render(<GlossaryTerm slug="not-a-real-term">the words</GlossaryTerm>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("the words")).toBeInTheDocument();
  });
});

describe("renderGlossaryText", () => {
  it("returns the string untouched when there are no tokens", () => {
    expect(renderGlossaryText("just plain text")).toBe("just plain text");
  });

  it("turns [[slug]] and [[slug|display]] into glossary links, keeping the surrounding text", () => {
    render(
      <p data-testid="p">{renderGlossaryText("a [[topic]] holds [[partition|partitions]] here")}</p>,
    );
    expect(screen.getByRole("link", { name: "Topic" })).toHaveAttribute("href", "/glossary#topic");
    expect(screen.getByRole("link", { name: "partitions" })).toHaveAttribute(
      "href",
      "/glossary#partition",
    );
    expect(screen.getByTestId("p")).toHaveTextContent("a Topic holds partitions here");
  });
});
