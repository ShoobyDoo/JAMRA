import type { OfflineQueuedDownload } from "@/lib/api";

// Detect if a download is frozen (no progress for 30+ seconds while downloading)
export function isFrozen(download: OfflineQueuedDownload): boolean {
  if (download.status !== "downloading") return false;
  if (!download.startedAt) return false;

  const now = Date.now();
  const startedAt = download.startedAt;
  const timeSinceStart = now - startedAt;

  // If downloading for more than 30 seconds with 0 progress, it's frozen
  if (timeSinceStart > 30000 && download.progressCurrent === 0) {
    return true;
  }

  // If we had progress but haven't updated in 30+ seconds, it's frozen
  // Note: This would require a "lastProgressUpdate" timestamp from the backend
  // For now, we'll use a heuristic: if downloading for 2+ minutes with < 10% progress
  if (timeSinceStart > 120000 && download.progressTotal > 0) {
    const percentComplete = (download.progressCurrent / download.progressTotal) * 100;
    if (percentComplete < 10) {
      return true;
    }
  }

  return false;
}

// Get download speed (pages/second) and ETA
export function getDownloadStats(download: OfflineQueuedDownload): {
  speed: number;
  eta: number | null;
} {
  if (download.status !== "downloading" || !download.startedAt) {
    return { speed: 0, eta: null };
  }

  const elapsed = (Date.now() - download.startedAt) / 1000; // seconds
  const speed = elapsed > 0 ? download.progressCurrent / elapsed : 0;

  if (speed === 0 || download.progressTotal === 0) {
    return { speed, eta: null };
  }

  const remaining = download.progressTotal - download.progressCurrent;
  const eta = remaining / speed;

  return { speed, eta };
}

// Format time remaining (seconds -> human readable)
export function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

// Format download speed
export function formatSpeed(pagesPerSecond: number): string {
  if (pagesPerSecond < 1) return `${(pagesPerSecond * 60).toFixed(1)} pages/min`;
  return `${pagesPerSecond.toFixed(1)} pages/s`;
}

// Group downloads by manga
export function groupByManga(downloads: OfflineQueuedDownload[]): Map<string, OfflineQueuedDownload[]> {
  const groups = new Map<string, OfflineQueuedDownload[]>();

  for (const download of downloads) {
    const key = download.mangaId;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(download);
  }

  return groups;
}

// Group downloads by extension
export function groupByExtension(downloads: OfflineQueuedDownload[]): Map<string, OfflineQueuedDownload[]> {
  const groups = new Map<string, OfflineQueuedDownload[]>();

  for (const download of downloads) {
    const key = download.extensionId;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(download);
  }

  return groups;
}

// Group downloads by status
export function groupByStatus(downloads: OfflineQueuedDownload[]): Map<string, OfflineQueuedDownload[]> {
  const groups = new Map<string, OfflineQueuedDownload[]>();

  for (const download of downloads) {
    // Add "frozen" as a virtual status
    const status = isFrozen(download) ? "frozen" : download.status;
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(download);
  }

  return groups;
}

// Format chapter display
export function formatChapterDisplay(download: OfflineQueuedDownload): string {
  if (!download.chapterId) return "Full manga";

  if (download.chapterNumber && download.chapterTitle) {
    return `Ch. ${download.chapterNumber}: ${download.chapterTitle}`;
  }
  if (download.chapterNumber) {
    return `Chapter ${download.chapterNumber}`;
  }
  if (download.chapterTitle) {
    return download.chapterTitle;
  }
  return `Ch. ${download.chapterId.slice(-8)}`;
}
