"use client";

import { useState } from "react";
import { HoverCard, ActionIcon } from "@mantine/core";
import { Code, Copy, Check, ExternalLink } from "lucide-react";
import { useDevMode } from "@/hooks/use-dev-mode";
import type { DevInfoItem } from "@/lib/dev-utils";
import { logger } from "@/lib/logger";

interface DevBadgeProps {
  label: string;
  info: DevInfoItem[];
  position?: "top" | "bottom" | "left" | "right";
}

export function DevBadge({ label, info, position = "left" }: DevBadgeProps) {
  const devMode = useDevMode();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!devMode) return null;

  const handleCopy = async (value: string, itemLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(itemLabel);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      logger.warn("Failed to copy to clipboard", {
        component: "DevBadge",
        action: "copy-to-clipboard",
        itemLabel,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  return (
    <HoverCard
      position={position}
      withArrow
      shadow="md"
      openDelay={200}
      closeDelay={100}
    >
      <HoverCard.Target>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-mono cursor-help">
          <Code className="h-3 w-3" />
          <span>dev</span>
        </div>
      </HoverCard.Target>
      <HoverCard.Dropdown className="max-w-sm">
        <div className="space-y-2">
          <p className="font-semibold text-xs text-blue-500">{label}</p>
          {info.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}:
              </p>
              <div className="flex items-start gap-1">
                <p className="text-xs break-all flex-1 font-mono bg-muted px-1.5 py-0.5 rounded max-h-32 overflow-y-auto">
                  {item.value}
                </p>
                <div className="flex gap-0.5 flex-shrink-0">
                  {item.clickable && item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 p-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {item.copyable && (
                    <button
                      type="button"
                      onClick={() => handleCopy(item.value, item.label)}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      {copiedItem === item.label ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

/**
 * Simpler inline dev badge without icon, just shows on hover
 */
interface InlineDevBadgeProps {
  info: DevInfoItem[];
}

export function InlineDevBadge({ info }: InlineDevBadgeProps) {
  const devMode = useDevMode();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!devMode) return null;

  const handleCopy = async (value: string, itemLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(itemLabel);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      logger.warn("Failed to copy to clipboard", {
        component: "DevBadge",
        action: "copy-to-clipboard",
        itemLabel,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  return (
    <HoverCard position="left" withArrow shadow="md" openDelay={200} closeDelay={100}>
      <HoverCard.Target>
        <ActionIcon
          size="xs"
          variant="light"
          color="blue"
          className="cursor-help"
        >
          <Code className="h-3 w-3" />
        </ActionIcon>
      </HoverCard.Target>
      <HoverCard.Dropdown className="max-w-sm">
        <div className="space-y-2">
          {info.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}:
              </p>
              <div className="flex items-start gap-1">
                <p className="text-xs break-all flex-1 font-mono bg-muted px-1.5 py-0.5 rounded max-h-32 overflow-y-auto">
                  {item.value}
                </p>
                <div className="flex gap-0.5 flex-shrink-0">
                  {item.clickable && item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 p-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {item.copyable && (
                    <button
                      type="button"
                      onClick={() => handleCopy(item.value, item.label)}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      {copiedItem === item.label ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
