import { describe, expect, it } from "vitest";
import { glossary, getGlossaryTerm } from "./glossary";
import { modules, getModule } from "./modules";

const slugs = new Set(glossary.map((t) => t.slug));

describe("glossary data", () => {
  it("has unique slugs and terms", () => {
    expect(new Set(glossary.map((t) => t.slug)).size).toBe(glossary.length);
    expect(new Set(glossary.map((t) => t.term)).size).toBe(glossary.length);
  });

  it("uses url-safe slugs and non-empty definitions", () => {
    for (const t of glossary) {
      expect(t.slug, t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.definition.length, t.slug).toBeGreaterThan(20);
    }
  });

  it("every seeAlso points at a real term and is not self-referential", () => {
    for (const t of glossary) {
      for (const ref of t.seeAlso ?? []) {
        expect(slugs, `${t.slug} → ${ref}`).toContain(ref);
        expect(ref, t.slug).not.toBe(t.slug);
      }
    }
  });

  it("every module reference resolves to a real module", () => {
    for (const t of glossary) {
      for (const m of t.modules ?? []) {
        expect(getModule(m), `${t.slug} → ${m}`).toBeDefined();
      }
    }
  });

  it("getGlossaryTerm finds by slug and misses cleanly", () => {
    expect(getGlossaryTerm("offset")?.term).toBe("Offset");
    expect(getGlossaryTerm("nope")).toBeUndefined();
  });
});

describe("inline [[glossary]] tokens in module content", () => {
  const TOKEN = /\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g;

  it("every [[slug]] token in a module's topicDetail resolves to a glossary term", () => {
    const seen: string[] = [];
    for (const m of modules) {
      const blobs: string[] = [];
      for (const d of Object.values(m.topicDetail ?? {})) {
        blobs.push(d.summary, d.watchOut ?? "", d.preface ?? "", ...d.points.map((p) => p.detail));
      }
      for (const text of blobs) {
        for (const match of text.matchAll(TOKEN)) {
          seen.push(match[1]);
          expect(slugs, `${m.slug}: [[${match[1]}]]`).toContain(match[1]);
        }
      }
    }
    // Guard against the wiring silently disappearing.
    expect(seen.length).toBeGreaterThan(0);
  });
});
