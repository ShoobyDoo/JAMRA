import type Database from "better-sqlite3";
import type { ChapterSummary, ChapterPages } from "@jamra/extension-sdk";

export class ChapterRepository {
  constructor(private readonly db: Database.Database) {}

  upsertChapters(extensionId: string, mangaId: string, chapters: ChapterSummary[]): void {
    if (chapters.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO chapters (
        id,
        manga_id,
        extension_id,
        title,
        chapter_number,
        volume,
        language_code,
        published_at,
        external_url
      )
      VALUES (
        @id,
        @manga_id,
        @extension_id,
        @title,
        @chapter_number,
        @volume,
        @language_code,
        @published_at,
        @external_url
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        chapter_number = excluded.chapter_number,
        volume = excluded.volume,
        language_code = excluded.language_code,
        published_at = excluded.published_at,
        external_url = excluded.external_url,
        last_synced_at = (unixepoch() * 1000)
    `);

    const run = this.db.transaction((items: ChapterSummary[]) => {
      for (const chapter of items) {
        stmt.run({
          id: chapter.id,
          manga_id: mangaId,
          extension_id: extensionId,
          title: chapter.title ?? null,
          chapter_number: chapter.number ?? null,
          volume: chapter.volume ?? null,
          language_code: chapter.languageCode ?? null,
          published_at: chapter.publishedAt ?? null,
          external_url: chapter.externalUrl ?? null,
        });
      }
    });

    run(chapters);
  }

  deleteChaptersForManga(mangaId: string): void {
    this.db.prepare("DELETE FROM chapters WHERE manga_id = ?").run(mangaId);
  }

  replaceChapterPages(
    extensionId: string,
    mangaId: string,
    pages: ChapterPages,
  ): void {
    this.db.prepare("DELETE FROM chapter_pages WHERE chapter_id = ?").run(pages.chapterId);

    if (pages.pages.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO chapter_pages (
        chapter_id,
        manga_id,
        extension_id,
        page_index,
        image_url,
        width,
        height,
        bytes
      )
      VALUES (
        @chapter_id,
        @manga_id,
        @extension_id,
        @page_index,
        @image_url,
        @width,
        @height,
        @bytes
      )
    `);

    const run = this.db.transaction(() => {
      for (let i = 0; i < pages.pages.length; i++) {
        const page = pages.pages[i];
        stmt.run({
          chapter_id: pages.chapterId,
          manga_id: mangaId,
          extension_id: extensionId,
          page_index: i,
          image_url: page.url,
          width: page.width ?? null,
          height: page.height ?? null,
          bytes: page.bytes ?? null,
        });
      }
    });

    run();
  }
}
