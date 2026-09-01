"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { modules } from "@/lib/data/modules";
import { beginnerPath, referenceModules } from "@/lib/course";
import ModuleProgressBadge from "./ModuleProgressBadge";

const moduleLink = (m: (typeof modules)[number]) => ({
  href: `/modules/${m.slug}`,
  label: `${String(m.index).padStart(2, "0")} · ${m.title}`,
  slug: m.slug,
});

const sections = [
  {
    label: "Beginner path",
    items: beginnerPath(modules).map(moduleLink),
  },
  {
    label: "Reference modules",
    items: referenceModules(modules).map(moduleLink),
  },
  {
    label: "Reference",
    items: [
      { href: "/glossary", label: "Glossary" },
      { href: "/config-explorer", label: "Configuration explorer" },
      { href: "/troubleshooting", label: "Troubleshooting catalog" },
      { href: "/runbooks", label: "Production runbooks" },
    ],
  },
  {
    label: "Practice",
    items: [{ href: "/incident-simulator", label: "Incident simulator" }],
  },
];

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-7">
      {sections.map((section) => (
        <div key={section.label}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            {section.label}
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href;
              const slug = "slug" in item ? item.slug : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors ${
                      active ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-bg-elevated hover:text-text"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {slug && <ModuleProgressBadge slug={slug} className="shrink-0" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
// Keep in sync with Tailwind's `lg` breakpoint — the drawer/backdrop are `lg:hidden`,
// so once this matches they'd be invisible while the modal state (inert, scroll lock,
// trapped focus) stayed active if we didn't close on the crossing.
const DESKTOP_QUERY = "(min-width: 1024px)";

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setOpen(false);
    }
    handleChange(mql);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!open) return;

    const drawer = drawerRef.current;
    const trigger = triggerRef.current;
    const appContent = document.getElementById("app-content");
    const focusables = () => (drawer ? Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []);

    focusables()[0]?.focus();
    appContent?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      appContent?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg-inset px-4 py-3 lg:hidden">
        <Link href="/" className="min-w-0">
          <div className="truncate font-display text-lg text-text">Kafka, Operationally</div>
        </Link>
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="shrink-0 rounded border border-border p-2 text-text-muted hover:border-accent/50 hover:text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="scrollbar-thin absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-bg-inset px-5 py-6"
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="font-display text-xl tracking-tight text-text">Kafka, Operationally</div>
                <div className="mt-1 font-mono text-[11px] text-text-faint">an interactive systems guide</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="shrink-0 rounded border border-border p-1.5 text-text-muted hover:border-accent/50 hover:text-accent"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <Nav pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <aside className="scrollbar-thin sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-bg-inset px-5 py-6 lg:block">
        <Link href="/" className="mb-8 block">
          <div className="font-display text-xl tracking-tight text-text">Kafka, Operationally</div>
          <div className="mt-1 font-mono text-[11px] text-text-faint">an interactive systems guide</div>
        </Link>
        <Nav pathname={pathname} />
      </aside>
    </>
  );
}
