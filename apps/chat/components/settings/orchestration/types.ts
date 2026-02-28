"use client";

export interface OmniMode {
  name: string;
  value: string;
  description: string;
  workers: string;
  family: string;
}

export interface OmniModelConfig {
  id: string;
  model_id: string;
  role: string;
  priority: number;
  enabled: boolean;
  display_name?: string;
  notes?: string;
}

export interface OmniModeConfig {
  id: string;
  mode: string;
  model_id: string;
  role: string;
  priority: number;
  enabled: boolean;
  compute_level?: number;
  notes?: string;
}

export interface OmniPrompt {
  id: string;
  name: string;
  content: string;
  template?: string;
  version: number;
  is_active: boolean;
  description?: string;
}

export interface HealthStatus {
  status: string;
  components?: Record<string, string | { status: string; latency_ms?: number }>;
}
