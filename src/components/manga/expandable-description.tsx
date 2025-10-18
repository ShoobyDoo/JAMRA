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
    <div className="max-w-2xl">
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
        {needsTruncation && isExpanded && (
          <>
            {" "}
            <button
              onClick={() => setIsExpanded(false)}
              className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
            >
              Show less
            </button>
          </>
        )}
      </p>
    </div>
  );
}
