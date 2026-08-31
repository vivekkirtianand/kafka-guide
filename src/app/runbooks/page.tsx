import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { runbooks } from "@/lib/data/runbooks";

const categories = Array.from(new Set(runbooks.map((r) => r.category)));

export default function RunbooksPage() {
  return (
    <div className="max-w-5xl">
      <SectionHeading
        eyebrow="Reference"
        title="Production operations runbooks"
        description="Each runbook covers prechecks, execution, validation, rollback, and escalation criteria for a routine or incident-response operation."
      />
      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <div key={category}>
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
              {category}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {runbooks
                .filter((r) => r.category === category)
                .map((r) => (
                  <Link
                    key={r.slug}
                    href={`/runbooks/${r.slug}`}
                    className="group flex flex-col rounded-lg border border-border bg-bg-elevated px-4 py-3 transition-colors hover:border-accent/50"
                  >
                    <span className="text-sm text-text group-hover:text-accent">{r.title}</span>
                    <span className="mt-1 text-[13px] leading-relaxed text-text-muted">{r.summary}</span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
