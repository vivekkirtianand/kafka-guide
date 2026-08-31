import { notFound } from "next/navigation";
import { incidents, getIncident } from "@/lib/data/incidents";
import SectionHeading from "@/components/SectionHeading";
import Badge from "@/components/Badge";
import IncidentDiagnosis from "@/components/demos/IncidentDiagnosis";

export function generateStaticParams() {
  return incidents.map((i) => ({ slug: i.slug }));
}

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

      {incident.investigation ? (
        <>
          <IncidentDiagnosis
            clues={incident.investigation.clues}
            options={incident.investigation.options}
          />
          <div className="mt-6 rounded-lg border border-border-soft bg-bg-inset p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-text-faint">Scored on</div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {incident.scoring.map((s) => (
                <li key={s} className="text-sm text-text-muted">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </>
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
