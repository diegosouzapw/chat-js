"use client";

import { Loader2, Workflow } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
} from "../settings-page";
import { MODE_ORDER, getModeTopology } from "@/lib/mode-topology";

// Dynamically import to avoid SSR issues with ReactFlow
const ModeFlowConfig = dynamic(
  () => import("./mode-flow-config"),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin" /></div> }
);

const MODE_ICONS: Record<string, string> = {
  auto: "🧭",
  direct: "➡️",
  council: "🏛️",
  council_peer_review: "🔍",
  debate: "⚔️",
  self_refine: "🔄",
  heavy: "🏋️",
  tree_of_thought: "🌳",
  chain_of_agents: "⛓️",
};

const API_BASE = "/api/omnichat";

export function FlowEditorSettings() {
  const [selectedMode, setSelectedMode] = useState("auto");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [globalDefaults, setGlobalDefaults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadModels = useCallback(async () => {
    try {
      // Fetch available models from the backend
      const res = await fetch(`${API_BASE}/model-configs?enabled=true`);
      if (res.ok) {
        const configs = await res.json();
        const models = configs.map((c: { model_id: string }) => c.model_id);
        setAvailableModels([...new Set(models)] as string[]);

        // Build defaults from global configs (first match per role)
        const defaults: Record<string, string> = {};
        for (const c of configs) {
          if (!defaults[c.role]) {
            defaults[c.role] = c.model_id;
          }
        }
        setGlobalDefaults(defaults);
      }
    } catch {
      // fallback: empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const topology = getModeTopology(selectedMode);

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center gap-3">
          <Workflow className="size-5" />
          <div>
            <h2 className="text-lg font-semibold">Flow Editor</h2>
            <p className="text-sm text-muted-foreground">
              Visual model configuration per orchestration mode
            </p>
          </div>
        </div>
      </SettingsPageHeader>

      <SettingsPageContent>
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Mode selector sidebar */}
          <div className="w-48 shrink-0 space-y-1 overflow-y-auto">
            {MODE_ORDER.map((mode) => {
              const topo = getModeTopology(mode);
              const isActive = mode === selectedMode;
              return (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{MODE_ICONS[mode] || "📦"}</span>
                  <span className="truncate">{topo?.label || mode}</span>
                </button>
              );
            })}
          </div>

          {/* Flow canvas area */}
          <div className="flex min-h-0 flex-1 flex-col">
            <Card className="flex min-h-0 flex-1 flex-col">
              <CardHeader className="shrink-0 pb-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">
                    {MODE_ICONS[selectedMode]} {topology?.label || selectedMode}
                  </CardTitle>
                  <Badge variant="secondary">
                    {topology?.nodes.length || 0} nodes
                  </Badge>
                </div>
                <CardDescription>{topology?.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 p-0">
                {loading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="min-h-[500px] w-full flex-1">
                    <ModeFlowConfig
                      mode={selectedMode}
                      availableModels={availableModels}
                      globalDefaults={globalDefaults}
                      onConfigChanged={loadModels}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SettingsPageContent>
    </SettingsPage>
  );
}
