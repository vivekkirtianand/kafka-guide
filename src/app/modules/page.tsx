import { modules } from "@/lib/data/modules";
import ModuleCard from "@/components/ModuleCard";
import SectionHeading from "@/components/SectionHeading";

export default function ModulesIndexPage() {
  return (
    <div className="max-w-6xl">
      <SectionHeading
        eyebrow="Guide"
        title="Learning path"
        description="Seven modules, in order. Each pairs a concept with an experiment you run yourself against the local lab cluster."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <ModuleCard key={m.slug} module={m} />
        ))}
      </div>
    </div>
  );
}
