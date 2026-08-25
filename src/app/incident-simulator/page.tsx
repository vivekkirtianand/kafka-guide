import SectionHeading from "@/components/SectionHeading";
import IncidentCard from "@/components/IncidentCard";
import { incidents } from "@/lib/data/incidents";

export default function IncidentSimulatorPage() {
  return (
    <div className="max-w-6xl">
      <SectionHeading
        eyebrow="Practice"
        title="Incident simulator"
        description="A cluster with an injected fault and limited clues. You're scored on diagnosis, evidence, safety of the proposed change, time to mitigation, and whether you preserved durability."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {incidents.map((i) => (
          <IncidentCard key={i.slug} incident={i} />
        ))}
      </div>
    </div>
  );
}
