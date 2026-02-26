"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CloudDownload,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/react";
import { ModelsTable } from "./models-table";
import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";

const API_BASE = "/api/omnichat/model-configs";

export function ModelsSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [syncing, setSyncing] = useState(false);
  const [reloading, setReloading] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}?action=sync`, { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Sync failed");
      const data = await res.json();
      toast.success(`Synced: ${data.added ?? 0} added, ${data.updated ?? 0} updated`);
      queryClient.invalidateQueries({
        queryKey: trpc.settings.getModelPreferences.queryKey(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const res = await fetch(`${API_BASE}?action=reload`, { method: "POST", body: JSON.stringify({}) });
      if (!res.ok) throw new Error("Reload failed");
      toast.success("Model registry reloaded");
      queryClient.invalidateQueries({
        queryKey: trpc.settings.getModelPreferences.queryKey(),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reload failed");
    } finally {
      setReloading(false);
    }
  };

  return (
    <SettingsPageContent className="gap-4">
      {/* Search + Action buttons row */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-muted/50 pr-10 pl-9"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model"
            value={search}
          />
        </div>

        <Button
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: trpc.settings.getModelPreferences.queryKey(),
            })
          }
          size="icon"
          variant="ghost"
          title="Refresh list"
        >
          <RefreshCw className="size-4" />
        </Button>

        <Button
          onClick={handleSync}
          disabled={syncing}
          size="sm"
          variant="outline"
          title="Fetch models from OmniRoute provider"
        >
          {syncing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CloudDownload className="mr-2 size-4" />
          )}
          Sync OmniRoute
        </Button>

        <Button
          onClick={handleReload}
          disabled={reloading}
          size="sm"
          variant="outline"
          title="Reload model registry from backend config"
        >
          {reloading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 size-4" />
          )}
          Reload Registry
        </Button>
      </div>

      <SettingsPageScrollArea>
        <ModelsTable className="block px-4" search={deferredSearch} />
      </SettingsPageScrollArea>
    </SettingsPageContent>
  );
}
