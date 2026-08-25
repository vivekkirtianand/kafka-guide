"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { DeploymentType, KAFKA_VERSIONS, KafkaVersion, availableDeployments } from "@/lib/types";

export { KAFKA_VERSIONS, availableDeployments };
export type { KafkaVersion };

export const DEPLOYMENT_LABELS: Record<DeploymentType, string> = {
  kraft: "KRaft",
  zookeeper: "ZooKeeper",
  managed: "Managed service",
};

interface ClusterContextValue {
  version: KafkaVersion;
  setVersion: (v: KafkaVersion) => void;
  deployment: DeploymentType;
  setDeployment: (d: DeploymentType) => void;
}

const ClusterContext = createContext<ClusterContextValue | null>(null);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [version, setVersionState] = useState<KafkaVersion>("4.0");
  const [deployment, setDeploymentState] = useState<DeploymentType>("kraft");

  function setVersion(v: KafkaVersion) {
    setVersionState(v);
    // Kafka 4.0 removed ZooKeeper mode — if the current deployment is no longer valid
    // for the newly selected version, fall back to KRaft rather than leaving an
    // impossible combination selected.
    setDeploymentState((d) => (availableDeployments(v).includes(d) ? d : "kraft"));
  }

  function setDeployment(d: DeploymentType) {
    setDeploymentState(d);
  }

  return (
    <ClusterContext.Provider value={{ version, setVersion, deployment, setDeployment }}>
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error("useCluster must be used within a ClusterProvider");
  return ctx;
}
