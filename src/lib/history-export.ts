import type { EnrichedHistoryEntry } from "./api";

export type ExportFormat = "json" | "csv" | "md";

export function exportHistoryToJSON(entries: EnrichedHistoryEntry[]): Blob {
  const jsonString = JSON.stringify(entries, null, 2);
  return new Blob([jsonString], { type: "application/json" });
}

export function exportHistoryToCSV(entries: EnrichedHistoryEntry[]): Blob {
  const headers = [
    "Timestamp",
    "Date",
    "Time",
    "Action Type",
    "Manga Title",
    "Chapter",
    "Extension ID",
  ];

  const rows = entries.map((entry) => {
    const date = new Date(entry.timestamp);
    return [
      entry.timestamp.toString(),
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      entry.actionType,
      entry.manga?.title ?? "Unknown",
      entry.chapter?.chapterNumber ?? entry.chapter?.title ?? "",
      entry.extensionId ?? "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return new Blob([csvContent], { type: "text/csv" });
}

export function exportHistoryToMarkdown(entries: EnrichedHistoryEntry[]): Blob {
  const groupedByDate = new Map<string, EnrichedHistoryEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    const dateKey = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groupedByDate.has(dateKey)) {
      groupedByDate.set(dateKey, []);
    }
    groupedByDate.get(dateKey)!.push(entry);
  }

  const lines: string[] = [
    "# Reading History",
    "",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    `Total Entries: ${entries.length}`,
    "",
  ];

  for (const [dateLabel, dateEntries] of groupedByDate.entries()) {
    lines.push(`## ${dateLabel}`, "");

    for (const entry of dateEntries) {
      const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const manga = entry.manga?.title ?? "Unknown";
      const chapter = entry.chapter?.chapterNumber ?? entry.chapter?.title ?? "";
      const action = entry.actionType.replace(/_/g, " ");

      lines.push(
        `- **${time}** - ${action}: ${manga}${chapter ? ` - Chapter ${chapter}` : ""}`
      );
    }

    lines.push("");
  }

  return new Blob([lines.join("\n")], { type: "text/markdown" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportHistory(
  entries: EnrichedHistoryEntry[],
  format: ExportFormat
): void {
  const timestamp = new Date().toISOString().split("T")[0];
  let blob: Blob;
  let filename: string;

  switch (format) {
    case "json":
      blob = exportHistoryToJSON(entries);
      filename = `jamra-history-${timestamp}.json`;
      break;
    case "csv":
      blob = exportHistoryToCSV(entries);
      filename = `jamra-history-${timestamp}.csv`;
      break;
    case "md":
      blob = exportHistoryToMarkdown(entries);
      filename = `jamra-history-${timestamp}.md`;
      break;
  }

  downloadBlob(blob, filename);
}
