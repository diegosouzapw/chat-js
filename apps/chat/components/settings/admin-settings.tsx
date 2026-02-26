"use client";

import {
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  Zap,
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
import {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
} from "./settings-page";

interface AdminStats {
  total_runs?: number;
  total_sessions?: number;
  total_cost_usd?: number;
  avg_latency_ms?: number;
  models_active?: number;
  modes_available?: number;
  uptime_seconds?: number;
  runs_today?: number;
  [key: string]: unknown;
}

const API_BASE = "/api/omnichat";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSettings() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Backend statistics and operational metrics
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadStats}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </SettingsPageHeader>

      <SettingsPageContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-destructive">
              ⚠️ {error}
            </CardContent>
          </Card>
        ) : stats ? (
          <SettingsPageScrollArea>
            <div className="space-y-6 px-1">
              {/* Stats grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Runs"
                  value={stats.total_runs ?? 0}
                  icon={Activity}
                  description={`${stats.runs_today ?? 0} today`}
                />
                <StatCard
                  title="Total Sessions"
                  value={stats.total_sessions ?? 0}
                  icon={BarChart3}
                />
                <StatCard
                  title="Total Cost"
                  value={`$${(stats.total_cost_usd ?? 0).toFixed(2)}`}
                  icon={DollarSign}
                />
                <StatCard
                  title="Avg Latency"
                  value={`${Math.round(stats.avg_latency_ms ?? 0)}ms`}
                  icon={Clock}
                />
              </div>

              {/* Operational stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    System Information
                  </CardTitle>
                  <CardDescription>
                    Backend operational metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Zap className="size-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Active Models</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.models_active ?? "—"} configured
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Activity className="size-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Modes Available</p>
                        <p className="text-xs text-muted-foreground">
                          {stats.modes_available ?? "—"} modes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-md border p-3">
                      <Clock className="size-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Uptime</p>
                        <p className="text-xs text-muted-foreground">
                          {formatUptime(stats.uptime_seconds as number)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Raw stats for discoverability */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(stats).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between border-b py-1.5 last:border-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {key}
                        </span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {typeof value === "number"
                            ? value.toLocaleString()
                            : String(value ?? "null")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </SettingsPageScrollArea>
        ) : null}
      </SettingsPageContent>
    </SettingsPage>
  );
}
