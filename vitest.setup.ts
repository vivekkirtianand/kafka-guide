import "@testing-library/jest-dom/vitest";

// jsdom in this setup does not provide the Web Storage API, and merely *reading*
// `window.localStorage` to feature-detect it makes Node emit an ExperimentalWarning per
// worker. So install a minimal in-memory implementation unconditionally.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

for (const prop of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(window, prop, { value: new MemoryStorage(), configurable: true });
}
