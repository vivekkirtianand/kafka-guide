import { notFound } from "next/navigation";
import Link from "next/link";
import { modules, getModule } from "@/lib/data/modules";
import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";
import LeaderElectionDemo from "@/components/demos/LeaderElectionDemo";
import RecordFlowDemo from "@/components/demos/RecordFlowDemo";
import PartitionOrderingDemo from "@/components/demos/PartitionOrderingDemo";

export function generateStaticParams() {
  return modules.map((m) => ({ slug: m.slug }));
}

export default async function ModuleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  const next = modules.find((m) => m.index === mod.index + 1);

  return (
    <div className="max-w-4xl">
      <SectionHeading
        eyebrow={`Module ${String(mod.index).padStart(2, "0")}`}
        title={mod.title}
        description={mod.summary}
      />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-lg text-text">Topics</h2>
          <ul className="flex flex-col gap-2">
            {mod.topics.map((t) => (
              <li key={t} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {mod.activities.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-lg text-text">Interactive activities</h2>
            <ul className="flex flex-col gap-2">
              {mod.activities.map((a) => (
                <li key={a} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stream" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {mod.slug === "mental-model" && (
        <div className="mt-10 flex flex-col gap-8">
          <RecordFlowDemo />
          <PartitionOrderingDemo />
          <LeaderElectionDemo />
        </div>
      )}

      {mod.slug === "local-cluster-lab" && (
        <div className="mt-10 rounded-lg border border-border bg-bg-elevated p-5 text-sm text-text-muted">
          <Badge tone="success">lab built</Badge>
          <p className="mt-3">
            This module&apos;s content isn&apos;t a page in this app — it&apos;s a real, reproducible
            Docker Compose lab: a three-broker Kafka cluster in KRaft mode, a web UI, and
            Prometheus/Grafana for metrics, with a walkthrough for every activity listed above.
          </p>
          <a
            href="https://github.com/vivekkirtianand/kafka-guide/tree/main/local-cluster-lab"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-accent hover:underline"
          >
            Open the local cluster lab
            <span aria-hidden>→</span>
          </a>
        </div>
      )}

      {mod.status === "planned" && mod.slug !== "local-cluster-lab" && (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-bg-elevated p-5 text-sm text-text-muted">
          <Badge tone="neutral">planned</Badge>
          <p className="mt-3">
            This module&apos;s content and labs haven&apos;t been built yet. The topics and activities above are
            scoped from the guide plan and ready to build out next.
          </p>
        </div>
      )}

      {next && (
        <div className="mt-12 border-t border-border pt-6">
          <Link href={`/modules/${next.slug}`} className="group inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent">
            <span className="font-mono text-[11px] text-text-faint">next</span>
            <span>{next.title}</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
