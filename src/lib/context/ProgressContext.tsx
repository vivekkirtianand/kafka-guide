"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from "react";

const STORAGE_KEY = "kafka-guide:progress";

export interface ModuleProgress {
  completed: boolean;
  // ISO timestamp of the most recent completion.
  completedAt?: string;
  // ISO timestamp of the most recent visit to the module page — drives "resume".
  visitedAt?: string;
  // Per-step checkboxes for an in-app lab, keyed by LabStep.id. Only present on lab entries.
  steps?: Record<string, boolean>;
}

type ProgressMap = Record<string, ModuleProgress>;

const EMPTY: ProgressMap = {};

// External store: a single source of truth read via useSyncExternalStore, so SSR and the
// first client render agree and cross-tab `storage` events are picked up for free.
let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();

function readStorage(): ProgressMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ProgressMap) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): ProgressMap {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): ProgressMap {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = readStorage();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function setMap(next: ProgressMap) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      if (Object.keys(next).length === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / storage disabled / quota — progress just won't persist this session.
    }
  }
  listeners.forEach((l) => l());
}

function update(mutate: (draft: ProgressMap) => ProgressMap) {
  setMap(mutate(getSnapshot()));
}

interface ProgressContextValue {
  progress: ProgressMap;
  // False during SSR and the first client render, true afterwards. UI that would otherwise
  // flash the wrong state should wait for this.
  hydrated: boolean;
  isComplete: (slug: string) => boolean;
  markComplete: (slug: string) => void;
  markIncomplete: (slug: string) => void;
  toggleComplete: (slug: string) => void;
  markVisited: (slug: string) => void;
  resetAll: () => void;
  completedCount: (slugs: string[]) => number;
  resumeSlug: (candidateSlugs: string[]) => string | undefined;
  // Per-step lab checkboxes, namespaced under a lab slug.
  stepDone: (slug: string, stepId: string) => boolean;
  toggleStep: (slug: string, stepId: string) => void;
  completedStepCount: (slug: string, stepIds: string[]) => number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const now = () => new Date().toISOString();

export function ProgressProvider({ children }: { children: ReactNode }) {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isComplete = useCallback((slug: string) => !!progress[slug]?.completed, [progress]);

  const markComplete = useCallback((slug: string) => {
    update((p) => ({ ...p, [slug]: { ...p[slug], completed: true, completedAt: now() } }));
  }, []);

  const markIncomplete = useCallback((slug: string) => {
    update((p) => ({ ...p, [slug]: { ...p[slug], completed: false, completedAt: undefined } }));
  }, []);

  const toggleComplete = useCallback((slug: string) => {
    update((p) =>
      p[slug]?.completed
        ? { ...p, [slug]: { ...p[slug], completed: false, completedAt: undefined } }
        : { ...p, [slug]: { ...p[slug], completed: true, completedAt: now() } },
    );
  }, []);

  const markVisited = useCallback((slug: string) => {
    update((p) => {
      const existing = p[slug] ?? { completed: false };
      return { ...p, [slug]: { ...existing, visitedAt: now() } };
    });
  }, []);

  const resetAll = useCallback(() => setMap({}), []);

  const stepDone = useCallback(
    (slug: string, stepId: string) => !!progress[slug]?.steps?.[stepId],
    [progress],
  );

  const toggleStep = useCallback((slug: string, stepId: string) => {
    update((p) => {
      const existing = p[slug] ?? { completed: false };
      const steps = { ...existing.steps };
      if (steps[stepId]) delete steps[stepId];
      else steps[stepId] = true;
      return { ...p, [slug]: { ...existing, steps } };
    });
  }, []);

  const completedStepCount = useCallback(
    (slug: string, stepIds: string[]) => {
      const steps = progress[slug]?.steps ?? {};
      return stepIds.filter((id) => steps[id]).length;
    },
    [progress],
  );

  const completedCount = useCallback(
    (slugs: string[]) => slugs.filter((s) => progress[s]?.completed).length,
    [progress],
  );

  const resumeSlug = useCallback(
    (candidateSlugs: string[]) => {
      const incomplete = candidateSlugs.filter((s) => !progress[s]?.completed);
      if (incomplete.length === 0) return undefined;
      const mostRecentlyVisited = incomplete
        .filter((s) => progress[s]?.visitedAt)
        .sort((a, b) => (progress[b]!.visitedAt! < progress[a]!.visitedAt! ? -1 : 1))[0];
      return mostRecentlyVisited ?? incomplete[0];
    },
    [progress],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      hydrated,
      isComplete,
      markComplete,
      markIncomplete,
      toggleComplete,
      markVisited,
      resetAll,
      completedCount,
      resumeSlug,
      stepDone,
      toggleStep,
      completedStepCount,
    }),
    [
      progress,
      hydrated,
      isComplete,
      markComplete,
      markIncomplete,
      toggleComplete,
      markVisited,
      resetAll,
      completedCount,
      resumeSlug,
      stepDone,
      toggleStep,
      completedStepCount,
    ],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within a ProgressProvider");
  return ctx;
}

// Test-only: drop the in-memory cache so each test starts from a clean read of localStorage.
export function __resetProgressCacheForTests() {
  cache = null;
  listeners.clear();
}
