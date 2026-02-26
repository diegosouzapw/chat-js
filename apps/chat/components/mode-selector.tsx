"use client";

import {
  BrainCircuitIcon,
  UsersIcon,
  SwordsIcon,
  ZapIcon,
  SearchIcon,
  TreesIcon,
  LinkIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────

export interface OmniMode {
  name: string;
  value: string;
  description: string;
  workers: string;
  family: string;
}

// ── Default modes (fallback when backend offline) ─────

const DEFAULT_MODES: OmniMode[] = [
  { name: "Auto", value: "auto", description: "Intelligent routing — auto-selects mode", workers: "varies", family: "Auto" },
  { name: "Direct", value: "direct", description: "Single model, minimum latency", workers: "1", family: "Direct" },
  { name: "Council", value: "council", description: "Parallel fan-out → Judge consensus", workers: "3-7", family: "Council" },
  { name: "Council Review", value: "council_peer_review", description: "Anonymous peer review → Chairman", workers: "3-7", family: "Council" },
  { name: "Debate", value: "debate", description: "Strategist × Devil's Advocate × Mediator", workers: "3", family: "Debate" },
  { name: "Self-Refine", value: "self_refine", description: "Generate → Critique → Search → Refine", workers: "1+1+1", family: "Research" },
  { name: "Heavy", value: "heavy", description: "Plan → parallel sub-questions → Synthesize", workers: "up to 7", family: "Research" },
  { name: "Tree of Thought", value: "tree_of_thought", description: "3 Reasoners → Validator → Synthesizer", workers: "3+1+1", family: "Research" },
  { name: "Chain of Agents", value: "chain_of_agents", description: "Sequential context → Manager synthesis", workers: "N+1", family: "Research" },
];

// ── Icons per mode ────────────────────────────────────

const MODE_ICONS: Record<string, React.ReactNode> = {
  auto: <SparklesIcon className="size-4" />,
  direct: <ZapIcon className="size-4" />,
  council: <UsersIcon className="size-4" />,
  council_peer_review: <ShieldCheckIcon className="size-4" />,
  debate: <SwordsIcon className="size-4" />,
  self_refine: <BrainCircuitIcon className="size-4" />,
  heavy: <SearchIcon className="size-4" />,
  tree_of_thought: <TreesIcon className="size-4" />,
  chain_of_agents: <LinkIcon className="size-4" />,
};

// ── Family colors ─────────────────────────────────────

const FAMILY_COLORS: Record<string, string> = {
  Auto: "text-purple-500",
  Direct: "text-blue-500",
  Council: "text-green-500",
  Debate: "text-orange-500",
  Research: "text-cyan-500",
};

// ── Component ─────────────────────────────────────────

function PureModeSelector({
  selectedMode,
  onModeChange,
  className,
}: {
  selectedMode: string;
  onModeChange: (mode: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [modes, setModes] = useState<OmniMode[]>(DEFAULT_MODES);

  // Fetch modes from API
  useEffect(() => {
    fetch("/api/omnichat/modes")
      .then((res) => res.json())
      .then((data: OmniMode[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setModes(data);
        }
      })
      .catch(() => {
        // Keep default modes on error
      });
  }, []);

  const selectedModeData = modes.find((m) => m.value === selectedMode) || modes[0];
  const icon = MODE_ICONS[selectedMode] || <SparklesIcon className="size-4" />;

  const handleSelect = useCallback(
    (value: string) => {
      onModeChange(value);
      setOpen(false);
    },
    [onModeChange]
  );

  // Group by family
  const families = [...new Set(modes.map((m) => m.family))];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-8 gap-1.5 px-2 text-xs font-medium",
                FAMILY_COLORS[selectedModeData?.family || "Auto"],
                className
              )}
              data-testid="mode-selector"
            >
              {icon}
              <span className="truncate">
                {selectedModeData?.name || "Auto"}
              </span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{selectedModeData?.description}</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandEmpty>No modes found</CommandEmpty>
          <CommandList className="max-h-80">
            {families.map((family) => (
              <CommandGroup key={family} heading={family}>
                {modes
                  .filter((m) => m.family === family)
                  .map((mode) => (
                    <CommandItem
                      key={mode.value}
                      value={mode.value}
                      onSelect={() => handleSelect(mode.value)}
                      className="flex items-start gap-3 px-3 py-2.5"
                    >
                      <span className={cn("mt-0.5 shrink-0", FAMILY_COLORS[mode.family])}>
                        {MODE_ICONS[mode.value] || <SparklesIcon className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium text-sm",
                              selectedMode === mode.value && "text-primary"
                            )}
                          >
                            {mode.name}
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {mode.workers} workers
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs leading-snug mt-0.5">
                          {mode.description}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const ModeSelector = memo(
  PureModeSelector,
  (prev, next) =>
    prev.selectedMode === next.selectedMode &&
    prev.className === next.className &&
    prev.onModeChange === next.onModeChange
);
