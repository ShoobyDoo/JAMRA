import type Database from "better-sqlite3";

export interface CoverCacheRecord {
  mangaId: string;
  extensionId: string;
  coverUrl: string;
  dataBase64: string;
  mimeType?: string;
  bytes?: number;
  metadata?: Record<string, unknown>;
  updatedAt: number;
  expiresAt?: number;
}

export class CoverCacheRepository {
  constructor(private readonly db: Database.Database) {}

  getCoverCache(
    extensionId: string,
    mangaId: string,
  ): CoverCacheRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM manga_cover_cache WHERE manga_id = ? AND extension_id = ?`,
      )
      .get(mangaId, extensionId) as
      | {
          manga_id: string;
          extension_id: string;
          cover_url: string;
          data_base64: string;
          mime_type: string | null;
          bytes: number | null;
          metadata_json: string | null;
          updated_at: number;
          expires_at: number | null;
        }
      | undefined;

    if (!row) return undefined;

    return {
      mangaId: row.manga_id,
      extensionId: row.extension_id,
      coverUrl: row.cover_url,
      dataBase64: row.data_base64,
      mimeType: row.mime_type ?? undefined,
      bytes: row.bytes ?? undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at ?? undefined,
    };
  }

  upsertCoverCache(
    extensionId: string,
    mangaId: string,
    coverUrl: string,
    dataBase64: string,
    options?: {
      mimeType?: string;
      bytes?: number;
      metadata?: Record<string, unknown>;
      ttlMs?: number;
    },
  ): void {
    const now = Date.now();
    const expiresAt = options?.ttlMs ? now + options.ttlMs : null;

    this.db
      .prepare(
        `
        INSERT INTO manga_cover_cache (
          manga_id,
          extension_id,
          cover_url,
          data_base64,
          mime_type,
          bytes,
          metadata_json,
          updated_at,
          expires_at
        )
        VALUES (
          @manga_id,
          @extension_id,
          @cover_url,
          @data_base64,
          @mime_type,
          @bytes,
          @metadata_json,
          @updated_at,
          @expires_at
        )
        ON CONFLICT(manga_id, extension_id) DO UPDATE SET
          cover_url = excluded.cover_url,
          data_base64 = excluded.data_base64,
          mime_type = excluded.mime_type,
          bytes = excluded.bytes,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
      `,
      )
      .run({
        manga_id: mangaId,
        extension_id: extensionId,
        cover_url: coverUrl,
        data_base64: dataBase64,
        mime_type: options?.mimeType ?? null,
        bytes: options?.bytes ?? null,
        metadata_json: options?.metadata
          ? JSON.stringify(options.metadata)
          : null,
        updated_at: now,
        expires_at: expiresAt,
      });
  }

  deleteCoverCache(extensionId: string, mangaId: string): void {
    this.db
      .prepare(
        "DELETE FROM manga_cover_cache WHERE manga_id = ? AND extension_id = ?",
      )
      .run(mangaId, extensionId);
  }

  trimCoverCache(maxEntries: number): void {
    this.db
      .prepare(
        `
        DELETE FROM manga_cover_cache
        WHERE rowid IN (
          SELECT rowid FROM manga_cover_cache
          ORDER BY updated_at DESC
          LIMIT -1 OFFSET ?
        )
      `,
      )
      .run(maxEntries);
  }

  purgeExpiredCoverCache(nowTs: number = Date.now()): number {
    const result = this.db
      .prepare(
        "DELETE FROM manga_cover_cache WHERE expires_at IS NOT NULL AND expires_at <= ?",
      )
      .run(nowTs);

    return result.changes ?? 0;
  }
}
