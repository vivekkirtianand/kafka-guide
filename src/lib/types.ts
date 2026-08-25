export type DeploymentType = "kraft" | "zookeeper" | "managed";

export type RiskLevel = "safe" | "caution" | "high-risk";

export interface Module {
  slug: string;
  index: number;
  title: string;
  summary: string;
  topics: string[];
  activities: string[];
  status: "available" | "planned";
}

export interface ConfigEntry {
  key: string;
  scope: "broker" | "topic" | "producer" | "consumer";
  goal: string;
  controls: string;
  defaultValue: string;
  dynamic: boolean;
  riskOfChange: RiskLevel;
  managedAvailability: "full" | "limited" | "unavailable";
  whenToChange: string;
  performanceImpact: string;
  reliabilityImpact: string;
  relatedConfigs: string[];
  failureModes: string[];
}

export interface Incident {
  slug: string;
  title: string;
  briefing: string;
  symptoms: string[];
  clues: string[];
  scoring: string[];
  status: "available" | "planned";
}

export interface TroubleshootingEntry {
  slug: string;
  symptom: string;
  causes: string[];
  resolutionFlow: string[];
}

export interface Runbook {
  slug: string;
  title: string;
  category: string;
  steps: {
    prechecks: string[];
    execution: string[];
    validation: string[];
    rollback: string[];
    escalation: string[];
  };
}
