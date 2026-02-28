"use client";

import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";
import {
  HealthStatusCard,
  ModeConfigsCard,
  ModelRegistryCard,
  ModesTableCard,
  PromptTemplatesCard,
} from "./orchestration/sections";
import { useOrchestrationData } from "./orchestration/use-orchestration-data";

export function OrchestrationSettings() {
  const { error, fetchData, health, loading, modeConfigs, modelConfigs, modes, prompts } =
    useOrchestrationData();

  return (
    <SettingsPageContent className="gap-6">
      <SettingsPageScrollArea className="px-1">
        <div className="flex flex-col gap-6 pb-8">
          <HealthStatusCard
            error={error}
            fetchData={fetchData}
            health={health}
            loading={loading}
          />
          <ModesTableCard loading={loading} modes={modes} />
          <ModeConfigsCard loading={loading} modeConfigs={modeConfigs} />
          <ModelRegistryCard loading={loading} modelConfigs={modelConfigs} />
          <PromptTemplatesCard loading={loading} prompts={prompts} />
        </div>
      </SettingsPageScrollArea>
    </SettingsPageContent>
  );
}
