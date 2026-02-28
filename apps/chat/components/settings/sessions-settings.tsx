"use client";

import { Clock, Loader2, MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

interface SessionListItem {
  created_at: string;
  id: string;
  message_count: number;
  title: string;
  updated_at: string;
}

interface SessionMessage {
  content: string;
  created_at: string;
  id: string;
  mode?: string | null;
  role: string;
}

interface SessionDetail extends SessionListItem {
  messages: SessionMessage[];
}

interface SessionListProps {
  onSelect: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: SessionListItem[];
}

interface SessionDetailPanelProps {
  deleting: boolean;
  loadingDetail: boolean;
  onDelete: () => void;
  selectedSession: SessionDetail | null;
  selectedSessionId: string | null;
}

const API_BASE = "/api/omnichat";

function formatDate(dateText?: string): string {
  if (!dateText) {
    return "—";
  }

  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function resolveNextSelection(
  items: SessionListItem[],
  currentSelection: string | null,
  keepSelection: boolean
): string | null {
  if (items.length === 0) {
    return null;
  }

  if (!keepSelection) {
    return items[0]?.id ?? null;
  }

  const stillExists = items.some((item) => item.id === currentSelection);
  if (stillExists) {
    return currentSelection;
  }

  return items[0]?.id ?? null;
}

function SessionsList({
  onSelect,
  selectedSessionId,
  sessions,
}: SessionListProps) {
  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <Card
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
            selectedSessionId === session.id ? "border-primary" : ""
          }`}
          key={session.id}
          onClick={() => onSelect(session.id)}
        >
          <CardHeader className="p-3">
            <CardTitle className="truncate text-sm">
              {session.title || "Untitled session"}
            </CardTitle>
            <CardDescription className="truncate font-mono text-[11px]">
              {session.id}
            </CardDescription>
            <div className="flex items-center justify-between gap-2">
              <Badge className="text-xs" variant="secondary">
                {session.message_count} messages
              </Badge>
              <span className="text-muted-foreground text-xs">
                {formatDate(session.updated_at)}
              </span>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function SessionDetailPanel({
  deleting,
  loadingDetail,
  onDelete,
  selectedSession,
  selectedSessionId,
}: SessionDetailPanelProps) {
  if (!selectedSessionId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Select a session to view messages
        </CardContent>
      </Card>
    );
  }

  if (loadingDetail) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!selectedSession) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-sm">
              {selectedSession.title || "Untitled session"}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {selectedSession.id}
            </CardDescription>
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Created: {formatDate(selectedSession.created_at)}
              </span>
              <span>Updated: {formatDate(selectedSession.updated_at)}</span>
            </div>
          </div>
          <Button
            disabled={deleting}
            onClick={onDelete}
            size="sm"
            variant="outline"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
        <CardDescription className="font-mono text-xs">
          {selectedSession.message_count} messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectedSession.messages.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            This session has no messages yet.
          </p>
        ) : (
          <div className="space-y-3">
            {selectedSession.messages.map((message) => (
              <div className="rounded-md border p-3" key={message.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{message.role}</Badge>
                    {message.mode && (
                      <Badge variant="secondary">{message.mode}</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(message.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                  {message.content || "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SessionsSettings() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(
    null
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [sessions, setSessions] = useState<SessionListItem[]>([]);

  const loadSessions = useCallback(
    async (keepSelection = true) => {
      setLoadingSessions(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/sessions`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const items = Array.isArray(data) ? (data as SessionListItem[]) : [];
        const nextSelection = resolveNextSelection(
          items,
          selectedSessionId,
          keepSelection
        );

        setSessions(items);
        setSelectedSessionId(nextSelection);
        if (!nextSelection) {
          setSelectedSession(null);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load sessions"
        );
        setSelectedSession(null);
        setSelectedSessionId(null);
        setSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    },
    [selectedSessionId]
  );

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setLoadingDetail(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as SessionDetail;
      setSelectedSession(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load session detail"
      );
      setSelectedSession(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedSessionId) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/sessions/${selectedSessionId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setSelectedSession(null);
      await loadSessions(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete session"
      );
    } finally {
      setDeleting(false);
    }
  }, [loadSessions, selectedSessionId]);

  useEffect(() => {
    loadSessions(false).catch(() => undefined);
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setSelectedSession(null);
      return;
    }

    loadSessionDetail(selectedSessionId).catch(() => undefined);
  }, [loadSessionDetail, selectedSessionId]);

  let content: ReactNode;
  if (loadingSessions) {
    content = (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (error) {
    content = (
      <Card>
        <CardContent className="py-6 text-center text-destructive text-sm">
          ⚠️ {error}
        </CardContent>
      </Card>
    );
  } else if (sessions.length === 0) {
    content = (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No sessions found.</p>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <SettingsPageScrollArea>
        <div className="grid gap-4 px-1 md:grid-cols-[280px_1fr]">
          <SessionsList
            onSelect={setSelectedSessionId}
            selectedSessionId={selectedSessionId}
            sessions={sessions}
          />
          <div className="space-y-4">
            <SessionDetailPanel
              deleting={deleting}
              loadingDetail={loadingDetail}
              onDelete={handleDeleteSelected}
              selectedSession={selectedSession}
              selectedSessionId={selectedSessionId}
            />
          </div>
        </div>
      </SettingsPageScrollArea>
    );
  }

  return (
    <SettingsPage>
      <SettingsPageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Sessions</h2>
            <p className="text-muted-foreground text-sm">
              Browse session history and full message timeline from backend
            </p>
          </div>
          <Button
            onClick={() => loadSessions(true)}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="mr-2 size-4" />
            Reload
          </Button>
        </div>
      </SettingsPageHeader>

      <SettingsPageContent>{content}</SettingsPageContent>
    </SettingsPage>
  );
}
