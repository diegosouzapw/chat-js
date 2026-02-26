"use client";

import {
  Clock,
  DollarSign,
  Loader2,
  MessageSquare,
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

interface SessionRun {
  run_id: string;
  session_id: string;
  mode: string;
  final_answer: string;
  cost_usd: number;
  latency_ms: number;
  models_used: string[];
  created_at?: string;
}

interface SessionInfo {
  session_id: string;
  runs: SessionRun[];
  total_cost: number;
  total_runs: number;
  created_at?: string;
}

const API_BASE = "/api/omnichat";

export function SessionsSettings() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Backend may return flat array of runs or grouped sessions
      if (Array.isArray(data)) {
        // Group runs by session_id
        const grouped = new Map<string, SessionRun[]>();
        for (const item of data) {
          const sid = item.session_id || item.id || "unknown";
          if (!grouped.has(sid)) grouped.set(sid, []);
          grouped.get(sid)!.push(item);
        }
        const sessionList: SessionInfo[] = [...grouped.entries()].map(
          ([sid, runs]) => ({
            session_id: sid,
            runs,
            total_cost: runs.reduce((s, r) => s + (r.cost_usd || 0), 0),
            total_runs: runs.length,
            created_at: runs[0]?.created_at,
          })
        );
        setSessions(sessionList);
      } else {
        setSessions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectedSessionData = sessions.find(
    (s) => s.session_id === selectedSession
  );

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sessions</h2>
            <p className="text-sm text-muted-foreground">
              Browse orchestration session history and run details
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions}>
            <RefreshCw className="mr-2 size-4" />
            Reload
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
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No sessions found. Sessions are created when you run
                orchestration queries through the backend.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SettingsPageScrollArea>
            <div className="grid gap-4 px-1 md:grid-cols-[280px_1fr]">
              {/* Session list */}
              <div className="space-y-2">
                {sessions.map((s) => (
                  <Card
                    key={s.session_id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedSession === s.session_id
                        ? "border-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedSession(s.session_id)}
                  >
                    <CardHeader className="p-3">
                      <CardTitle className="truncate font-mono text-xs">
                        {s.session_id.slice(0, 12)}…
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {s.total_runs} runs
                        </Badge>
                        {s.total_cost > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ${s.total_cost.toFixed(4)}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Session detail */}
              <div className="space-y-4">
                {!selectedSession ? (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      Select a session to view runs
                    </CardContent>
                  </Card>
                ) : selectedSessionData ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">
                        Session Runs ({selectedSessionData.total_runs})
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {selectedSessionData.session_id}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedSessionData.runs.map((run, idx) => (
                          <div
                            key={run.run_id || idx}
                            className="rounded-md border p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <Badge variant="outline">{run.mode}</Badge>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {run.latency_ms}ms
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="size-3" />$
                                  {(run.cost_usd || 0).toFixed(4)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Zap className="size-3" />
                                  {run.models_used?.length || 0} models
                                </span>
                              </div>
                            </div>
                            <p className="line-clamp-3 text-xs text-muted-foreground">
                              {run.final_answer?.slice(0, 200) || "—"}
                            </p>
                            {run.models_used?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {run.models_used.map((m) => (
                                  <Badge
                                    key={m}
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {m.split("/").pop()}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          </SettingsPageScrollArea>
        )}
      </SettingsPageContent>
    </SettingsPage>
  );
}
