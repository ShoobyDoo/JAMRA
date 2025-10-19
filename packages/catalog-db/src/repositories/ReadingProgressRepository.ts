import type Database from "better-sqlite3";

export class ReadingProgressRepository {
  constructor(private readonly db: Database.Database) {}

  saveReadingProgress(
    mangaId: string,
    chapterId: string,
    currentPage: number,
    totalPages: number,
    scrollPosition?: number,
  ): void {
    this.db
      .prepare(
        `
        INSERT INTO reading_progress (
          manga_id,
          chapter_id,
          current_page,
          total_pages,
          scroll_position,
          last_read_at
        )
        VALUES (
          @manga_id,
          @chapter_id,
          @current_page,
          @total_pages,
          @scroll_position,
          @last_read_at
        )
        ON CONFLICT(manga_id, chapter_id) DO UPDATE SET
          current_page = excluded.current_page,
          total_pages = excluded.total_pages,
          scroll_position = excluded.scroll_position,
          last_read_at = excluded.last_read_at
      `,
      )
      .run({
        manga_id: mangaId,
        chapter_id: chapterId,
        current_page: currentPage,
        total_pages: totalPages,
        scroll_position: scrollPosition ?? null,
        last_read_at: Date.now(),
      });
  }

  getReadingProgress(
    mangaId: string,
    chapterId: string,
  ):
    | {
        mangaId: string;
        chapterId: string;
        currentPage: number;
        totalPages: number;
        scrollPosition: number | null;
        lastReadAt: number;
      }
    | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM reading_progress WHERE manga_id = ? AND chapter_id = ?",
      )
      .get(mangaId, chapterId) as
      | {
          manga_id: string;
          chapter_id: string;
          current_page: number;
          total_pages: number;
          scroll_position: number | null;
          last_read_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      currentPage: row.current_page,
      totalPages: row.total_pages,
      scrollPosition: row.scroll_position,
      lastReadAt: row.last_read_at,
    };
  }

  getAllReadingProgress(): Array<{
    mangaId: string;
    chapterId: string;
    currentPage: number;
    totalPages: number;
    scrollPosition: number | null;
    lastReadAt: number;
  }> {
    const rows = this.db
      .prepare("SELECT * FROM reading_progress ORDER BY last_read_at DESC")
      .all() as Array<{
      manga_id: string;
      chapter_id: string;
      current_page: number;
      total_pages: number;
      scroll_position: number | null;
      last_read_at: number;
    }>;

    return rows.map((row) => ({
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      currentPage: row.current_page,
      totalPages: row.total_pages,
      scrollPosition: row.scroll_position,
      lastReadAt: row.last_read_at,
    }));
  }

  getLatestReadingProgressPerManga(): Array<{
    mangaId: string;
    chapterId: string;
    currentPage: number;
    totalPages: number;
    scrollPosition: number | null;
    lastReadAt: number;
  }> {
    const rows = this.db
      .prepare(
        `
        SELECT rp.*
        FROM reading_progress rp
        INNER JOIN (
          SELECT manga_id, MAX(last_read_at) as max_last_read_at
          FROM reading_progress
          GROUP BY manga_id
        ) latest
        ON rp.manga_id = latest.manga_id AND rp.last_read_at = latest.max_last_read_at
        ORDER BY rp.last_read_at DESC
      `,
      )
      .all() as Array<{
      manga_id: string;
      chapter_id: string;
      current_page: number;
      total_pages: number;
      scroll_position: number | null;
      last_read_at: number;
    }>;

    return rows.map((row) => ({
      mangaId: row.manga_id,
      chapterId: row.chapter_id,
      currentPage: row.current_page,
      totalPages: row.total_pages,
      scrollPosition: row.scroll_position,
      lastReadAt: row.last_read_at,
    }));
  }
}
