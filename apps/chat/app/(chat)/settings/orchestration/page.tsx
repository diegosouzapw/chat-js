import { OrchestrationSettings } from "@/components/settings/orchestration-settings";
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";

export default function OrchestrationSettingsPage() {
  return (
    <SettingsPage>
      <SettingsPageHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-lg">Orchestration</h2>
          <p className="text-muted-foreground text-sm">
            OmniChatAgent backend status, modes, and model registry.
          </p>
        </div>
      </SettingsPageHeader>
      <OrchestrationSettings />
    </SettingsPage>
  );
}
