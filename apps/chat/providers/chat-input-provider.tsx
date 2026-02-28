"use client";

import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LexicalChatInputRef } from "@/components/lexical-chat-input";
import type { AppModelId } from "@/lib/ai/app-models";
import type { Attachment, UiToolName } from "@/lib/ai/types";
import { useChatModels } from "./chat-models-provider";
import { useDefaultModel, useModelChange } from "./default-model-provider";

const GENERAL_SETTINGS_STORAGE_KEY = "omnichatagent_settings";
const CHAT_MODE_STORAGE_KEY = "omnichatagent_chat_mode";
const CHAT_OUTPUT_LANGUAGE_STORAGE_KEY = "omnichatagent_chat_output_language";

type ComputeLevel = 3 | 5 | 7;

function getGeneralSettingValue(key: string): unknown {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = localStorage.getItem(GENERAL_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Array<{ key?: string; value?: unknown }>;
    const found = parsed.find((entry) => entry?.key === key);
    return found?.value;
  } catch {
    return undefined;
  }
}

function getInitialMode(): string {
  if (typeof window === "undefined") {
    return "auto";
  }

  try {
    return localStorage.getItem(CHAT_MODE_STORAGE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function getInitialComputeLevel(): ComputeLevel | null {
  const raw = getGeneralSettingValue("compute_level");
  if (raw === 3 || raw === 5 || raw === 7) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (parsed === 3 || parsed === 5 || parsed === 7) {
      return parsed;
    }
  }
  return null;
}

function getInitialOutputLanguage(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(CHAT_OUTPUT_LANGUAGE_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim().slice(0, 16);
      }
    } catch {
      // Ignore storage errors and continue with general settings fallback.
    }
  }

  const raw = getGeneralSettingValue("output_language");
  if (typeof raw !== "string") {
    return "pt-BR";
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 16) : "pt-BR";
}

function normalizeOutputLanguage(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 16) : "pt-BR";
}

function persistOutputLanguageToGeneralSettings(value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = localStorage.getItem(GENERAL_SETTINGS_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Array<{ key?: string; value?: unknown }>)
      : [];

    const next = [...parsed];
    const index = next.findIndex((entry) => entry?.key === "output_language");
    if (index >= 0) {
      next[index] = {
        ...next[index],
        key: "output_language",
        value,
      };
    } else {
      next.push({
        key: "output_language",
        value,
      });
    }

    localStorage.setItem(GENERAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

interface ChatInputContextType {
  attachments: Attachment[];
  editorRef: React.RefObject<LexicalChatInputRef | null>;
  getInitialInput: () => string;
  getInputValue: () => string;
  handleInputChange: (value: string) => void;
  handleModeChange: (mode: string) => void;
  handleOutputLanguageChange: (language: string) => void;
  handleModelChange: (modelId: AppModelId) => Promise<void>;
  handleSubmit: (submitFn: () => void, isEditMode?: boolean) => void;
  isEmpty: boolean;
  isProjectContext: boolean;
  selectedComputeLevel: ComputeLevel | null;
  selectedModelId: AppModelId;
  selectedMode: string;
  selectedOutputLanguage: string;
  selectedTool: UiToolName | null;
  setSelectedComputeLevel: Dispatch<SetStateAction<ComputeLevel | null>>;
  setSelectedOutputLanguage: Dispatch<SetStateAction<string>>;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
}

const ChatInputContext = createContext<ChatInputContextType | undefined>(
  undefined
);

interface ChatInputProviderProps {
  children: ReactNode;
  initialAttachments?: Attachment[];
  initialInput?: string;
  initialTool?: UiToolName | null;
  isProjectContext?: boolean;
  localStorageEnabled?: boolean;
  overrideModelId?: AppModelId; // For message editing where we want to use the original model
}

export function ChatInputProvider({
  children,
  initialInput = "",
  initialTool = null,
  initialAttachments = [],
  overrideModelId,
  localStorageEnabled = true,
  isProjectContext = false,
}: ChatInputProviderProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Helper functions for localStorage access without state
  const getLocalStorageInput = useCallback(() => {
    if (!localStorageEnabled) {
      return "";
    }
    try {
      return localStorage.getItem("input") || "";
    } catch {
      return "";
    }
  }, [localStorageEnabled]);

  const setLocalStorageInput = useCallback(
    (value: string) => {
      if (!localStorageEnabled) {
        return;
      }
      try {
        localStorage.setItem("input", value);
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [localStorageEnabled]
  );

  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();

  // Initialize selectedModelId from override or default model
  const [selectedModelId, setSelectedModelId] = useState<AppModelId>(
    overrideModelId || defaultModel
  );

  // IMPORTANT: do not read localStorage during initial render.
  // Next SSRs client components; localStorage is client-only and will cause hydration mismatches
  // (e.g., submit button `disabled` stuck from server HTML).
  const inputValueRef = useRef<string>(initialInput);

  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
    initialTool
  );
  const [selectedMode, setSelectedMode] = useState<string>(() =>
    getInitialMode()
  );
  const [selectedComputeLevel, setSelectedComputeLevel] =
    useState<ComputeLevel | null>(() => getInitialComputeLevel());
  const [selectedOutputLanguage, setSelectedOutputLanguageState] =
    useState<string>(() => getInitialOutputLanguage());
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);

  // Track if input is empty for reactive UI updates
  const [isEmpty, setIsEmpty] = useState<boolean>(
    () => initialInput.trim().length === 0
  );

  // Create ref for lexical editor
  const editorRef = useRef<LexicalChatInputRef | null>(null);

  // Get the initial input value from localStorage if enabled and no initial input provided
  const getInitialInput = useCallback(() => {
    if (!localStorageEnabled) {
      return initialInput;
    }
    if (!hasHydrated) {
      return initialInput;
    }
    return initialInput || getLocalStorageInput();
  }, [initialInput, getLocalStorageInput, localStorageEnabled, hasHydrated]);

  const { getModelById } = useChatModels();

  const handleModelChange = useCallback(
    async (modelId: AppModelId) => {
      const modelDef = getModelById(modelId);

      // If switching to a model with unspecified features, disable all tools
      if (!modelDef?.input && selectedTool !== null) {
        setSelectedTool(null);
      }

      // Update local state immediately
      setSelectedModelId(modelId);

      // Update global default model (which handles cookie persistence)
      await changeModel(modelId);
    },
    [selectedTool, changeModel, getModelById]
  );

  const handleModeChange = useCallback((mode: string) => {
    const normalizedMode = mode?.trim() || "auto";
    setSelectedMode(normalizedMode);

    try {
      localStorage.setItem(CHAT_MODE_STORAGE_KEY, normalizedMode);
    } catch {
      // Silently ignore storage failures (private mode, disabled storage, etc.)
    }
  }, []);

  const persistSelectedOutputLanguage = useCallback((value: string) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(CHAT_OUTPUT_LANGUAGE_STORAGE_KEY, value);
    } catch {
      // Ignore storage errors.
    }

    persistOutputLanguageToGeneralSettings(value);
  }, []);

  const setSelectedOutputLanguage = useCallback<Dispatch<SetStateAction<string>>>(
    (value) => {
      setSelectedOutputLanguageState((previous) => {
        const resolved =
          typeof value === "function"
            ? (value as (prevState: string) => string)(previous)
            : value;
        const normalized = normalizeOutputLanguage(resolved);
        persistSelectedOutputLanguage(normalized);
        return normalized;
      });
    },
    [persistSelectedOutputLanguage]
  );

  const handleOutputLanguageChange = useCallback(
    (language: string) => {
      setSelectedOutputLanguage(language);
    },
    [setSelectedOutputLanguage]
  );

  const clearInput = useCallback(() => {
    editorRef.current?.clear();
    setLocalStorageInput("");
    inputValueRef.current = "";
    setIsEmpty(true);
  }, [setLocalStorageInput]);

  const resetData = useCallback(() => {
    setSelectedTool(null);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const getInputValue = useCallback(() => inputValueRef.current, []);

  // Save to localStorage when input changes (will be called by the lexical editor)
  const handleInputChange = useCallback(
    (value: string) => {
      if (localStorageEnabled) {
        setLocalStorageInput(value);
      }
      inputValueRef.current = value;
      // Update isEmpty state reactively
      setIsEmpty(value.trim().length === 0);
    },
    [setLocalStorageInput, localStorageEnabled]
  );

  // Unified submit handler that ensures consistent behavior for both Enter key and send button
  const handleSubmit = useCallback(
    (submitFn: () => void, isEditMode = false) => {
      // Call the actual submission function
      submitFn();

      // Clear attachments for all submissions
      clearAttachments();

      // Clear input only when not in edit mode
      if (!isEditMode) {
        clearInput();
      }

      // deepResearch stays active until the research process completes (handled via DataStreamHandler)
      if (selectedTool !== "deepResearch") {
        resetData();
      }
    },
    [clearAttachments, clearInput, selectedTool, resetData]
  );

  return (
    <ChatInputContext.Provider
      value={{
        editorRef,
        selectedTool,
        setSelectedTool,
        attachments,
        setAttachments,
        selectedModelId,
        selectedMode,
        handleModeChange,
        handleOutputLanguageChange,
        selectedComputeLevel,
        setSelectedComputeLevel,
        selectedOutputLanguage,
        setSelectedOutputLanguage,
        handleModelChange,
        getInputValue,
        handleInputChange,
        getInitialInput,
        isEmpty,
        handleSubmit,
        isProjectContext,
      }}
    >
      {children}
    </ChatInputContext.Provider>
  );
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (context === undefined) {
    throw new Error("useChatInput must be used within a ChatInputProvider");
  }
  return context;
}
