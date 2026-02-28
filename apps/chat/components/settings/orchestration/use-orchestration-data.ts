"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  HealthStatus,
  OmniMode,
  OmniModeConfig,
  OmniModelConfig,
  OmniPrompt,
} from "./types";

interface UseOrchestrationDataResult {
  error: string | null;
  fetchData: () => Promise<void>;
  health: HealthStatus | null;
  loading: boolean;
  modeConfigs: OmniModeConfig[];
  modelConfigs: OmniModelConfig[];
  modes: OmniMode[];
  prompts: OmniPrompt[];
}

export function useOrchestrationData(): UseOrchestrationDataResult {
  const [modes, setModes] = useState<OmniMode[]>([]);
  const [modelConfigs, setModelConfigs] = useState<OmniModelConfig[]>([]);
  const [modeConfigs, setModeConfigs] = useState<OmniModeConfig[]>([]);
  const [prompts, setPrompts] = useState<OmniPrompt[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modesRes, healthRes, modelConfigsRes, modeConfigsRes, promptsRes] =
        await Promise.allSettled([
          fetch("/api/omnichat/modes").then((r) => r.json()),
          fetch("/api/omnichat/modes?action=health").then((r) => r.json()),
          fetch("/api/omnichat/model-configs").then((r) => r.json()),
          fetch("/api/omnichat/mode-configs").then((r) => r.json()),
          fetch("/api/omnichat/prompts").then((r) => r.json()),
        ]);

      if (modesRes.status === "fulfilled" && Array.isArray(modesRes.value)) {
        setModes(modesRes.value as OmniMode[]);
      }
      if (healthRes.status === "fulfilled") {
        setHealth(healthRes.value as HealthStatus);
      }
      if (
        modelConfigsRes.status === "fulfilled" &&
        Array.isArray(modelConfigsRes.value)
      ) {
        setModelConfigs(modelConfigsRes.value as OmniModelConfig[]);
      }
      if (
        modeConfigsRes.status === "fulfilled" &&
        Array.isArray(modeConfigsRes.value)
      ) {
        setModeConfigs(modeConfigsRes.value as OmniModeConfig[]);
      }
      if (promptsRes.status === "fulfilled" && Array.isArray(promptsRes.value)) {
        setPrompts(promptsRes.value as OmniPrompt[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    error,
    fetchData,
    health,
    loading,
    modeConfigs,
    modelConfigs,
    modes,
    prompts,
  };
}
