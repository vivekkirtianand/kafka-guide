"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { modules } from "@/lib/data/modules";

const sections = [
  {
    label: "Guide",
    items: modules.map((m) => ({
      href: `/modules/${m.slug}`,
      label: `${String(m.index).padStart(2, "0")} · ${m.title}`,
    })),
  },
  {
    label: "Reference",
    items: [
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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="scrollbar-thin sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-bg-inset px-5 py-6 lg:block">
      <Link href="/" className="mb-8 block">
        <div className="font-display text-xl tracking-tight text-text">Kafka, Operationally</div>
        <div className="mt-1 font-mono text-[11px] text-text-faint">an interactive systems guide</div>
      </Link>

      <nav className="flex flex-col gap-7">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              {section.label}
            </div>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded px-2.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-text-muted hover:bg-bg-elevated hover:text-text"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
