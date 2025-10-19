import assert from "node:assert";
import {
  formatETA,
  formatSpeed,
  getDownloadStats,
  isFrozen,
} from "@/components/downloads/download-utils";
import type { OfflineQueuedDownload } from "@/lib/api";
import { DOWNLOAD_THRESHOLDS } from "@/lib/constants";

function createDownload(
  overrides: Partial<OfflineQueuedDownload> = {},
): OfflineQueuedDownload {
  return {
    id: 1,
    extensionId: "demo",
    mangaId: "manga-1",
    mangaSlug: "manga-1",
    mangaTitle: "Demo Manga",
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    chapterNumber: "1",
    status: "downloading",
    priority: 0,
    queuedAt: Date.now(),
    progressCurrent: 0,
    progressTotal: 10,
    ...overrides,
  };
}

export async function runDownloadUtilsTests(): Promise<void> {
  const now = Date.now();

  // isFrozen - no progress after threshold
  const frozenDownload = createDownload({
    startedAt: now - DOWNLOAD_THRESHOLDS.FROZEN_INITIAL_MS - 1,
    progressCurrent: 0,
  });
  assert.strictEqual(isFrozen(frozenDownload), true, "should detect frozen download when no progress");

  // isFrozen - progress but still early
  const activeDownload = createDownload({
    startedAt: now - 5_000,
    progressCurrent: 2,
  });
  assert.strictEqual(isFrozen(activeDownload), false, "active downloads under threshold should not be frozen");

  // getDownloadStats
  const stats = getDownloadStats(
    createDownload({
      startedAt: now - 10_000,
      progressCurrent: 5,
      progressTotal: 10,
    }),
  );
  assert.ok(stats.speed > 0, "speed should be positive");
  assert.ok(stats.eta !== null && stats.eta > 0, "eta should be positive when progress made");

  // formatETA
  assert.strictEqual(formatETA(45), "45s", "formatETA should render seconds under 60");
  assert.strictEqual(formatETA(120), "2m", "formatETA should render minutes");
  assert.strictEqual(formatETA(7200), "2h", "formatETA should render hours");

  // formatSpeed
  assert.strictEqual(formatSpeed(0.5), "30.0 pages/min", "formatSpeed should convert to pages/min under 1");
  assert.strictEqual(formatSpeed(2), "2.0 pages/s", "formatSpeed should show pages/s over 1");
}
