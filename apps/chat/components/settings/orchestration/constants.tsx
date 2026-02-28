"use client";

import type { ReactNode } from "react";
import {
  BrainCircuitIcon,
  LinkIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SwordsIcon,
  TreesIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

export const MODE_ICONS: Record<string, ReactNode> = {
  auto: <SparklesIcon className="size-4 text-purple-500" />,
  direct: <ZapIcon className="size-4 text-blue-500" />,
  council: <UsersIcon className="size-4 text-green-500" />,
  council_peer_review: <ShieldCheckIcon className="size-4 text-green-500" />,
  debate: <SwordsIcon className="size-4 text-orange-500" />,
  self_refine: <BrainCircuitIcon className="size-4 text-cyan-500" />,
  heavy: <SearchIcon className="size-4 text-cyan-500" />,
  tree_of_thought: <TreesIcon className="size-4 text-cyan-500" />,
  chain_of_agents: <LinkIcon className="size-4 text-cyan-500" />,
};

export const ROLE_COLORS: Record<string, string> = {
  router: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  worker: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  judge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  embedding: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  reranking: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};
