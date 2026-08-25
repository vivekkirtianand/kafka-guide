import { Runbook } from "@/lib/types";

const runbookTitles: { title: string; category: string }[] = [
  { title: "Topic creation and configuration review", category: "Change management" },
  { title: "Increasing partitions", category: "Capacity" },
  { title: "Adding or removing brokers", category: "Capacity" },
  { title: "Partition reassignment", category: "Capacity" },
  { title: "Rolling application deployments", category: "Deployment" },
  { title: "Rolling broker restarts", category: "Deployment" },
  { title: "Certificate and credential rotation", category: "Security" },
  { title: "Capacity planning", category: "Capacity" },
  { title: "Backup and disaster recovery", category: "Resilience" },
  { title: "Cluster migration", category: "Resilience" },
  { title: "Kafka upgrades", category: "Deployment" },
  { title: "Consumer offset recovery", category: "Incident response" },
  { title: "Handling a full disk", category: "Incident response" },
  { title: "Handling broker and availability-zone failures", category: "Incident response" },
];

export const runbooks: Runbook[] = runbookTitles.map((r) => ({
  slug: r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  title: r.title,
  category: r.category,
  steps: {
    prechecks: [],
    execution: [],
    validation: [],
    rollback: [],
    escalation: [],
  },
}));
