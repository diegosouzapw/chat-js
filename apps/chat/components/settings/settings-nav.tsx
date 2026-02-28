"use client";

import {
  Activity,
  BrainCircuit,
  Cpu,
  FileText,
  History,
  ListOrdered,
  Plug,
  Server,
  Settings,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

export function SettingsNav({
  orientation = "vertical",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  const navItems = useMemo(
    () =>
      [
        { href: "/settings" as const, label: "General", icon: Settings },
        {
          href: "/settings/provider" as const,
          label: "Provider",
          icon: Server,
        },
        { href: "/settings/models" as const, label: "Models", icon: Cpu },
        ...(config.ai.tools.mcp.enabled
          ? [
              {
                href: "/settings/connectors" as const,
                label: "Connectors",
                icon: Plug,
              },
            ]
          : []),
        {
          href: "/settings/orchestration" as const,
          label: "Orchestration",
          icon: BrainCircuit,
        },
        {
          href: "/settings/flow" as const,
          label: "Flow Editor",
          icon: Workflow,
        },
        {
          href: "/settings/runs" as const,
          label: "Runs",
          icon: ListOrdered,
        },
        {
          href: "/settings/flow-console" as const,
          label: "Flow Console",
          icon: Activity,
        },
        {
          href: "/settings/prompts" as const,
          label: "Prompts",
          icon: FileText,
        },
        {
          href: "/settings/sessions" as const,
          label: "Sessions",
          icon: History,
        },
        {
          href: "/settings/admin" as const,
          label: "Admin",
          icon: ShieldCheck,
        },
      ] as const,
    []
  );

  return (
    <nav
      className={cn(
        "flex gap-1 sm:overflow-auto sm:pb-2",
        orientation === "vertical" ? "w-48 flex-col" : "flex-row"
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(href);

        return (
          <Link
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground"
            )}
            href={href}
            key={href}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
