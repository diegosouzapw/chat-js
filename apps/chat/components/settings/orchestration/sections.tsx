"use client";

import {
  ActivityIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  RefreshCwIcon,
  ServerIcon,
  SlidersIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODE_ICONS, ROLE_COLORS } from "./constants";
import type {
  HealthStatus,
  OmniMode,
  OmniModeConfig,
  OmniModelConfig,
  OmniPrompt,
} from "./types";

export function HealthStatusCard({
  error,
  fetchData,
  health,
  loading,
}: {
  error: string | null;
  fetchData: () => Promise<void>;
  health: HealthStatus | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ServerIcon className="size-4" />
            OmniChatAgent Backend
          </CardTitle>
          <CardDescription>Connection status and component health</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void fetchData()}
          disabled={loading}
        >
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircleIcon className="size-4" />
            {error}
          </div>
        ) : health ? (
          <div className="flex flex-wrap gap-3">
            <Badge
              variant={
                ["ok", "healthy"].includes(health.status)
                  ? "default"
                  : "destructive"
              }
              className="gap-1"
            >
              {["ok", "healthy"].includes(health.status) ? (
                <CheckCircle2Icon className="size-3" />
              ) : (
                <XCircleIcon className="size-3" />
              )}
              {health.status}
            </Badge>
            {health.components &&
              Object.entries(health.components).map(([name, comp]) => {
                const compStatus = typeof comp === "string" ? comp : comp.status;
                const isOk = ["ok", "healthy"].includes(compStatus);
                const latency =
                  typeof comp === "object" ? comp.latency_ms : undefined;
                return (
                  <Badge key={name} variant="outline" className="gap-1 text-xs">
                    {isOk ? (
                      <CheckCircle2Icon className="size-3 text-green-500" />
                    ) : (
                      <XCircleIcon className="size-3 text-red-500" />
                    )}
                    {name}
                    {latency && (
                      <span className="text-muted-foreground">{latency}ms</span>
                    )}
                  </Badge>
                );
              })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ActivityIcon className="size-4" />
            Connecting...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ModesTableCard({
  loading,
  modes,
}: {
  loading: boolean;
  modes: OmniMode[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrainCircuitIcon className="size-4" />
          Orchestration Modes
        </CardTitle>
        <CardDescription>
          Available multi-agent orchestration patterns ({modes.length} modes)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Mode</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px] text-right">Workers</TableHead>
              <TableHead className="w-[100px] text-right">Family</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modes.map((mode) => (
              <TableRow key={mode.value}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {MODE_ICONS[mode.value] || <SparklesIcon className="size-4" />}
                    {mode.name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {mode.description}
                </TableCell>
                <TableCell className="text-right text-sm">{mode.workers}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-xs">
                    {mode.family}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {modes.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No modes available — backend may be offline
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ModeConfigsCard({
  loading,
  modeConfigs,
}: {
  loading: boolean;
  modeConfigs: OmniModeConfig[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersIcon className="size-4" />
          Mode → Model Assignments
        </CardTitle>
        <CardDescription>
          Which models are assigned to each orchestration mode (
          {modeConfigs.length} configs)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {modeConfigs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Mode</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-[90px]">Role</TableHead>
                <TableHead className="w-[70px] text-right">Priority</TableHead>
                <TableHead className="w-[70px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modeConfigs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {MODE_ICONS[cfg.mode] || <SparklesIcon className="size-4" />}
                      {cfg.mode}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{cfg.model_id}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        ROLE_COLORS[cfg.role] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {cfg.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{cfg.priority}</TableCell>
                  <TableCell className="text-right">
                    {cfg.enabled ? (
                      <CheckCircle2Icon className="ml-auto size-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="ml-auto size-4 text-red-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : "No mode-model assignments found — backend may be offline or no configs set"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ModelRegistryCard({
  loading,
  modelConfigs,
}: {
  loading: boolean;
  modelConfigs: OmniModelConfig[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ActivityIcon className="size-4" />
          Model Registry
        </CardTitle>
        <CardDescription>
          Backend model role assignments ({modelConfigs.length} configs)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {modelConfigs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="w-[100px]">Role</TableHead>
                <TableHead className="w-[80px] text-right">Priority</TableHead>
                <TableHead className="w-[80px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelConfigs.map((cfg) => (
                <TableRow key={cfg.id}>
                  <TableCell className="font-mono text-sm">
                    {cfg.display_name || cfg.model_id}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        ROLE_COLORS[cfg.role] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {cfg.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{cfg.priority}</TableCell>
                  <TableCell className="text-right">
                    {cfg.enabled ? (
                      <CheckCircle2Icon className="ml-auto size-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="ml-auto size-4 text-red-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : "No model configs found — backend may be offline"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PromptTemplatesCard({
  loading,
  prompts,
}: {
  loading: boolean;
  prompts: OmniPrompt[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileTextIcon className="size-4" />
          Prompt Templates
        </CardTitle>
        <CardDescription>
          System prompt templates and versions ({prompts.length} prompts)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {prompts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[80px] text-right">Version</TableHead>
                <TableHead className="w-[80px] text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium font-mono text-sm">
                    {prompt.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {prompt.description || (
                      <span className="italic">
                        {(prompt.content || prompt.template || "").slice(0, 80)}...
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-xs">
                      v{prompt.version}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {prompt.is_active ? (
                      <CheckCircle2Icon className="ml-auto size-4 text-green-500" />
                    ) : (
                      <XCircleIcon className="ml-auto size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : "No prompts found — backend may be offline"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
