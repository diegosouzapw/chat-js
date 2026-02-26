/**
 * API Route: GET /api/omnichat/modes
 *
 * Returns available OmniChatAgent orchestration modes.
 * Used by the mode selector component in the Chat.js UI.
 */

import { NextResponse } from "next/server";
import { getModes, getHealth } from "@/lib/omnichat";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "health") {
      const health = await getHealth();
      return NextResponse.json(health);
    }

    const modes = await getModes();
    return NextResponse.json(modes);
  } catch (error) {
    // If backend is unreachable, return default modes
    if (error instanceof Error && error.message.includes("fetch")) {
      return NextResponse.json(
        [
          { name: "Auto", value: "auto", description: "Intelligent routing — auto-selects mode", workers: "varies", family: "Auto" },
          { name: "Direct", value: "direct", description: "Single model, minimum latency", workers: "1", family: "Direct" },
          { name: "Council", value: "council", description: "Parallel fan-out → Judge synthesizes consensus", workers: "3/5/7", family: "Council" },
          { name: "Council Review", value: "council_peer_review", description: "Anonymous peer review → Chairman synthesis", workers: "3/5/7", family: "Council" },
          { name: "Debate", value: "debate", description: "Strategist × Devil's Advocate × Mediator", workers: "3", family: "Debate" },
          { name: "Self-Refine", value: "self_refine", description: "Generator → Critic → Researcher → Refiner", workers: "1+1+1", family: "Research" },
          { name: "Heavy", value: "heavy", description: "Planner → parallel research agents → Synthesizer", workers: "up to 7", family: "Research" },
          { name: "Tree of Thought", value: "tree_of_thought", description: "3 Reasoners → Validator → Synthesizer", workers: "3+1+1", family: "Research" },
          { name: "Chain of Agents", value: "chain_of_agents", description: "Sequential context → Manager synthesis", workers: "N+1", family: "Research" },
        ],
        { headers: { "X-Fallback": "true" } }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch modes" },
      { status: 500 }
    );
  }
}
