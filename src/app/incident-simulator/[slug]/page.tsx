import { notFound } from "next/navigation";
import { incidents, getIncident } from "@/lib/data/incidents";
import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";
import IncidentDiagnosis from "@/components/demos/IncidentDiagnosis";

export function generateStaticParams() {
  return incidents.map((i) => ({ slug: i.slug }));
}

const SLOW_BROKER_CLUES = [
  { label: "disk I/O metrics", evidence: "broker-2 write latency is 8x the cluster median and climbing." },
  {
    label: "request queue / purgatory size",
    evidence: "broker-2's request queue is saturated; other brokers are near zero.",
  },
  {
    label: "under-replicated partition count",
    evidence: "Partitions led by broker-2 are falling out of sync as followers can't keep up with fetch requests.",
  },
];

const SLOW_BROKER_OPTIONS = [
  {
    label: "A slow disk on broker-2 is backing up writes and replication",
    correct: true,
    feedback:
      "Disk latency on broker-2 is the root cause: it backs up the request queue, which delays replica fetches, which then produces under-replicated partitions. The fix is to address broker-2's disk (or move its partition leadership off) rather than change producer or replication settings.",
  },
  {
    label: "min.insync.replicas is set too high across the cluster",
    correct: false,
    feedback:
      "min.insync.replicas would only matter if writes were being rejected with NOT_ENOUGH_REPLICAS. Here writes are succeeding but slowly — the evidence points to hardware, not a durability setting.",
  },
  {
    label: "The producer's batch.size is too small",
    correct: false,
    feedback:
      "Producer batching wouldn't explain an isolated broker showing elevated disk latency and request-queue saturation while the rest of the cluster is normal.",
  },
];

export default async function IncidentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const incident = getIncident(slug);
  if (!incident) notFound();

  return (
    <div className="max-w-4xl">
      <SectionHeading eyebrow="Incident simulator" title={incident.title} description={incident.briefing} />

      <div className="mb-8 flex flex-wrap gap-2">
        {incident.symptoms.map((s) => (
          <Badge key={s} tone="danger">
            {s}
          </Badge>
        ))}
      </div>

      {incident.slug === "slow-broker" ? (
        <IncidentDiagnosis clues={SLOW_BROKER_CLUES} options={SLOW_BROKER_OPTIONS} />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-bg-elevated p-5">
          <Badge tone="neutral">planned</Badge>
          <p className="mt-3 text-sm text-text-muted">
            This incident&apos;s fault injection and clue set haven&apos;t been built yet. Available clue
            categories and scoring criteria are scoped below.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">Clues</div>
              <ul className="flex flex-col gap-1.5">
                {incident.clues.map((c) => (
                  <li key={c} className="text-sm text-text-muted">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                Scored on
              </div>
              <ul className="flex flex-col gap-1.5">
                {incident.scoring.map((s) => (
                  <li key={s} className="text-sm text-text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
