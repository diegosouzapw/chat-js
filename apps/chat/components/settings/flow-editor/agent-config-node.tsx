"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ROLE_COLORS } from "@/lib/mode-topology";

export interface AgentConfigNodeData {
  [key: string]: unknown;
  label: string;
  icon: string;
  role: string;
  description: string;
  stepLabel?: string;
  currentModel?: string;
  configId?: string;
  availableModels: string[];
  defaultModel?: string;
  onModelChange: (
    nodeId: string,
    modelId: string | null,
    configId?: string
  ) => void;
  noModelSelector?: boolean;
}

const AgentConfigNode = memo(function AgentConfigNode({
  id,
  data,
}: NodeProps) {
  const {
    label,
    icon,
    role,
    description,
    currentModel,
    configId,
    availableModels,
    defaultModel,
    onModelChange,
    noModelSelector,
  } = data as AgentConfigNodeData;

  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const colors = ROLE_COLORS[role] || ROLE_COLORS.worker;
  const isConfigured = !!currentModel;
  const isMissing = isConfigured && !availableModels.includes(currentModel);

  const filteredModels = useMemo(() => {
    const sorted = [...availableModels].sort((a, b) => a.localeCompare(b));
    if (!searchText) return sorted;
    const q = searchText.toLowerCase();
    return sorted.filter((m) => m.toLowerCase().includes(q));
  }, [availableModels, searchText]);

  const handleClear = useCallback(() => {
    onModelChange(id, null, configId);
    setDropdownOpen(false);
    setSearchText("");
  }, [id, configId, onModelChange]);

  const handleSelect = useCallback(
    (modelId: string) => {
      onModelChange(id, modelId, configId);
      setDropdownOpen(false);
      setSearchText("");
    },
    [id, configId, onModelChange]
  );

  const displayModel = currentModel?.split("/").pop() ?? currentModel;
  const displayDefault = defaultModel?.split("/").pop() ?? defaultModel;

  return (
    <div
      className="nopan nodrag nowheel"
      style={{
        minWidth: 200,
        maxWidth: 240,
        borderRadius: 10,
        border: `${isMissing ? "2px" : "1px"} solid ${isMissing ? "#ef4444" : isConfigured ? colors.border : "rgba(255,255,255,0.1)"}`,
        padding: "10px 12px",
        fontFamily: "inherit",
        transition: "border-color 0.2s, box-shadow 0.2s",
        position: "relative",
        background: colors.bg,
        color: colors.text,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: colors.border, width: 8, height: 8 }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 10,
              opacity: 0.6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {role === "passthrough" ? "PASS-THROUGH" : role}
          </div>
        </div>
        {isConfigured && !noModelSelector && (
          <button
            className="nopan nodrag"
            onClick={handleClear}
            title="Remove override"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.4,
              fontSize: 12,
              padding: "2px 4px",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {noModelSelector ? (
        <>
          <div
            style={{
              padding: "6px 10px",
              marginBottom: 8,
              background: "rgba(100, 116, 139, 0.1)",
              border: "1px solid rgba(100, 116, 139, 0.2)",
              borderRadius: 6,
              fontSize: 11,
              color: "#94a3b8",
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#64748b",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, opacity: 0.7 }}>No LLM call</span>
          </div>
        </>
      ) : (
        <>
          {/* Searchable Dropdown */}
          <div
            style={{ marginBottom: 8, position: "relative" }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="nopan nodrag"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "5px 10px",
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${isMissing ? "#ef4444" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 6,
                cursor: "pointer",
                color: isMissing ? "#ef4444" : colors.text,
                fontSize: 12,
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
              onClick={() => setDropdownOpen((prev) => !prev)}
              title={description}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isMissing
                  ? `⚠️ ${displayModel}`
                  : isConfigured
                    ? displayModel
                    : `↳ ${displayDefault || "Default"}`}
              </span>
              <span style={{ opacity: 0.5, fontSize: 10 }}>
                {dropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {dropdownOpen && (
              <div
                className="nopan nodrag nowheel"
                style={{
                  position: "absolute",
                  zIndex: 9999,
                  left: 0,
                  right: 0,
                  marginTop: 2,
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
                  maxHeight: 220,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <input
                    autoFocus
                    placeholder="🔍 Search model..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.06)",
                      border: "none",
                      borderRadius: 4,
                      color: "#e2e8f0",
                      fontSize: 11,
                      padding: "4px 8px",
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                <div
                  style={{
                    padding: "5px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    color: "#64748b",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    fontFamily: "monospace",
                  }}
                  onClick={() => handleClear()}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.06)")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  ↳ {displayDefault || "— Use default —"}
                </div>

                <div
                  style={{ overflowY: "auto", flex: 1 }}
                  className="nowheel"
                >
                  {filteredModels.length === 0 && (
                    <div
                      style={{
                        padding: "8px 10px",
                        fontSize: 11,
                        color: "#475569",
                        textAlign: "center",
                      }}
                    >
                      No results
                    </div>
                  )}
                  {filteredModels.map((m) => (
                    <div
                      key={m}
                      style={{
                        padding: "5px 10px",
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "monospace",
                        background:
                          currentModel === m
                            ? `${colors.border}25`
                            : "transparent",
                        color: currentModel === m ? colors.border : "#cbd5e1",
                        fontWeight: currentModel === m ? 700 : 400,
                      }}
                      onClick={() => handleSelect(m)}
                      onMouseOver={(e) => {
                        if (currentModel !== m)
                          e.currentTarget.style.background =
                            "rgba(255,255,255,0.06)";
                      }}
                      onMouseOut={(e) => {
                        if (currentModel !== m)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                background: isMissing
                  ? "#ef4444"
                  : isConfigured
                    ? colors.border
                    : "#475569",
                boxShadow: isMissing
                  ? "0 0 6px #ef444480"
                  : isConfigured
                    ? `0 0 6px ${colors.border}40`
                    : "none",
              }}
            />
            <span
              style={{
                fontSize: 10,
                opacity: 0.7,
                color: isMissing ? "#ef4444" : "inherit",
              }}
            >
              {isMissing
                ? "Missing Model"
                : isConfigured
                  ? "Custom Model"
                  : "Default Config"}
            </span>
          </div>
        </>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: colors.border, width: 8, height: 8 }}
      />
    </div>
  );
});

export default AgentConfigNode;
