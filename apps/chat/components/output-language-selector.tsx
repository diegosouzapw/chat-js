"use client";

import { LanguagesIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OutputLanguageOption {
  label: string;
  nativeLabel: string;
  value: string;
}

const OUTPUT_LANGUAGE_OPTIONS: OutputLanguageOption[] = [
  { value: "pt-BR", label: "Portuguese (Brazil)", nativeLabel: "Portugues (Brasil)" },
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "es", label: "Spanish", nativeLabel: "Espanol" },
  { value: "fr", label: "French", nativeLabel: "Francais" },
  { value: "de", label: "German", nativeLabel: "Deutsch" },
  { value: "it", label: "Italian", nativeLabel: "Italiano" },
  { value: "ja", label: "Japanese", nativeLabel: "Nihongo" },
  { value: "zh", label: "Chinese", nativeLabel: "Zhongwen" },
];

function PureOutputLanguageSelector({
  className,
  onLanguageChange,
  selectedLanguage,
}: {
  className?: string;
  onLanguageChange: (language: string) => void;
  selectedLanguage: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () =>
      OUTPUT_LANGUAGE_OPTIONS.find(
        (option) => option.value === selectedLanguage
      ) ?? OUTPUT_LANGUAGE_OPTIONS[0],
    [selectedLanguage]
  );

  const handleSelect = useCallback(
    (language: string) => {
      onLanguageChange(language);
      setOpen(false);
    },
    [onLanguageChange]
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              className={cn("h-8 gap-1.5 px-2 text-xs font-medium", className)}
              data-testid="output-language-selector"
              variant="ghost"
            >
              <LanguagesIcon className="size-4" />
              <span className="uppercase">{selectedOption.value}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Output language: {selectedOption.nativeLabel}
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandEmpty>No language found</CommandEmpty>
          <CommandList className="max-h-80">
            <CommandGroup heading="Output language">
              {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                <CommandItem
                  className="flex items-center justify-between px-3 py-2.5"
                  key={option.value}
                  onSelect={() => handleSelect(option.value)}
                  value={option.value}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        option.value === selectedOption.value && "font-semibold text-primary"
                      )}
                    >
                      {option.nativeLabel}
                    </p>
                    <p className="text-muted-foreground text-xs">{option.label}</p>
                  </div>
                  <span className="font-mono text-muted-foreground text-xs uppercase">
                    {option.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export const OutputLanguageSelector = memo(
  PureOutputLanguageSelector,
  (prev, next) =>
    prev.selectedLanguage === next.selectedLanguage &&
    prev.className === next.className &&
    prev.onLanguageChange === next.onLanguageChange
);
