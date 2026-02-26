/**
 * Mode Topology Definitions — Static flow structures for all 9 agent modes.
 * Ported from legacy web/ frontend.
 */

export interface TopologyNode {
  id: string;
  role: string;
  label: string;
  icon: string;
  description: string;
  parallel?: boolean;
  stepLabel?: string;
  noModelSelector?: boolean;
}

export interface TopologyEdge {
  source: string;
  target: string;
  animated?: boolean;
}

export interface ModeTopology {
  mode: string;
  label: string;
  description: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

function makeParallelWorkers(
  count: number,
  opts: {
    prefix: string;
    role: string;
    icon: string;
    labelPrefix: string;
    descPrefix: string;
  },
  parentId: string,
  childId: string
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  for (let i = 1; i <= count; i++) {
    const id = `${opts.prefix}_${i}`;
    nodes.push({
      id,
      role: opts.role,
      label: `${opts.labelPrefix} ${i}`,
      icon: opts.icon,
      description: `${opts.descPrefix} ${i}`,
      stepLabel: `${opts.prefix}_${i}`,
    });
    edges.push({ source: parentId, target: id });
    edges.push({ source: id, target: childId });
  }
  return { nodes, edges };
}

const PASSTHROUGH_NODE: TopologyNode = {
  id: "router",
  role: "passthrough",
  label: "Direct Call",
  icon: "📨",
  description: "Pass-through — no LLM call, mode chosen by user",
  noModelSelector: true,
};

const DIRECT: ModeTopology = {
  mode: "direct",
  label: "Direct",
  description: "Single model call, minimal latency",
  nodes: [
    PASSTHROUGH_NODE,
    {
      id: "worker",
      role: "worker",
      label: "Worker",
      icon: "🤖",
      description: "Single LLM call",
    },
  ],
  edges: [{ source: "router", target: "worker" }],
};

const councilWorkers = makeParallelWorkers(
  7,
  {
    prefix: "worker",
    role: "worker",
    icon: "🤖",
    labelPrefix: "Worker",
    descPrefix: "Council member",
  },
  "router",
  "judge"
);

const COUNCIL: ModeTopology = {
  mode: "council",
  label: "Council",
  description: "Up to 7 workers → Judge synthesizes",
  nodes: [
    PASSTHROUGH_NODE,
    ...councilWorkers.nodes,
    {
      id: "judge",
      role: "judge",
      label: "Judge",
      icon: "⚖️",
      description: "Synthesizes the best response",
    },
  ],
  edges: councilWorkers.edges,
};

const cprWorkers = makeParallelWorkers(
  7,
  {
    prefix: "worker",
    role: "worker",
    icon: "🤖",
    labelPrefix: "Worker",
    descPrefix: "Council member",
  },
  "router",
  "judge"
);

const COUNCIL_PEER_REVIEW: ModeTopology = {
  mode: "council_peer_review",
  label: "Council + Peer Review",
  description: "7 workers → Judge → Peer Review → Chairman",
  nodes: [
    PASSTHROUGH_NODE,
    ...cprWorkers.nodes,
    {
      id: "judge",
      role: "judge",
      label: "Judge",
      icon: "⚖️",
      description: "Initial synthesis",
    },
    {
      id: "peer_review",
      role: "critic",
      label: "Peer Review",
      icon: "🔍",
      description: "Reviews judge decision",
      stepLabel: "peer_reviewer",
    },
    {
      id: "chairman",
      role: "critic",
      label: "Chairman",
      icon: "👔",
      description: "Final decision",
      stepLabel: "chairman",
    },
  ],
  edges: [
    ...cprWorkers.edges,
    { source: "judge", target: "peer_review" },
    { source: "peer_review", target: "chairman" },
  ],
};

const DEBATE: ModeTopology = {
  mode: "debate",
  label: "Debate",
  description: "Multi-persona debate with 3 agents",
  nodes: [
    PASSTHROUGH_NODE,
    {
      id: "strategist",
      role: "worker",
      label: "Strategist",
      icon: "♟️",
      description: "Opens with a strong position",
      stepLabel: "strategist",
    },
    {
      id: "advocate",
      role: "worker",
      label: "Devil's Advocate",
      icon: "😈",
      description: "Challenges the position",
      stepLabel: "advocate",
    },
    {
      id: "mediator",
      role: "worker",
      label: "Mediator",
      icon: "🕊️",
      description: "Synthesizes final response",
      stepLabel: "mediator",
    },
  ],
  edges: [
    { source: "router", target: "strategist" },
    { source: "strategist", target: "advocate" },
    { source: "advocate", target: "mediator" },
  ],
};

const SELF_REFINE: ModeTopology = {
  mode: "self_refine",
  label: "Self Refine",
  description: "Generator → Critic → Researcher → Refiner",
  nodes: [
    PASSTHROUGH_NODE,
    {
      id: "generator",
      role: "worker",
      label: "Generator",
      icon: "✍️",
      description: "Creates initial draft",
      stepLabel: "generator",
    },
    {
      id: "critic",
      role: "critic",
      label: "Critic",
      icon: "🔍",
      description: "Evaluates draft quality",
      stepLabel: "critic",
    },
    {
      id: "researcher",
      role: "worker",
      label: "Researcher",
      icon: "📚",
      description: "Research and fact-check",
      stepLabel: "researcher",
    },
    {
      id: "refiner",
      role: "worker",
      label: "Refiner",
      icon: "💎",
      description: "Produces final refined response",
      stepLabel: "refiner",
    },
  ],
  edges: [
    { source: "router", target: "generator" },
    { source: "generator", target: "critic" },
    { source: "critic", target: "researcher" },
    { source: "researcher", target: "refiner" },
  ],
};

const heavyResearchers = makeParallelWorkers(
  5,
  {
    prefix: "researcher",
    role: "worker",
    icon: "🔬",
    labelPrefix: "Researcher",
    descPrefix: "Research sub-question",
  },
  "planner",
  "synthesizer"
);

const HEAVY: ModeTopology = {
  mode: "heavy",
  label: "Heavy Research",
  description: "Planner → 5 parallel Researchers → Synthesizer",
  nodes: [
    PASSTHROUGH_NODE,
    {
      id: "planner",
      role: "planner",
      label: "Planner",
      icon: "📋",
      description: "Breaks question into sub-questions",
    },
    ...heavyResearchers.nodes,
    {
      id: "synthesizer",
      role: "worker",
      label: "Synthesizer",
      icon: "🧪",
      description: "Combines research into final response",
      stepLabel: "synthesizer",
    },
  ],
  edges: [
    { source: "router", target: "planner" },
    ...heavyResearchers.edges,
  ],
};

const totReasoners = makeParallelWorkers(
  3,
  {
    prefix: "reasoner",
    role: "worker",
    icon: "🧠",
    labelPrefix: "Reasoner",
    descPrefix: "Explores reasoning path",
  },
  "router",
  "validator"
);

const TREE_OF_THOUGHT: ModeTopology = {
  mode: "tree_of_thought",
  label: "Tree of Thought",
  description: "3 Reasoners → Validator → Synthesizer",
  nodes: [
    PASSTHROUGH_NODE,
    ...totReasoners.nodes,
    {
      id: "validator",
      role: "judge",
      label: "Validator",
      icon: "✓",
      description: "Validates and scores reasoning paths",
      stepLabel: "validator",
    },
    {
      id: "synthesizer",
      role: "worker",
      label: "Synthesizer",
      icon: "🧪",
      description: "Combines valid paths into response",
      stepLabel: "synthesizer",
    },
  ],
  edges: [
    ...totReasoners.edges,
    { source: "validator", target: "synthesizer" },
  ],
};

const CHAIN_OF_AGENTS: ModeTopology = {
  mode: "chain_of_agents",
  label: "Chain of Agents",
  description: "5 sequential Workers → Manager",
  nodes: [
    PASSTHROUGH_NODE,
    {
      id: "chain_1",
      role: "worker",
      label: "Worker 1",
      icon: "🔗",
      description: "Processes segment 1",
      stepLabel: "chain_1",
    },
    {
      id: "chain_2",
      role: "worker",
      label: "Worker 2",
      icon: "🔗",
      description: "Processes segment 2 + context",
      stepLabel: "chain_2",
    },
    {
      id: "chain_3",
      role: "worker",
      label: "Worker 3",
      icon: "🔗",
      description: "Processes segment 3 + context",
      stepLabel: "chain_3",
    },
    {
      id: "chain_4",
      role: "worker",
      label: "Worker 4",
      icon: "🔗",
      description: "Processes segment 4 + context",
      stepLabel: "chain_4",
    },
    {
      id: "chain_5",
      role: "worker",
      label: "Worker 5",
      icon: "🔗",
      description: "Processes segment 5 + context",
      stepLabel: "chain_5",
    },
    {
      id: "manager",
      role: "worker",
      label: "Manager",
      icon: "👑",
      description: "Final chain synthesis",
      stepLabel: "manager",
    },
  ],
  edges: [
    { source: "router", target: "chain_1" },
    { source: "chain_1", target: "chain_2" },
    { source: "chain_2", target: "chain_3" },
    { source: "chain_3", target: "chain_4" },
    { source: "chain_4", target: "chain_5" },
    { source: "chain_5", target: "manager" },
  ],
};

const AUTO: ModeTopology = {
  mode: "auto",
  label: "Auto",
  description: "Router analyzes the question and picks the best mode",
  nodes: [
    {
      id: "router",
      role: "router",
      label: "Router",
      icon: "🧭",
      description: "Classifies question and selects mode — only LLM call",
    },
    {
      id: "auto_mode",
      role: "worker",
      label: "? Selected Mode",
      icon: "🎯",
      description: "Mode chosen dynamically at runtime",
    },
  ],
  edges: [{ source: "router", target: "auto_mode" }],
};

const TOPOLOGIES: Record<string, ModeTopology> = {
  auto: AUTO,
  direct: DIRECT,
  council: COUNCIL,
  council_peer_review: COUNCIL_PEER_REVIEW,
  debate: DEBATE,
  self_refine: SELF_REFINE,
  heavy: HEAVY,
  tree_of_thought: TREE_OF_THOUGHT,
  chain_of_agents: CHAIN_OF_AGENTS,
};

export function getModeTopology(mode: string): ModeTopology | null {
  return TOPOLOGIES[mode] || null;
}

export function getAllModeTopologies(): ModeTopology[] {
  return Object.values(TOPOLOGIES);
}

export const MODE_ORDER = [
  "auto",
  "direct",
  "council",
  "council_peer_review",
  "debate",
  "self_refine",
  "heavy",
  "tree_of_thought",
  "chain_of_agents",
];

export const ROLE_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  router: { bg: "#1e1b4b", border: "#6366f1", text: "#a5b4fc" },
  passthrough: { bg: "#1b2d2d", border: "#64748b", text: "#94a3b8" },
  worker: { bg: "#0c2d1b", border: "#22c55e", text: "#86efac" },
  judge: { bg: "#2d1b0c", border: "#f59e0b", text: "#fcd34d" },
  critic: { bg: "#1b0c2d", border: "#a855f7", text: "#d8b4fe" },
  planner: { bg: "#0c1b2d", border: "#3b82f6", text: "#93c5fd" },
  embedding: { bg: "#1b2d0c", border: "#84cc16", text: "#bef264" },
  reranking: { bg: "#2d0c1b", border: "#ec4899", text: "#f9a8d4" },
};
