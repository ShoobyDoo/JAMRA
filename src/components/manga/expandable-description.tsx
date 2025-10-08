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
  const truncated = description.slice(0, maxLength).trimEnd();
  const ellipsis = truncated.endsWith("...") ? "" : "...";

  return (
    <div className="max-w-2xl space-y-2">
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        {isExpanded || !needsTruncation ? description : truncated}
        {needsTruncation && !isExpanded && (
          <>
            {ellipsis}{" "}
            <button
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
            >
              Show more
            </button>
          </>
        )}
      </p>
      {needsTruncation && isExpanded && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          Show less
        </button>
      )}
    </div>
  );
}
