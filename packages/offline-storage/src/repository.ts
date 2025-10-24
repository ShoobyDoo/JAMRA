/**
 * Offline Storage Repository
 *
 * Handles all SQLite database operations for offline manga storage, including
 * tracking downloaded manga/chapters and managing the download queue.
 */

import type { Database } from "better-sqlite3";
import type {
  OfflineMangaRow,
  OfflineChapterRow,
  DownloadQueueRow,
  DownloadHistoryRow,
  QueuedDownload,
  DownloadHistoryItem,
  DownloadStatus,
  MangaStorageInfo,
} from "./types.js";

export class OfflineRepository {
  constructor(private readonly db: Database) {
    this.initializeTables();
  }

  // ==========================================================================
  // Type Transformations (DB rows -> Application types)
  // ==========================================================================

  private transformQueueRow(row: DownloadQueueRow): QueuedDownload {
    return {
      id: row.id,
      extensionId: row.extension_id,
      mangaId: row.manga_id,
      mangaSlug: row.manga_slug,
      mangaTitle: row.manga_title || undefined,
      chapterId: row.chapter_id || undefined,
      chapterNumber: row.chapter_number || undefined,
      chapterTitle: row.chapter_title || undefined,
      status: row.status,
      priority: row.priority,
      queuedAt: row.queued_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      errorMessage: row.error_message || undefined,
      progressCurrent: row.progress_current,
      progressTotal: row.progress_total,
    };
  }

  private transformHistoryRow(row: DownloadHistoryRow): DownloadHistoryItem {
    return {
      id: row.id,
      extensionId: row.extension_id,
      mangaId: row.manga_id,
      mangaSlug: row.manga_slug,
      mangaTitle: row.manga_title || undefined,
      chapterId: row.chapter_id || undefined,
      chapterNumber: row.chapter_number || undefined,
      chapterTitle: row.chapter_title || undefined,
      status: row.status,
      queuedAt: row.queued_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at,
      errorMessage: row.error_message || undefined,
      progressCurrent: row.progress_current,
      progressTotal: row.progress_total,
    };
  }

  // ==========================================================================
  // Schema Initialization
  // ==========================================================================

  private initializeTables(): void {
    // Enable WAL mode for better concurrent read/write performance
    // WAL allows readers to not block writers and vice versa
    this.db.pragma("journal_mode = WAL");

    // Downloaded manga tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_manga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        manga_slug TEXT NOT NULL,
        download_path TEXT NOT NULL,
        downloaded_at INTEGER NOT NULL,
        last_updated_at INTEGER NOT NULL,
        total_size_bytes INTEGER DEFAULT 0,
        UNIQUE(extension_id, manga_id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_offline_manga_slug
      ON offline_manga(extension_id, manga_slug)
    `);

    // Downloaded chapters tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS offline_chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offline_manga_id INTEGER NOT NULL,
        chapter_id TEXT NOT NULL,
        chapter_number TEXT,
        chapter_title TEXT,
        folder_name TEXT NOT NULL,
        total_pages INTEGER NOT NULL,
        downloaded_at INTEGER NOT NULL,
        size_bytes INTEGER DEFAULT 0,
        FOREIGN KEY (offline_manga_id) REFERENCES offline_manga(id) ON DELETE CASCADE,
        UNIQUE(offline_manga_id, chapter_id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_offline_chapters_manga
      ON offline_chapters(offline_manga_id)
    `);

    // Download queue
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS download_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        manga_slug TEXT NOT NULL,
        manga_title TEXT,
        chapter_id TEXT,
        chapter_number TEXT,
        chapter_title TEXT,
        status TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        queued_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        error_message TEXT,
        progress_current INTEGER DEFAULT 0,
        progress_total INTEGER DEFAULT 0,
        UNIQUE(extension_id, manga_id, chapter_id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_download_queue_status
      ON download_queue(status, priority DESC, queued_at ASC)
    `);

    // Download history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS download_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_id TEXT NOT NULL,
        manga_id TEXT NOT NULL,
        manga_slug TEXT NOT NULL,
        manga_title TEXT,
        chapter_id TEXT,
        chapter_number TEXT,
        chapter_title TEXT,
        status TEXT NOT NULL,
        queued_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER NOT NULL,
        error_message TEXT,
        progress_current INTEGER DEFAULT 0,
        progress_total INTEGER DEFAULT 0
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_download_history_completed
      ON download_history(completed_at DESC)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_download_history_manga
      ON download_history(extension_id, manga_id)
    `);
  }

  // ==========================================================================
  // Manga Operations
  // ==========================================================================

  insertManga(manga: Omit<OfflineMangaRow, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO offline_manga (
        extension_id, manga_id, manga_slug, download_path,
        downloaded_at, last_updated_at, total_size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(extension_id, manga_id) DO UPDATE SET
        last_updated_at = excluded.last_updated_at,
        total_size_bytes = excluded.total_size_bytes
      RETURNING id
    `);

    const result = stmt.get(
      manga.extension_id,
      manga.manga_id,
      manga.manga_slug,
      manga.download_path,
      manga.downloaded_at,
      manga.last_updated_at,
      manga.total_size_bytes,
    ) as { id: number };

    return result.id;
  }

  getManga(extensionId: string, mangaId: string): OfflineMangaRow | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM offline_manga
      WHERE extension_id = ? AND manga_id = ?
    `);
    return stmt.get(extensionId, mangaId) as OfflineMangaRow | undefined;
  }

  getMangaBySlug(
    extensionId: string,
    mangaSlug: string,
  ): OfflineMangaRow | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM offline_manga
      WHERE extension_id = ? AND manga_slug = ?
    `);
    return stmt.get(extensionId, mangaSlug) as OfflineMangaRow | undefined;
  }

  getAllManga(): OfflineMangaRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM offline_manga
      ORDER BY downloaded_at DESC
    `);
    return stmt.all() as OfflineMangaRow[];
  }

  deleteManga(extensionId: string, mangaId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_manga
      WHERE extension_id = ? AND manga_id = ?
    `);
    stmt.run(extensionId, mangaId);
  }

  updateMangaSize(
    extensionId: string,
    mangaId: string,
    totalSizeBytes: number,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE offline_manga
      SET total_size_bytes = ?, last_updated_at = ?
      WHERE extension_id = ? AND manga_id = ?
    `);
    stmt.run(totalSizeBytes, Date.now(), extensionId, mangaId);
  }

  // ==========================================================================
  // Chapter Operations
  // ==========================================================================

  insertChapter(chapter: Omit<OfflineChapterRow, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO offline_chapters (
        offline_manga_id, chapter_id, chapter_number, chapter_title,
        folder_name, total_pages, downloaded_at, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(offline_manga_id, chapter_id) DO UPDATE SET
        total_pages = excluded.total_pages,
        size_bytes = excluded.size_bytes
      RETURNING id
    `);

    const result = stmt.get(
      chapter.offline_manga_id,
      chapter.chapter_id,
      chapter.chapter_number,
      chapter.chapter_title,
      chapter.folder_name,
      chapter.total_pages,
      chapter.downloaded_at,
      chapter.size_bytes,
    ) as { id: number };

    return result.id;
  }

  getChapter(
    mangaId: number,
    chapterId: string,
  ): OfflineChapterRow | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM offline_chapters
      WHERE offline_manga_id = ? AND chapter_id = ?
    `);
    return stmt.get(mangaId, chapterId) as OfflineChapterRow | undefined;
  }

  getChaptersByManga(offlineMangaId: number): OfflineChapterRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM offline_chapters
      WHERE offline_manga_id = ?
      ORDER BY chapter_number ASC, downloaded_at DESC
    `);
    return stmt.all(offlineMangaId) as OfflineChapterRow[];
  }

  deleteChapter(offlineMangaId: number, chapterId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_chapters
      WHERE offline_manga_id = ? AND chapter_id = ?
    `);
    stmt.run(offlineMangaId, chapterId);
  }

  deleteAllChaptersForManga(offlineMangaId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_chapters
      WHERE offline_manga_id = ?
    `);
    stmt.run(offlineMangaId);
  }

  // ==========================================================================
  // Download Queue Operations
  // ==========================================================================

  queueDownload(download: Omit<DownloadQueueRow, "id">): number {
    const stmt = this.db.prepare(`
      INSERT INTO download_queue (
        extension_id, manga_id, manga_slug, manga_title, chapter_id, chapter_number, chapter_title,
        status, priority, queued_at, started_at, completed_at, error_message,
        progress_current, progress_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(extension_id, manga_id, chapter_id) DO UPDATE SET
        status = excluded.status,
        priority = excluded.priority,
        queued_at = excluded.queued_at
      RETURNING id
    `);

    const result = stmt.get(
      download.extension_id,
      download.manga_id,
      download.manga_slug,
      download.manga_title,
      download.chapter_id,
      download.chapter_number,
      download.chapter_title,
      download.status,
      download.priority,
      download.queued_at,
      download.started_at,
      download.completed_at,
      download.error_message,
      download.progress_current,
      download.progress_total,
    ) as { id: number };

    return result.id;
  }

  getNextQueuedDownload(): QueuedDownload | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM download_queue
      WHERE status = 'queued'
      ORDER BY priority DESC, queued_at ASC
      LIMIT 1
    `);
    const row = stmt.get() as DownloadQueueRow | undefined;
    return row ? this.transformQueueRow(row) : undefined;
  }

  getQueuedDownloads(): QueuedDownload[] {
    const stmt = this.db.prepare(`
      SELECT * FROM download_queue
      WHERE status IN ('queued', 'downloading')
      ORDER BY priority DESC, queued_at ASC
    `);
    const rows = stmt.all() as DownloadQueueRow[];
    return rows.map((row) => this.transformQueueRow(row));
  }

  getAllQueueItems(): QueuedDownload[] {
    const stmt = this.db.prepare(`
      SELECT * FROM download_queue
      ORDER BY queued_at DESC
    `);
    const rows = stmt.all() as DownloadQueueRow[];
    return rows.map((row) => this.transformQueueRow(row));
  }

  getQueueItem(queueId: number): QueuedDownload | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM download_queue
      WHERE id = ?
    `);
    const row = stmt.get(queueId) as DownloadQueueRow | undefined;
    return row ? this.transformQueueRow(row) : undefined;
  }

  updateQueueStatus(
    queueId: number,
    status: DownloadStatus,
    errorMessage?: string,
  ): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE download_queue
      SET
        status = ?,
        started_at = CASE WHEN ? = 'downloading' AND started_at IS NULL THEN ? ELSE started_at END,
        completed_at = CASE WHEN ? IN ('completed', 'failed') THEN ? ELSE completed_at END,
        error_message = ?
      WHERE id = ?
    `);

    stmt.run(status, status, now, status, now, errorMessage || null, queueId);
  }

  updateQueueProgress(
    queueId: number,
    progressCurrent: number,
    progressTotal: number,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE download_queue
      SET progress_current = ?, progress_total = ?
      WHERE id = ?
    `);
    stmt.run(progressCurrent, progressTotal, queueId);
  }

  /**
   * Batch update progress for multiple queue items in a single transaction
   * More efficient than calling updateQueueProgress multiple times
   */
  updateQueueProgressBatch(
    updates: Array<{
      queueId: number;
      progressCurrent: number;
      progressTotal: number;
    }>,
  ): void {
    if (updates.length === 0) {
      return;
    }

    // Use a transaction for atomic batch update
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE download_queue
        SET progress_current = ?, progress_total = ?
        WHERE id = ?
      `);

      for (const update of updates) {
        stmt.run(
          update.progressCurrent,
          update.progressTotal,
          update.queueId,
        );
      }
    });

    transaction();
  }

  deleteQueueItem(queueId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_queue
      WHERE id = ?
    `);
    stmt.run(queueId);
  }

  deleteCompletedQueueItems(): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_queue
      WHERE status IN ('completed', 'failed')
    `);
    stmt.run();
  }

  pauseAllDownloads(): void {
    const stmt = this.db.prepare(`
      UPDATE download_queue
      SET status = 'paused'
      WHERE status = 'queued'
    `);
    stmt.run();
  }

  resumeAllDownloads(): void {
    const stmt = this.db.prepare(`
      UPDATE download_queue
      SET status = 'queued'
      WHERE status = 'paused'
    `);
    stmt.run();
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  getTotalStorageSize(): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(total_size_bytes), 0) as total
      FROM offline_manga
    `);
    const result = stmt.get() as { total: number };
    return result.total;
  }

  getMangaStorageInfo(): MangaStorageInfo[] {
    const stmt = this.db.prepare(`
      SELECT
        om.manga_id as mangaId,
        om.manga_slug as mangaSlug,
        om.extension_id as extensionId,
        om.download_path as downloadPath,
        om.total_size_bytes as totalBytes,
        om.downloaded_at as downloadedAt,
        COUNT(oc.id) as chapterCount
      FROM offline_manga om
      LEFT JOIN offline_chapters oc ON om.id = oc.offline_manga_id
      GROUP BY om.id
      ORDER BY om.downloaded_at DESC
    `);

    return stmt.all() as unknown as MangaStorageInfo[];
  }

  getChapterCount(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM offline_chapters
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  getPageCount(): number {
    const stmt = this.db.prepare(`
      SELECT COALESCE(SUM(total_pages), 0) as count
      FROM offline_chapters
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  getStorageSizeByExtension(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT extension_id, SUM(total_size_bytes) as total
      FROM offline_manga
      GROUP BY extension_id
    `);

    const rows = stmt.all() as Array<{ extension_id: string; total: number }>;
    const result: Record<string, number> = {};

    for (const row of rows) {
      result[row.extension_id] = row.total;
    }

    return result;
  }

  // ==========================================================================
  // Cleanup Operations
  // ==========================================================================

  deleteOldestUnreadChapters(count: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_chapters
      WHERE id IN (
        SELECT id FROM offline_chapters
        ORDER BY downloaded_at ASC
        LIMIT ?
      )
    `);
    stmt.run(count);
  }

  deleteChaptersOlderThan(timestampMs: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_chapters
      WHERE downloaded_at < ?
    `);
    stmt.run(timestampMs);
  }

  // ==========================================================================
  // Download History Operations
  // ==========================================================================

  /**
   * Move a completed download from queue to history
   */
  moveQueueItemToHistory(queueId: number): void {
    const queueItem = this.getQueueItem(queueId);
    if (!queueItem || !queueItem.completedAt) {
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO download_history (
        extension_id, manga_id, manga_slug, manga_title, chapter_id, chapter_number, chapter_title,
        status, queued_at, started_at, completed_at, error_message,
        progress_current, progress_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      queueItem.extensionId,
      queueItem.mangaId,
      queueItem.mangaSlug,
      queueItem.mangaTitle || null,
      queueItem.chapterId || null,
      queueItem.chapterNumber || null,
      queueItem.chapterTitle || null,
      queueItem.status,
      queueItem.queuedAt,
      queueItem.startedAt || null,
      queueItem.completedAt,
      queueItem.errorMessage || null,
      queueItem.progressCurrent,
      queueItem.progressTotal,
    );

    this.deleteQueueItem(queueId);
  }

  /**
   * Get all download history items, ordered by completion time (newest first)
   */
  getDownloadHistory(limit?: number): DownloadHistoryItem[] {
    let query = `
      SELECT * FROM download_history
      ORDER BY completed_at DESC
    `;

    if (limit && limit > 0) {
      query += ` LIMIT ${Math.floor(limit)}`;
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as DownloadHistoryRow[];
    return rows.map((row) => this.transformHistoryRow(row));
  }

  /**
   * Get download history for a specific manga
   */
  getDownloadHistoryForManga(
    extensionId: string,
    mangaId: string,
  ): DownloadHistoryItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM download_history
      WHERE extension_id = ? AND manga_id = ?
      ORDER BY completed_at DESC
    `);
    const rows = stmt.all(extensionId, mangaId) as DownloadHistoryRow[];
    return rows.map((row) => this.transformHistoryRow(row));
  }

  /**
   * Delete a single history item
   */
  deleteHistoryItem(historyId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_history
      WHERE id = ?
    `);
    stmt.run(historyId);
  }

  /**
   * Clear all download history
   */
  clearDownloadHistory(): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_history
    `);
    stmt.run();
  }

  /**
   * Clear all queued downloads
   */
  clearDownloadQueue(): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_queue
    `);
    stmt.run();
  }

  /**
   * Clear all stored offline manga and chapters
   */
  clearOfflineManga(): void {
    const stmt = this.db.prepare(`
      DELETE FROM offline_manga
    `);
    stmt.run();
  }

  /**
   * Clear all offline data (manga, queue, history) in a single transaction
   */
  clearAllOfflineData(): void {
    const transaction = this.db.transaction(() => {
      this.clearDownloadQueue();
      this.clearDownloadHistory();
      this.clearOfflineManga();
    });
    transaction();
  }

  /**
   * Delete history items older than specified timestamp
   */
  deleteHistoryOlderThan(timestampMs: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM download_history
      WHERE completed_at < ?
    `);
    stmt.run(timestampMs);
  }

  /**
   * Get count of history items
   */
  getHistoryCount(): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM download_history
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }
}
