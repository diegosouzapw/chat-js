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
  base_url: string;
  api_key: string;
  source: string;
}

const API_BASE = "/api/omnichat";

export function ProviderSettings() {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
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
        setApiKey(data.api_key);
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
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setConfig(data);
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
      if (!res.ok) throw new Error("Failed to reset");
      const data = await res.json();
      setConfig(data);
      setBaseUrl(data.base_url);
      setApiKey(data.api_key);
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
    config && (baseUrl !== config.base_url || apiKey !== config.api_key);

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
        <h2 className="text-lg font-semibold">LLM Provider</h2>
        <p className="text-sm text-muted-foreground">
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
                placeholder="http://localhost:8080/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? "Hide" : "Show"}
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
                onClick={handleSave}
                disabled={saving || !hasChanges}
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
                  onClick={handleReset}
                  disabled={saving}
                  variant="outline"
                  size="sm"
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
