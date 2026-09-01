import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "./Sidebar";
import { ProgressProvider } from "@/lib/context/ProgressContext";

const renderSidebar = () => render(<Sidebar />, { wrapper: ProgressProvider });

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

class FakeMediaQueryList {
  matches: boolean;
  private listeners: Array<(e: { matches: boolean }) => void> = [];
  constructor(matches: boolean) {
    this.matches = matches;
  }
  addEventListener(_type: string, cb: (e: { matches: boolean }) => void) {
    this.listeners.push(cb);
  }
  removeEventListener(_type: string, cb: (e: { matches: boolean }) => void) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }
  emit(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((cb) => cb({ matches }));
  }
}

describe("Sidebar", () => {
  let mql: FakeMediaQueryList;

  beforeEach(() => {
    // Starts below the `lg` breakpoint, like a phone.
    mql = new FakeMediaQueryList(false);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue(mql),
    );
    document.body.insertAdjacentHTML("beforeend", '<div id="app-content"></div>');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.getElementById("app-content")?.remove();
  });

  it("closes the mobile drawer and releases the background when the viewport crosses into desktop width", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("dialog", { name: "Site navigation" })).toBeInTheDocument();
    expect(document.getElementById("app-content")).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    // Simulate widening the viewport past the `lg` breakpoint while the drawer is open.
    // The listener fires outside of React's own event handling, so the resulting state
    // update needs to be wrapped for React to flush it before we assert.
    act(() => {
      mql.emit(true);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementById("app-content")).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });

  it("does not force the drawer open when mounted directly at desktop width", () => {
    mql.matches = true;
    renderSidebar();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
