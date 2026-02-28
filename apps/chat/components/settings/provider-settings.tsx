"use client";

import { Eye, EyeOff, Loader2, RotateCcw, Save, Server } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
} from "./settings-page";

interface ProviderConfig {
  api_key: string;
  base_url: string;
  source: string;
}

const API_BASE = "/api/omnichat";

export function ProviderSettings() {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/provider-config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setBaseUrl(data.base_url);
        setApiKeyInput("");
      }
    } catch {
      // Backend might not support this yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/provider-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: baseUrl,
          ...(apiKeyInput.trim() ? { api_key: apiKeyInput.trim() } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      const data = await res.json();
      setConfig(data);
      setApiKeyInput("");
      setMessage({
        text: "Provider config saved — will persist across restarts",
        type: "success",
      });
    } catch (e) {
      setMessage({
        text: `Failed to save: ${e instanceof Error ? e.message : "Unknown"}`,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/provider-config/reset`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to reset");
      }
      const data = await res.json();
      setConfig(data);
      setBaseUrl(data.base_url);
      setApiKeyInput("");
      setMessage({ text: "Reset to .env defaults", type: "success" });
    } catch (e) {
      setMessage({
        text: `Failed to reset: ${e instanceof Error ? e.message : "Unknown"}`,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    !!config && (baseUrl !== config.base_url || apiKeyInput.trim().length > 0);

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
        <h2 className="font-semibold text-lg">LLM Provider</h2>
        <p className="text-muted-foreground text-sm">
          Configure your OpenAI-compatible API endpoint. Database overrides take
          precedence over .env values.
        </p>
      </SettingsPageHeader>

      <SettingsPageContent>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="size-4" />
                Connection
              </CardTitle>
              {config && (
                <Badge
                  variant={
                    config.source === "database" ? "default" : "secondary"
                  }
                >
                  {config.source === "database"
                    ? "💾 Custom (DB)"
                    : "📄 From .env"}
                </Badge>
              )}
            </div>
            <CardDescription>
              OpenAI-compatible endpoint (e.g. OmniRoute, OpenRouter, OpenAI)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input
                id="base-url"
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:8080/v1"
                value={baseUrl}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  id="api-key"
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    config?.api_key
                      ? `Current key: ${config.api_key}`
                      : "sk-..."
                  }
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                />
                <Button
                  onClick={() => setShowKey(!showKey)}
                  size="icon"
                  title={showKey ? "Hide" : "Show"}
                  variant="outline"
                >
                  {showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t pt-4">
              <Button
                disabled={saving || !hasChanges}
                onClick={handleSave}
                size="sm"
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save Provider
              </Button>

              {config?.source === "database" && (
                <Button
                  disabled={saving}
                  onClick={handleReset}
                  size="sm"
                  variant="outline"
                >
                  <RotateCcw className="mr-2 size-4" />
                  Reset to .env
                </Button>
              )}

              {message && (
                <span
                  className={`text-sm ${message.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                >
                  {message.type === "success" ? "✓" : "✗"} {message.text}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </SettingsPageContent>
    </SettingsPage>
  );
}
