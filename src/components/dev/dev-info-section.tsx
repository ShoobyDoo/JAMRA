"use client";

import { useState } from "react";
import { Accordion, ActionIcon, Badge } from "@mantine/core";
import { Code, Copy, Check, ExternalLink, ChevronDown } from "lucide-react";
import { useDevMode } from "@/hooks/use-dev-mode";
import type { DevInfoItem } from "@/lib/dev-utils";

interface DevInfoGroup {
  title: string;
  items: DevInfoItem[];
  defaultOpen?: boolean;
}

interface DevInfoSectionProps {
  groups: DevInfoGroup[];
}

export function DevInfoSection({ groups }: DevInfoSectionProps) {
  const devMode = useDevMode();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!devMode) return null;

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(key);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const defaultValue = groups
    .filter((g) => g.defaultOpen)
    .map((g) => g.title);

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Code className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-blue-500">
          Developer Information
        </h3>
        <Badge size="xs" variant="light" color="blue">
          Debug
        </Badge>
      </div>

      <Accordion
        variant="separated"
        defaultValue={defaultValue}
        chevron={<ChevronDown className="h-4 w-4" />}
        classNames={{
          item: "border border-border bg-card",
          control: "hover:bg-muted/50",
        }}
      >
        {groups.map((group) => (
          <Accordion.Item key={group.title} value={group.title}>
            <Accordion.Control>
              <span className="text-sm font-medium">{group.title}</span>
            </Accordion.Control>
            <Accordion.Panel>
              <div className="space-y-3">
                {group.items.map((item, idx) => {
                  const itemKey = `${group.title}-${item.label}-${idx}`;
                  const isCopied = copiedItem === itemKey;

                  return (
                    <div key={itemKey} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-mono break-all flex-1 bg-muted px-2 py-1 rounded">
                          {item.value}
                        </p>
                        <div className="flex gap-1 flex-shrink-0">
                          {item.clickable && item.url && (
                            <ActionIcon
                              component="a"
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              variant="light"
                              color="blue"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </ActionIcon>
                          )}
                          {item.copyable && (
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color={isCopied ? "green" : "gray"}
                              onClick={() => handleCopy(item.value, itemKey)}
                            >
                              {isCopied ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </ActionIcon>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}
