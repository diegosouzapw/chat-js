"use client";

import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
} from "./settings-page";

interface PromptInfo {
  name: string;
  category: string;
  active_version: number;
  description?: string;
  content?: string;
}

interface PromptVersion {
  id: string;
  name: string;
  version: number;
  content: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

const API_BASE = "/api/omnichat";

export function PromptsSettings() {
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/prompts`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPrompts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const loadVersions = async (name: string) => {
    setSelectedPrompt(name);
    setLoadingVersions(true);
    try {
      const res = await fetch(`${API_BASE}/prompts/${name}/versions`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setVersions(data);
      const activeVersion = data.find(
        (v: PromptVersion) => v.is_active
      );
      setNewContent(activeVersion?.content || "");
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedPrompt || !newContent.trim()) return;
    setCreating(true);
    try {
      await fetch(`${API_BASE}/prompts/${selectedPrompt}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
      await loadVersions(selectedPrompt);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (name: string, version: number) => {
    try {
      await fetch(`${API_BASE}/prompts/${name}/activate/${version}`, {
        method: "POST",
      });
      await loadVersions(name);
      await loadPrompts();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <SettingsPage>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Prompt Templates</h2>
            <p className="text-sm text-muted-foreground">
              Manage system prompts with version history
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadPrompts}>
            <RefreshCw className="mr-2 size-4" />
            Reload
          </Button>
        </div>
      </SettingsPageHeader>

      <SettingsPageContent>
        {error ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-destructive">
              ⚠️ {error}
            </CardContent>
          </Card>
        ) : prompts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No prompts found. The backend may not have any prompt templates
                configured yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SettingsPageScrollArea>
            <div className="grid gap-4 px-1 md:grid-cols-[300px_1fr]">
              {/* Prompt list */}
              <div className="space-y-2">
                {prompts.map((p) => (
                  <Card
                    key={p.name}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedPrompt === p.name ? "border-primary" : ""
                    }`}
                    onClick={() => loadVersions(p.name)}
                  >
                    <CardHeader className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <CardTitle className="text-sm">{p.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {p.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          v{p.active_version}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Version detail */}
              <div className="space-y-4">
                {!selectedPrompt ? (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      Select a prompt to view versions
                    </CardContent>
                  </Card>
                ) : loadingVersions ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-12">
                      <Loader2 className="size-6 animate-spin" />
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Edit Content</CardTitle>
                        <CardDescription>
                          Modify and save as a new version
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Textarea
                          value={newContent}
                          onChange={(e) => setNewContent(e.target.value)}
                          rows={10}
                          className="font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={handleCreateVersion}
                          disabled={creating}
                        >
                          {creating ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 size-4" />
                          )}
                          Save as New Version
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          Version History ({versions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {versions.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  v{v.version}
                                </span>
                                {v.is_active && (
                                  <Badge variant="default" className="text-xs">
                                    Active
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(v.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {!v.is_active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleActivate(v.name, v.version)
                                  }
                                >
                                  <CheckCircle className="mr-1 size-3" />
                                  Activate
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </SettingsPageScrollArea>
        )}
      </SettingsPageContent>
    </SettingsPage>
  );
}
