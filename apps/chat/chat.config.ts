import type { ConfigInput } from "@/lib/config-schema";

const isProd = process.env.NODE_ENV === "production";

/**
 * OmniChatAgent — Chat.js Frontend Configuration
 *
 * This is the second frontend for the OmniChatAgent project.
 * It connects to the OmniRoute backend via the OpenAI-compatible gateway.
 *
 * @see https://chatjs.dev/docs/reference/config
 */
const config = {
  appPrefix: "omnichat",
  appName: "OmniChatAgent",
  appTitle: "OmniChatAgent — Multi-Agent AI Chat",
  appDescription:
    "Advanced AI chat with multi-agent orchestration, debate, self-refine, tree-of-thought, and 120+ models via OmniRoute gateway.",
  appUrl: isProd ? "https://omnichat.local" : "http://localhost:3001",
  organization: {
    name: "OmniChatAgent",
    contact: {
      privacyEmail: "privacy@omnichat.local",
      legalEmail: "legal@omnichat.local",
    },
  },
  services: {
    hosting: "Self-Hosted",
    aiProviders: [
      "OpenAI",
      "Anthropic",
      "Google",
      "DeepSeek",
      "Mistral",
      "Meta",
      "Cohere",
    ],
    paymentProcessors: [],
  },
  features: {
    attachments: false, // Disabled — requires BLOB_READ_WRITE_TOKEN
  },
  legal: {
    minimumAge: 13,
    governingLaw: "Brazil",
    refundPolicy: "no-refunds",
  },
  policies: {
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "February 26, 2026",
    },
    terms: {
      title: "Terms of Service",
      lastUpdated: "February 26, 2026",
    },
  },
  authentication: {
    google: false,
    github: false, // Requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET — enable when configured
    vercel: false,
  },
  ai: {
    // ── OmniRoute Gateway ──────────────────────────────
    // Connects to our FastAPI backend which is OpenAI-compatible
    gateway: "openai-compatible",

    providerOrder: ["anthropic", "openai", "google"],

    // Models available through OmniRoute
    // These will be auto-fetched from /v1/models
    curatedDefaults: [
      // Anthropic (via OmniRoute prefixes)
      "kr/claude-haiku-4.5",
      "kr/claude-sonnet-4.5",
      "kr/claude-opus-4.5",
      // OpenAI
      "openai/gpt-4o-mini",
      "openai/gpt-4o",
      // Google
      "google/gemini-2.5-flash-lite",
      "google/gemini-3-flash",
    ],
    anonymousModels: [
      "kr/claude-haiku-4.5",
      "google/gemini-2.5-flash-lite",
    ],
    disabledModels: [],

    workflows: {
      chat: "openai/gpt-5-mini",
      title: "google/gemini-2.5-flash-lite",
      pdf: "openai/gpt-5-mini",
      chatImageCompatible: "openai/gpt-4o-mini",
    },

    tools: {
      webSearch: {
        enabled: true, // TAVILY_API_KEY configured
      },
      urlRetrieval: {
        enabled: false, // Will be enabled when adapter is ready
      },
      codeExecution: {
        enabled: false, // Requires Vercel sandbox — disable for self-hosted
      },
      mcp: {
        enabled: false, // Requires MCP_ENCRYPTION_KEY — enable when configured
      },
      followupSuggestions: {
        enabled: true,
        default: "google/gemini-2.5-flash-lite",
      },
      text: {
        polish: "kr/claude-sonnet-4.5",
      },
      sheet: {
        format: "kr/claude-haiku-4.5",
        analyze: "kr/claude-sonnet-4.5",
      },
      code: {
        edits: "kr/claude-sonnet-4.5",
      },
      image: {
        enabled: false, // Will be enabled when blob storage is configured
        default: "openai/dall-e-3",
      },
      video: {
        enabled: false, // Not available in self-hosted mode
        default: "none",
      },
      deepResearch: {
        enabled: false, // Requires TAVILY_API_KEY — enable when configured
        defaultModel: "kr/claude-haiku-4.5",
        finalReportModel: "kr/claude-sonnet-4.5",
        allowClarification: true,
        maxResearcherIterations: 1,
        maxConcurrentResearchUnits: 2,
        maxSearchQueries: 2,
      },
    },
  },
  anonymous: {
    credits: isProd ? 10 : 1000,
    availableTools: [],
    rateLimit: {
      requestsPerMinute: isProd ? 5 : 60,
      requestsPerMonth: isProd ? 10 : 1000,
    },
  },
  attachments: {
    maxBytes: 1024 * 1024, // 1MB
    maxDimension: 2048,
    acceptedTypes: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
  },
} satisfies ConfigInput;

export default config;
