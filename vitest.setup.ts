import "@testing-library/jest-dom/vitest";

// jsdom does not enable the Web Storage API in this setup, so provide a minimal in-memory
// localStorage / sessionStorage for tests that persist state.
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
  let usable = false;
  try {
    usable = typeof window[prop]?.setItem === "function";
  } catch {
    usable = false;
  }
  if (!usable) {
    Object.defineProperty(window, prop, { value: new MemoryStorage(), configurable: true });
  }
}
