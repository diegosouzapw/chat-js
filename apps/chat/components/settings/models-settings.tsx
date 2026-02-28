"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CloudDownload,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/react";
import { ModelsTable } from "./models-table";
import { ROLE_COLORS } from "./orchestration/constants";
import { SettingsPageContent, SettingsPageScrollArea } from "./settings-page";

const API_BASE = "/api/omnichat/model-configs";
const MODEL_ROLE_OPTIONS = [
  "router",
  "worker",
  "judge",
  "embedding",
  "reranking",
] as const;

type ModelRole = (typeof MODEL_ROLE_OPTIONS)[number];

interface OmniModelConfig {
  display_name?: string;
  enabled: boolean;
  id: string;
  model_id: string;
  notes?: string;
  priority: number;
  role: ModelRole | string;
}

interface ModelConfigDraft {
  display_name: string;
  enabled: boolean;
  notes: string;
  priority: number;
}

interface ModelTestResult {
  elapsed_s: number;
  model_id: string;
  model_reported?: string;
  response: string;
  status: "error" | "ok";
  tokens?: { completion: number; prompt: number };
}

function buildDraft(config: OmniModelConfig): ModelConfigDraft {
  return {
    display_name: config.display_name ?? "",
    enabled: config.enabled,
    notes: config.notes ?? "",
    priority: config.priority,
  };
}

function hasDraftChanges(config: OmniModelConfig, draft: ModelConfigDraft): boolean {
  return (
    config.enabled !== draft.enabled ||
    config.priority !== draft.priority ||
    (config.display_name ?? "") !== draft.display_name ||
    (config.notes ?? "") !== draft.notes
  );
}

function parsePriority(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, 1000);
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const maybeError = payload.error;
    if (typeof maybeError === "string" && maybeError.trim()) {
      return maybeError;
    }
  }
  return fallback;
}

function summarizeTestResult(result: ModelTestResult): string {
  const preview = result.response.trim().slice(0, 120);
  const suffix = result.response.trim().length > 120 ? "…" : "";
  return `${preview}${suffix}`;
}

export function ModelsSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [syncing, setSyncing] = useState(false);
  const [reloading, setReloading] = useState(false);

  const [adminConfigs, setAdminConfigs] = useState<OmniModelConfig[]>([]);
  const [adminDrafts, setAdminDrafts] = useState<Record<string, ModelConfigDraft>>(
    {}
  );
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  const [creatingConfig, setCreatingConfig] = useState(false);

  const [newModelId, setNewModelId] = useState("");
  const [newRole, setNewRole] = useState<ModelRole>("worker");
  const [newPriority, setNewPriority] = useState("0");
  const [newEnabled, setNewEnabled] = useState(true);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const invalidateUserPreferences = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.settings.getModelPreferences.queryKey(),
    });

  const loadAdminConfigs = async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const response = await fetch(API_BASE);
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, `HTTP ${response.status}`));
      }
      const configs = Array.isArray(payload) ? payload : [];
      setAdminConfigs(configs);
      setAdminDrafts(
        configs.reduce<Record<string, ModelConfigDraft>>((acc, config) => {
          acc[config.id] = buildDraft(config);
          return acc;
        }, {})
      );
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Failed to load model configs");
      setAdminConfigs([]);
      setAdminDrafts({});
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminConfigs();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_BASE}?action=sync`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Sync failed"));
      }
      const synced =
        (typeof payload.models_synced === "number" && payload.models_synced) ||
        (typeof payload.synced === "number" && payload.synced) ||
        0;
      toast.success(`Registry synced (${synced} model configs)`);
      await loadAdminConfigs();
      invalidateUserPreferences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const response = await fetch(`${API_BASE}?action=reload`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Reload failed"));
      }
      toast.success("Model registry reloaded");
      await loadAdminConfigs();
      invalidateUserPreferences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reload failed");
    } finally {
      setReloading(false);
    }
  };

  const handleCreateConfig = async () => {
    const modelId = newModelId.trim();
    if (!modelId) {
      toast.error("Model ID is required");
      return;
    }

    setCreatingConfig(true);
    try {
      const response = await fetch(API_BASE, {
        body: JSON.stringify({
          display_name: newDisplayName.trim() || undefined,
          enabled: newEnabled,
          model_id: modelId,
          notes: newNotes.trim() || undefined,
          priority: parsePriority(newPriority),
          role: newRole,
        }),
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Create failed"));
      }

      const created = payload as OmniModelConfig;
      setAdminConfigs((prev) => [created, ...prev]);
      setAdminDrafts((prev) => ({ ...prev, [created.id]: buildDraft(created) }));
      setNewModelId("");
      setNewPriority("0");
      setNewEnabled(true);
      setNewDisplayName("");
      setNewNotes("");
      toast.success("Model config created");
      invalidateUserPreferences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
    } finally {
      setCreatingConfig(false);
    }
  };

  const handleSaveConfig = async (configId: string) => {
    const config = adminConfigs.find((item) => item.id === configId);
    const draft = adminDrafts[configId];
    if (!config || !draft || !hasDraftChanges(config, draft)) {
      return;
    }

    setSavingConfigId(configId);
    try {
      const response = await fetch(`${API_BASE}/${configId}`, {
        body: JSON.stringify({
          display_name: draft.display_name.trim() || null,
          enabled: draft.enabled,
          notes: draft.notes.trim() || null,
          priority: draft.priority,
        }),
        method: "PUT",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Save failed"));
      }

      const updated = payload as OmniModelConfig;
      setAdminConfigs((prev) =>
        prev.map((item) => (item.id === configId ? updated : item))
      );
      setAdminDrafts((prev) => ({ ...prev, [configId]: buildDraft(updated) }));
      toast.success("Model config updated");
      invalidateUserPreferences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingConfigId(null);
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm("Remove this model config from the registry?")) {
      return;
    }

    setDeletingConfigId(configId);
    try {
      const response = await fetch(`${API_BASE}/${configId}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(readErrorMessage(payload, "Delete failed"));
      }

      setAdminConfigs((prev) => prev.filter((item) => item.id !== configId));
      setAdminDrafts((prev) => {
        const next = { ...prev };
        delete next[configId];
        return next;
      });
      toast.success("Model config removed");
      invalidateUserPreferences();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingConfigId(null);
    }
  };

  const handleTestModel = async (configId: string, modelId: string) => {
    setTestingConfigId(configId);
    try {
      const response = await fetch(`${API_BASE}/test`, {
        body: JSON.stringify({ model_id: modelId }),
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as
        | ModelTestResult
        | { error?: string };

      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Model test failed"));
      }

      const result = payload as ModelTestResult;
      const title = `${result.model_id} (${result.elapsed_s}s)`;
      if (result.status === "ok") {
        toast.success(`${title}: ${summarizeTestResult(result)}`);
      } else {
        toast.error(`${title}: ${summarizeTestResult(result)}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Model test failed");
    } finally {
      setTestingConfigId(null);
    }
  };

  const filteredAdminConfigs = useMemo(() => {
    if (!deferredSearch.trim()) {
      return adminConfigs;
    }
    const query = deferredSearch.trim().toLowerCase();
    return adminConfigs.filter((config) =>
      [config.model_id, config.display_name, config.role, config.notes]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [adminConfigs, deferredSearch]);

  const modelIdSuggestions = useMemo(() => {
    return [...new Set(adminConfigs.map((config) => config.model_id))]
      .filter((modelId) => modelId.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [adminConfigs]);

  return (
    <SettingsPageContent className="gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-muted/50 pr-10 pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search model"
            value={search}
          />
        </div>

        <Button
          onClick={() => {
            void loadAdminConfigs();
            invalidateUserPreferences();
          }}
          size="icon"
          title="Refresh list"
          variant="ghost"
        >
          <RefreshCw className="size-4" />
        </Button>

        <Button
          disabled={syncing}
          onClick={handleSync}
          size="sm"
          title="Fetch models from OmniRoute provider"
          variant="outline"
        >
          {syncing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <CloudDownload className="mr-2 size-4" />
          )}
          Sync OmniRoute
        </Button>

        <Button
          disabled={reloading}
          onClick={handleReload}
          size="sm"
          title="Reload model registry from backend config"
          variant="outline"
        >
          {reloading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 size-4" />
          )}
          Reload Registry
        </Button>
      </div>

      <SettingsPageScrollArea className="px-1">
        <div className="space-y-4 pb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chat Model Preferences</CardTitle>
              <CardDescription>
                User-level model enable/disable preferences used by the Chat selector.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModelsTable className="block" search={deferredSearch} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Model Registry (Admin)</CardTitle>
              <CardDescription>
                Global orchestration registry with role, priority, enabled state, and model test.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm">Create Model Config</h4>
                  <Badge variant="outline">
                    {filteredAdminConfigs.length} visible / {adminConfigs.length} total
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1 xl:col-span-2">
                    <Label htmlFor="new-model-id">Model ID</Label>
                    <Input
                      id="new-model-id"
                      list="model-id-suggestions"
                      onChange={(event) => setNewModelId(event.target.value)}
                      placeholder="openai/gpt-4o-mini"
                      value={newModelId}
                    />
                    <datalist id="model-id-suggestions">
                      {modelIdSuggestions.map((modelId) => (
                        <option key={modelId} value={modelId} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="new-role">Role</Label>
                    <Select
                      onValueChange={(value) => setNewRole(value as ModelRole)}
                      value={newRole}
                    >
                      <SelectTrigger id="new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="new-priority">Priority</Label>
                    <Input
                      id="new-priority"
                      inputMode="numeric"
                      onChange={(event) => setNewPriority(event.target.value)}
                      value={newPriority}
                    />
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-enabled">Enabled</Label>
                      <div className="pt-2">
                        <Switch
                          checked={newEnabled}
                          id="new-enabled"
                          onCheckedChange={setNewEnabled}
                        />
                      </div>
                    </div>
                    <Button
                      disabled={creatingConfig}
                      onClick={handleCreateConfig}
                      size="sm"
                      type="button"
                    >
                      {creatingConfig ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 size-4" />
                      )}
                      Create
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-display-name">Display name (optional)</Label>
                    <Input
                      id="new-display-name"
                      onChange={(event) => setNewDisplayName(event.target.value)}
                      placeholder="GPT-4o mini"
                      value={newDisplayName}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-notes">Notes (optional)</Label>
                    <Input
                      id="new-notes"
                      onChange={(event) => setNewNotes(event.target.value)}
                      placeholder="Used for worker role in council mode"
                      value={newNotes}
                    />
                  </div>
                </div>
              </div>

              {adminError ? (
                <p className="text-destructive text-sm">{adminError}</p>
              ) : null}

              {adminLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAdminConfigs.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground text-sm">
                  No model configs found for the current search.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="w-[120px]">Priority</TableHead>
                        <TableHead className="w-[110px]">Enabled</TableHead>
                        <TableHead className="w-[300px]">Notes</TableHead>
                        <TableHead className="w-[280px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdminConfigs.map((config) => {
                        const draft = adminDrafts[config.id] ?? buildDraft(config);
                        const isDirty = hasDraftChanges(config, draft);
                        const isSaving = savingConfigId === config.id;
                        const isDeleting = deletingConfigId === config.id;
                        const isTesting = testingConfigId === config.id;
                        return (
                          <TableRow key={config.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-mono text-xs">{config.model_id}</p>
                                <Input
                                  onChange={(event) => {
                                    setAdminDrafts((prev) => ({
                                      ...prev,
                                      [config.id]: {
                                        ...draft,
                                        display_name: event.target.value,
                                      },
                                    }));
                                  }}
                                  placeholder="Display name"
                                  value={draft.display_name}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  ROLE_COLORS[config.role] ||
                                  "bg-muted text-muted-foreground"
                                }
                                variant="outline"
                              >
                                {config.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                inputMode="numeric"
                                onChange={(event) => {
                                  const nextPriority = parsePriority(event.target.value);
                                  setAdminDrafts((prev) => ({
                                    ...prev,
                                    [config.id]: { ...draft, priority: nextPriority },
                                  }));
                                }}
                                value={String(draft.priority)}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={draft.enabled}
                                onCheckedChange={(value) => {
                                  setAdminDrafts((prev) => ({
                                    ...prev,
                                    [config.id]: { ...draft, enabled: value },
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                onChange={(event) => {
                                  setAdminDrafts((prev) => ({
                                    ...prev,
                                    [config.id]: {
                                      ...draft,
                                      notes: event.target.value,
                                    },
                                  }));
                                }}
                                placeholder="Optional notes"
                                value={draft.notes}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  disabled={isSaving || isDeleting || !isDirty}
                                  onClick={() => handleSaveConfig(config.id)}
                                  size="sm"
                                  type="button"
                                  variant={isDirty ? "default" : "outline"}
                                >
                                  {isSaving ? (
                                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                                  ) : (
                                    <Save className="mr-1 size-3.5" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  disabled={isSaving || isDeleting || isTesting}
                                  onClick={() =>
                                    handleTestModel(config.id, config.model_id)
                                  }
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {isTesting ? (
                                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                                  ) : (
                                    <FlaskConical className="mr-1 size-3.5" />
                                  )}
                                  Test
                                </Button>
                                <Button
                                  disabled={isSaving || isDeleting}
                                  onClick={() => handleDeleteConfig(config.id)}
                                  size="sm"
                                  type="button"
                                  variant="destructive"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-1 size-3.5" />
                                  )}
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SettingsPageScrollArea>
    </SettingsPageContent>
  );
}
