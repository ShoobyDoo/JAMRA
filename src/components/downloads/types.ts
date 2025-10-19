export type GroupBy = "none" | "manga" | "extension" | "status";

export type StatusFilter =
  | "all"
  | "queued"
  | "downloading"
  | "frozen"
  | "failed";

export interface DownloadsQueueStats {
  total: number;
  activeCount: number;
  queuedCount: number;
  frozenCount: number;
  failedCount: number;
}
