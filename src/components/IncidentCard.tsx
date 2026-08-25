import Link from "next/link";
import { Incident } from "@/lib/types";
import Badge from "./Badge";

export default function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link
      href={`/incident-simulator/${incident.slug}`}
      className="group flex flex-col justify-between rounded-lg border border-border bg-bg-elevated p-5 transition-colors hover:border-danger/50"
    >
      <div>
        <div className="mb-3">
          <Badge tone={incident.status === "available" ? "success" : "neutral"}>
            {incident.status === "available" ? "available" : "planned"}
          </Badge>
        </div>
        <h3 className="font-display text-lg text-text group-hover:text-danger">{incident.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{incident.briefing}</p>
      </div>
    </Link>
  );
}
