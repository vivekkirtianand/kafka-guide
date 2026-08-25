import Link from "next/link";
import { modules } from "@/lib/data/modules";
import ModuleCard from "@/components/ModuleCard";
import Badge from "@/components/Badge";

const pillars = [
  {
    href: "/config-explorer",
    label: "Configuration explorer",
    description:
      "Every setting filterable by version, deployment type, goal, and risk — with rollback and verification steps.",
  },
  {
    href: "/troubleshooting",
    label: "Troubleshooting catalog",
    description: "Symptom → evidence → cause → resolution, for the incidents that actually page people.",
  },
  {
    href: "/incident-simulator",
    label: "Incident simulator",
    description: "A cluster with an injected fault and limited clues. You're scored on diagnosis, safety, and speed.",
  },
];

export default function Home() {
  return (
    <div className="max-w-6xl">
      <section className="mb-16 max-w-3xl">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          for developers, platform engineers, and SREs
        </div>
        <h1 className="font-display text-4xl leading-[1.1] text-text sm:text-5xl">
          Operate Kafka like you&apos;ve already seen it break.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-text-muted">
          Every important configuration is taught through a failure, a tradeoff, or an observable
          behavior — never as an isolated parameter reference. Predict what happens, break it in a real
          three-broker lab, then read the evidence that would have told you why.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/modules/${modules[0].slug}`}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-inset transition-opacity hover:opacity-90"
          >
            Start with the mental model
          </Link>
          <Link
            href="/incident-simulator"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/50 hover:text-accent"
          >
            Jump into an incident
          </Link>
        </div>
      </section>

      <section className="mb-16">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-xl text-text">Learning path</h2>
          <span className="font-mono text-[11px] text-text-faint">7 modules · ~8 weeks part-time</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <ModuleCard key={m.slug} module={m} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-xl text-text">Reference and practice</h2>
          <Badge tone="accent">version + deployment aware</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex flex-col rounded-lg border border-border bg-bg-elevated p-5 transition-colors hover:border-stream/50"
            >
              <h3 className="font-display text-lg text-text group-hover:text-stream">{p.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
