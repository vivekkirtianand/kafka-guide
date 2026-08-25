import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";
import { runbooks } from "@/lib/data/runbooks";

const categories = Array.from(new Set(runbooks.map((r) => r.category)));

export default function RunbooksPage() {
  return (
    <div className="max-w-5xl">
      <SectionHeading
        eyebrow="Reference"
        title="Production operations runbooks"
        description="Each runbook covers prechecks, execution, validation, rollback, and escalation criteria. Content is scoped and ready to write — this is the index."
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
                  <div
                    key={r.slug}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-4 py-3"
                  >
                    <span className="text-sm text-text">{r.title}</span>
                    <Badge tone="neutral">planned</Badge>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
