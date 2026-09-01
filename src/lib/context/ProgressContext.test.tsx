import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ProgressProvider, useProgress, __resetProgressCacheForTests } from "./ProgressContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProgressProvider>{children}</ProgressProvider>
);

const mount = () => renderHook(() => useProgress(), { wrapper });

beforeEach(() => {
  window.localStorage.clear();
  __resetProgressCacheForTests();
});

describe("ProgressContext", () => {
  it("marks a module complete and persists it to localStorage", () => {
    const { result } = mount();
    act(() => result.current.markComplete("mental-model"));

    expect(result.current.isComplete("mental-model")).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem("kafka-guide:progress")!);
    expect(stored["mental-model"].completed).toBe(true);
    expect(stored["mental-model"].completedAt).toMatch(/^\d{4}-/);
  });

  it("restores stored progress on a fresh mount", () => {
    window.localStorage.setItem(
      "kafka-guide:progress",
      JSON.stringify({ "local-cluster-lab": { completed: true } }),
    );
    const { result } = mount();
    expect(result.current.hydrated).toBe(true);
    expect(result.current.isComplete("local-cluster-lab")).toBe(true);
  });

  it("toggleComplete flips state and clears completedAt when un-completing", () => {
    const { result } = mount();
    act(() => result.current.toggleComplete("a"));
    expect(result.current.isComplete("a")).toBe(true);
    act(() => result.current.toggleComplete("a"));
    expect(result.current.isComplete("a")).toBe(false);
    expect(result.current.progress["a"].completedAt).toBeUndefined();
  });

  it("resetAll clears state and storage", () => {
    const { result } = mount();
    act(() => result.current.markComplete("a"));
    act(() => result.current.resetAll());
    expect(result.current.progress).toEqual({});
    expect(window.localStorage.getItem("kafka-guide:progress")).toBeNull();
  });

  it("completedCount counts only the given slugs", () => {
    const { result } = mount();
    act(() => {
      result.current.markComplete("a");
      result.current.markComplete("c");
    });
    expect(result.current.completedCount(["a", "b", "c"])).toBe(2);
    expect(result.current.completedCount(["b"])).toBe(0);
  });

  it("resumeSlug returns the first incomplete module, or undefined when all are done", () => {
    const { result } = mount();
    expect(result.current.resumeSlug(["a", "b", "c"])).toBe("a");
    act(() => result.current.markComplete("a"));
    expect(result.current.resumeSlug(["a", "b", "c"])).toBe("b");
    act(() => {
      result.current.markComplete("b");
      result.current.markComplete("c");
    });
    expect(result.current.resumeSlug(["a", "b", "c"])).toBeUndefined();
  });

  it("resumeSlug prefers the most recently visited incomplete module", () => {
    const { result } = mount();
    act(() => result.current.markVisited("b"));
    expect(result.current.resumeSlug(["a", "b", "c"])).toBe("b");
  });

  it("toggles lab step checkboxes independently of module completion and persists them", () => {
    const { result } = mount();
    act(() => result.current.toggleStep("lab-a", "broker-up"));
    act(() => result.current.toggleStep("lab-a", "create-topic"));

    expect(result.current.stepDone("lab-a", "broker-up")).toBe(true);
    expect(result.current.stepDone("lab-a", "missing")).toBe(false);
    expect(result.current.isComplete("lab-a")).toBe(false);
    expect(result.current.completedStepCount("lab-a", ["broker-up", "create-topic", "describe"])).toBe(2);

    const stored = JSON.parse(window.localStorage.getItem("kafka-guide:progress")!);
    expect(stored["lab-a"].steps).toEqual({ "broker-up": true, "create-topic": true });

    act(() => result.current.toggleStep("lab-a", "broker-up"));
    expect(result.current.stepDone("lab-a", "broker-up")).toBe(false);
    expect(result.current.completedStepCount("lab-a", ["broker-up", "create-topic"])).toBe(1);
  });

  it("restores lab step progress on a fresh mount", () => {
    window.localStorage.setItem(
      "kafka-guide:progress",
      JSON.stringify({ "lab-a": { completed: false, steps: { "broker-up": true } } }),
    );
    const { result } = mount();
    expect(result.current.stepDone("lab-a", "broker-up")).toBe(true);
  });

  it("survives a localStorage that throws on read and write", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = mount();
    expect(result.current.hydrated).toBe(true);
    expect(() => act(() => result.current.markComplete("a"))).not.toThrow();
    expect(result.current.isComplete("a")).toBe(true);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
