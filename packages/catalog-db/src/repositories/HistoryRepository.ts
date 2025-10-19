import type Database from "better-sqlite3";

export interface HistoryEntry {
  id: number;
  mangaId: string;
  chapterId: string | null;
  actionType: string;
  timestamp: number;
  metadata: Record<string, unknown> | null;
}

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  mangaId?: string;
  actionType?: string;
  startDate?: number;
  endDate?: number;
}

export class HistoryRepository {
  constructor(private readonly db: Database.Database) {}

  logHistoryEntry(entry: {
    mangaId: string;
    chapterId?: string;
    actionType: string;
    metadata?: Record<string, unknown>;
  }): HistoryEntry {
    const timestamp = Date.now();
    const result = this.db
      .prepare(
        `
        INSERT INTO history (manga_id, chapter_id, action_type, timestamp, metadata_json)
        VALUES (@manga_id, @chapter_id, @action_type, @timestamp, @metadata_json)
      `,
      )
      .run({
        manga_id: entry.mangaId,
        chapter_id: entry.chapterId ?? null,
        action_type: entry.actionType,
        timestamp,
        metadata_json: entry.metadata ? JSON.stringify(entry.metadata) : null,
      });

    return {
      id: result.lastInsertRowid as number,
      mangaId: entry.mangaId,
      chapterId: entry.chapterId ?? null,
      actionType: entry.actionType,
      timestamp,
      metadata: entry.metadata ?? null,
    };
  }

  getHistory(options?: HistoryQueryOptions): HistoryEntry[] {
    let sql = "SELECT * FROM history WHERE 1=1";
    const params: Record<string, unknown> = {};

    if (options?.mangaId) {
      sql += " AND manga_id = @manga_id";
      params.manga_id = options.mangaId;
    }

    if (options?.actionType) {
      sql += " AND action_type = @action_type";
      params.action_type = options.actionType;
    }

    if (options?.startDate) {
      sql += " AND timestamp >= @start_date";
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      sql += " AND timestamp <= @end_date";
      params.end_date = options.endDate;
    }

    sql += " ORDER BY timestamp DESC";

    if (options?.limit) {
      sql += " LIMIT @limit";
      params.limit = options.limit;
    }

    if (options?.offset) {
      sql += " OFFSET @offset";
      params.offset = options.offset;
    }

    const rows = this.db.prepare(sql).all(params) as Array<{
      id: number;
      manga_id: string;
      chapter_id: string | null;
      action_type: string;
      timestamp: number;
      metadata_json: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      actionType: row.action_type,
      timestamp: row.timestamp,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    }));
  }

  getHistoryByManga(mangaId: string, limit = 50): HistoryEntry[] {
    return this.getHistory({ mangaId, limit });
  }

  clearHistory(beforeTimestamp?: number): number {
    if (beforeTimestamp) {
      const result = this.db
        .prepare("DELETE FROM history WHERE timestamp < ?")
        .run(beforeTimestamp);
      return result.changes ?? 0;
    } else {
      const result = this.db.prepare("DELETE FROM history").run();
      return result.changes ?? 0;
    }
  }

  deleteHistoryEntry(id: number): void {
    this.db.prepare("DELETE FROM history WHERE id = ?").run(id);
  }

  getHistoryStats(options?: {
    startDate?: number;
    endDate?: number;
  }): {
    totalEntries: number;
    uniqueManga: number;
    byActionType: Record<string, number>;
  } {
    let sql = "SELECT COUNT(*) as total FROM history WHERE 1=1";
    const params: Record<string, unknown> = {};

    if (options?.startDate) {
      sql += " AND timestamp >= @start_date";
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      sql += " AND timestamp <= @end_date";
      params.end_date = options.endDate;
    }

    const totalRow = this.db.prepare(sql).get(params) as { total: number };

    let uniqueSql = "SELECT COUNT(DISTINCT manga_id) as unique_manga FROM history WHERE 1=1";
    if (options?.startDate) {
      uniqueSql += " AND timestamp >= @start_date";
    }
    if (options?.endDate) {
      uniqueSql += " AND timestamp <= @end_date";
    }

    const uniqueRow = this.db.prepare(uniqueSql).get(params) as { unique_manga: number };

    let actionSql = "SELECT action_type, COUNT(*) as count FROM history WHERE 1=1";
    if (options?.startDate) {
      actionSql += " AND timestamp >= @start_date";
    }
    if (options?.endDate) {
      actionSql += " AND timestamp <= @end_date";
    }
    actionSql += " GROUP BY action_type";

    const actionRows = this.db.prepare(actionSql).all(params) as Array<{
      action_type: string;
      count: number;
    }>;

    const byActionType: Record<string, number> = {};
    for (const row of actionRows) {
      byActionType[row.action_type] = row.count;
    }

    return {
      totalEntries: totalRow.total,
      uniqueManga: uniqueRow.unique_manga,
      byActionType,
    };
  }
}
