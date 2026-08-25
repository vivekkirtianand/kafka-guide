"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { DeploymentType } from "@/lib/types";

export const KAFKA_VERSIONS = ["4.0", "3.9", "3.7", "3.5"] as const;
export type KafkaVersion = (typeof KAFKA_VERSIONS)[number];

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
  const [version, setVersion] = useState<KafkaVersion>("4.0");
  const [deployment, setDeployment] = useState<DeploymentType>("kraft");

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
