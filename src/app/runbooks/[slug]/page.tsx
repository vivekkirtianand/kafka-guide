import Link from "next/link";
import { notFound } from "next/navigation";
import { runbooks, getRunbook } from "@/lib/data/runbooks";
import { Runbook } from "@/lib/types";
import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";

export function generateStaticParams() {
  return runbooks.map((r) => ({ slug: r.slug }));
}

const SECTIONS: {
  key: keyof Runbook["steps"];
  label: string;
  tone: "accent" | "stream" | "success" | "neutral" | "danger";
}[] = [
  { key: "prechecks", label: "Prechecks", tone: "accent" },
  { key: "execution", label: "Execution", tone: "stream" },
  { key: "validation", label: "Validation", tone: "success" },
  { key: "rollback", label: "Rollback", tone: "neutral" },
  { key: "escalation", label: "Escalation", tone: "danger" },
];

export default async function RunbookDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const runbook = getRunbook(slug);
  if (!runbook) notFound();

  return (
    <div className="max-w-3xl">
      <SectionHeading eyebrow={`Runbook · ${runbook.category}`} title={runbook.title} description={runbook.summary} />

      <div className="mb-8 rounded-lg border border-border-soft bg-bg-inset p-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-text-faint">When to use this</div>
        <p className="text-sm leading-relaxed text-text-muted">{runbook.when}</p>
      </div>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="mb-3">
              <Badge tone={section.tone}>{section.label}</Badge>
            </div>
            <ol className="flex flex-col gap-2">
              {runbook.steps[section.key].map((item, i) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-text-muted">
                  <span className="mt-0.5 font-mono text-[11px] text-text-faint">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-12 border-t border-border pt-6">
        <Link href="/runbooks" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent">
          <span aria-hidden>←</span>
          All runbooks
        </Link>
      </div>
    </div>
  );
}
