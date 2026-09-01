import { notFound } from "next/navigation";
import Link from "next/link";
import { modules, getModule } from "@/lib/data/modules";
import { trackNeighbors } from "@/lib/course";
import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";
import TopicExplorer from "@/components/TopicExplorer";
import ModuleMeta from "@/components/ModuleMeta";
import ModuleCompletion from "@/components/ModuleCompletion";
import TroubleshootingCatalog from "@/components/TroubleshootingCatalog";
import LeaderElectionDemo from "@/components/demos/LeaderElectionDemo";
import RecordFlowDemo from "@/components/demos/RecordFlowDemo";
import PartitionOrderingDemo from "@/components/demos/PartitionOrderingDemo";
import AcksDurabilityDemo from "@/components/demos/AcksDurabilityDemo";
import BatchingThroughputDemo from "@/components/demos/BatchingThroughputDemo";
import BufferAndTimeoutDemo from "@/components/demos/BufferAndTimeoutDemo";
import IdempotenceDemo from "@/components/demos/IdempotenceDemo";
import PollIntervalDemo from "@/components/demos/PollIntervalDemo";
import ConsumerGroupScalingDemo from "@/components/demos/ConsumerGroupScalingDemo";
import CommitStrategyDemo from "@/components/demos/CommitStrategyDemo";
import CommitCrashDemo from "@/components/demos/CommitCrashDemo";
import OffsetResetDemo from "@/components/demos/OffsetResetDemo";
import PoisonMessageDemo from "@/components/demos/PoisonMessageDemo";
import ReplicationFloorDemo from "@/components/demos/ReplicationFloorDemo";
import RetentionCompactionDemo from "@/components/demos/RetentionCompactionDemo";
import RackPlacementDemo from "@/components/demos/RackPlacementDemo";
import QuotaThrottleDemo from "@/components/demos/QuotaThrottleDemo";
import BottleneckDiagnosis from "@/components/demos/BottleneckDiagnosis";
import RequestLatencyBreakdown from "@/components/demos/RequestLatencyBreakdown";
import LagSlopeVsAbsolute from "@/components/demos/LagSlopeVsAbsolute";
import IsrChurnDemo from "@/components/demos/IsrChurnDemo";

export function generateStaticParams() {
  return modules.map((m) => ({ slug: m.slug }));
}

export default async function ModuleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mod = getModule(slug);
  if (!mod) notFound();

  const { prev, next } = trackNeighbors(modules, mod);

  const activitiesBlock = mod.activities.length > 0 && (
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
  );

  return (
    <div className="max-w-4xl">
      <SectionHeading
        eyebrow={`Module ${String(mod.index).padStart(2, "0")}`}
        title={mod.title}
        description={mod.summary}
      />

      <ModuleMeta module={mod} />

      {mod.slug === "troubleshooting-scenarios" ? (
        <div className="flex flex-col gap-6">
          <p className="text-sm leading-relaxed text-text-muted">
            Each entry moves from a symptom to the specific evidence that confirms or rules out
            each cause, then to a resolution flow. The search matches every field — symptoms,
            causes, evidence, resolution steps, config keys, and the watch-outs. The recurring
            theme: reducing a durability setting can make an error disappear while making the
            underlying problem worse.
          </p>
          <TroubleshootingCatalog />
        </div>
      ) : mod.topicDetail ? (
        <div className="flex flex-col gap-8">
          <TopicExplorer topics={mod.topics} detail={mod.topicDetail} />
          {activitiesBlock}
        </div>
      ) : mod.topicNarrative ? (
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-4 font-display text-lg text-text">Topics</h2>
            <div className="flex flex-col gap-6">
              {mod.topics.map((t) => (
                <div key={t}>
                  <h3 className="mb-2 font-display text-base text-text">{t}</h3>
                  {mod.topicNarrative?.[t]?.split("\n\n").map((para, i) => (
                    <p key={i} className="mb-2 text-sm leading-relaxed text-text-muted last:mb-0">
                      {para}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {activitiesBlock}
        </div>
      ) : (
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

          {activitiesBlock}
        </div>
      )}

      {mod.slug === "mental-model" && (
        <div className="mt-10 flex flex-col gap-8">
          <RecordFlowDemo />
          <PartitionOrderingDemo />
          <LeaderElectionDemo />
        </div>
      )}

      {mod.slug === "producer-configuration" && (
        <div className="mt-10 flex flex-col gap-8">
          <AcksDurabilityDemo />
          <BatchingThroughputDemo />
          <BufferAndTimeoutDemo />
          <IdempotenceDemo />
        </div>
      )}

      {mod.slug === "consumer-configuration" && (
        <div className="mt-10 flex flex-col gap-8">
          <PollIntervalDemo />
          <ConsumerGroupScalingDemo />
          <CommitStrategyDemo />
          <CommitCrashDemo />
          <OffsetResetDemo />
          <PoisonMessageDemo />
        </div>
      )}

      {mod.slug === "broker-topic-configuration" && (
        <div className="mt-10 flex flex-col gap-8">
          <ReplicationFloorDemo />
          <RetentionCompactionDemo />
          <RackPlacementDemo />
          <QuotaThrottleDemo />
        </div>
      )}

      {mod.slug === "observability" && (
        <div className="mt-10 flex flex-col gap-8">
          <BottleneckDiagnosis />
          <RequestLatencyBreakdown />
          <LagSlopeVsAbsolute />
          <IsrChurnDemo />
        </div>
      )}

      {mod.status === "external" && (
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

      {mod.status === "planned" && (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-bg-elevated p-5 text-sm text-text-muted">
          <Badge tone="neutral">planned</Badge>
          <p className="mt-3">
            This module&apos;s content and labs haven&apos;t been built yet. The topics and activities above are
            scoped from the guide plan and ready to build out next.
          </p>
        </div>
      )}

      {mod.furtherReading && mod.furtherReading.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 font-display text-lg text-text">Further reading</h2>
          <ul className="flex flex-col gap-2">
            {mod.furtherReading.map((r) => (
              <li key={r.url} className="flex gap-2 text-sm leading-relaxed text-text-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mod.status !== "planned" && (
        <ModuleCompletion slug={mod.slug} completionCriteria={mod.completionCriteria} />
      )}

      {(prev || next) && (
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6">
          {prev ? (
            <Link href={`/modules/${prev.slug}`} className="group inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent">
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="font-mono text-[11px] text-text-faint">prev</span>
              <span>{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/modules/${next.slug}`} className="group inline-flex items-center gap-2 text-right text-sm text-text-muted hover:text-accent">
              <span className="font-mono text-[11px] text-text-faint">next</span>
              <span>{next.title}</span>
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
