"use client";

import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

const STORAGE_KEY = "omnichatagent_settings";

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: "text" | "toggle" | "select";
  value: string | boolean;
  options?: string[];
}

const DEFAULT_SETTINGS: SettingItem[] = [
  {
    key: "auth_mode",
    label: "Auth Mode",
    description: "Authentication method for API requests",
    type: "select",
    value: "disabled",
    options: ["disabled", "api_key", "oidc"],
  },
  {
    key: "rate_limit_rpm",
    label: "Rate Limit (RPM)",
    description: "Maximum requests per minute per client",
    type: "text",
    value: "60",
  },
  {
    key: "sanitizer_enabled",
    label: "Input Sanitizer",
    description: "Enable prompt injection detection and blocking",
    type: "toggle",
    value: true,
  },
  {
    key: "sanitizer_block",
    label: "Block on Injection",
    description:
      "Block requests when prompt injection is detected (vs. log-only)",
    type: "toggle",
    value: true,
  },
  {
    key: "streaming_default",
    label: "Default SSE Streaming",
    description:
      "Real-time streaming (Server-Sent Events) for progressive response updates",
    type: "toggle",
    value: false,
  },
  {
    key: "output_language",
    label: "Output Language",
    description: "Default language for AI responses",
    type: "select",
    value: "pt-BR",
    options: ["pt-BR", "en", "es", "fr", "de", "it", "ja", "zh"],
  },
];

function loadSettings(): SettingItem[] {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved: SettingItem[] = JSON.parse(raw);
    return DEFAULT_SETTINGS.map((def) => {
      const found = saved.find((s) => s.key === def.key);
      return found ? { ...def, value: found.value } : def;
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const updateSetting = useCallback(
    (key: string, value: string | boolean) => {
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value } : s))
      );
      setSaved(false);
    },
    []
  );

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [settings]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">
          Configure backend behavior and preferences
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">⚙️ Application Settings</CardTitle>
          <CardDescription>
            These settings are saved locally and sent with API requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settings.map((setting) => (
            <div
              key={setting.key}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-medium">{setting.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {setting.description}
                </p>
              </div>

              <div className="shrink-0">
                {setting.type === "text" && (
                  <Input
                    className="w-24 text-right"
                    value={setting.value as string}
                    onChange={(e) =>
                      updateSetting(setting.key, e.target.value)
                    }
                  />
                )}

                {setting.type === "select" && (
                  <Select
                    value={setting.value as string}
                    onValueChange={(v) => updateSetting(setting.key, v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {setting.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {setting.type === "toggle" && (
                  <Switch
                    checked={!!setting.value}
                    onCheckedChange={(v) => updateSetting(setting.key, v)}
                  />
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} size="sm">
              <Save className="mr-2 size-4" />
              Save Settings
            </Button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400">
                ✓ Settings saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
