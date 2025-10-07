"use client";

import { useState } from "react";

interface ExpandableDescriptionProps {
  description: string;
  maxLength?: number;
}

export function ExpandableDescription({
  description,
  maxLength = 400,
}: ExpandableDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = description.length > maxLength;
  const displayText = isExpanded || !needsTruncation
    ? description
    : description.slice(0, maxLength) + "...";

  return (
    <div className="max-w-2xl space-y-2">
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        {displayText}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
