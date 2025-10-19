import type Database from "better-sqlite3";
import type { MangaSummary, MangaDetails, ChapterSummary } from "@jamra/extension-sdk";

export class MangaRepository {
  constructor(private readonly db: Database.Database) {}

  upsertMangaSummaries(extensionId: string, items: MangaSummary[]): void {
    if (items.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO manga (
        id,
        extension_id,
        title,
        alt_titles_json,
        description,
        cover_url,
        status,
        tags_json,
        demographic,
        language_code,
        updated_at,
        series_name,
        slug
      )
      VALUES (
        @id,
        @extension_id,
        @title,
        @alt_titles_json,
        @description,
        @cover_url,
        @status,
        @tags_json,
        @demographic,
        @language_code,
        @updated_at,
        @series_name,
        @slug
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        alt_titles_json = excluded.alt_titles_json,
        description = excluded.description,
        cover_url = excluded.cover_url,
        status = excluded.status,
        tags_json = excluded.tags_json,
        demographic = excluded.demographic,
        language_code = excluded.language_code,
        updated_at = excluded.updated_at,
        series_name = excluded.series_name,
        slug = excluded.slug,
        last_synced_at = (unixepoch() * 1000)
    `);

    const run = this.db.transaction((entries: MangaSummary[]) => {
      for (const item of entries) {
        // seriesName and slug might not exist on MangaSummary - handle gracefully
        const seriesName = (item as MangaSummary & { seriesName?: string }).seriesName;
        const itemSlug = (item as MangaSummary & { slug?: string }).slug;
        const slug = itemSlug ?? (seriesName ? seriesName.toLowerCase() : undefined);

        stmt.run({
          id: item.id,
          extension_id: extensionId,
          title: item.title,
          alt_titles_json: item.altTitles ? JSON.stringify(item.altTitles) : null,
          description: item.description ?? null,
          cover_url: item.coverUrl ?? null,
          status: item.status ?? null,
          tags_json: item.tags ? JSON.stringify(item.tags) : null,
          demographic: item.demographic ?? null,
          language_code: item.languageCode ?? null,
          updated_at: item.updatedAt ?? null,
          series_name: seriesName ?? null,
          slug: slug ?? null,
        });
      }
    });

    run(items);
  }

  upsertMangaDetails(extensionId: string, details: MangaDetails): void {
    const seriesName = (details as MangaDetails & { seriesName?: string }).seriesName;
    const slug = (details as MangaDetails & { slug?: string }).slug;

    this.db
      .prepare(
        `
        INSERT INTO manga (
          id,
          extension_id,
          title,
          alt_titles_json,
          description,
          cover_url,
          status,
          tags_json,
          demographic,
          language_code,
          updated_at,
          series_name,
          slug
        )
        VALUES (
          @id,
          @extension_id,
          @title,
          @alt_titles_json,
          @description,
          @cover_url,
          @status,
          @tags_json,
          @demographic,
          @language_code,
          @updated_at,
          @series_name,
          @slug
        )
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          alt_titles_json = excluded.alt_titles_json,
          description = excluded.description,
          cover_url = excluded.cover_url,
          status = excluded.status,
          tags_json = excluded.tags_json,
          demographic = excluded.demographic,
          language_code = excluded.language_code,
          updated_at = excluded.updated_at,
          series_name = excluded.series_name,
          slug = excluded.slug,
          last_synced_at = (unixepoch() * 1000)
      `,
      )
      .run({
        id: details.id,
        extension_id: extensionId,
        title: details.title,
        alt_titles_json: details.altTitles ? JSON.stringify(details.altTitles) : null,
        description: details.description ?? null,
        cover_url: details.coverUrl ?? null,
        status: details.status ?? null,
        tags_json: details.tags ? JSON.stringify(details.tags) : null,
        demographic: details.demographic ?? null,
        language_code: details.languageCode ?? null,
        updated_at: details.updatedAt ?? null,
        series_name: seriesName ?? null,
        slug: slug ?? null,
      });

    this.db
      .prepare(
        `
        INSERT INTO manga_details (
          manga_id,
          extension_id,
          authors_json,
          artists_json,
          genres_json,
          links_json,
          rating,
          year
        )
        VALUES (
          @manga_id,
          @extension_id,
          @authors_json,
          @artists_json,
          @genres_json,
          @links_json,
          @rating,
          @year
        )
        ON CONFLICT(manga_id) DO UPDATE SET
          authors_json = excluded.authors_json,
          artists_json = excluded.artists_json,
          genres_json = excluded.genres_json,
          links_json = excluded.links_json,
          rating = excluded.rating,
          year = excluded.year,
          last_synced_at = (unixepoch() * 1000)
      `,
      )
      .run({
        manga_id: details.id,
        extension_id: extensionId,
        authors_json: details.authors ? JSON.stringify(details.authors) : null,
        artists_json: details.artists ? JSON.stringify(details.artists) : null,
        genres_json: details.genres ? JSON.stringify(details.genres) : null,
        links_json: details.links ? JSON.stringify(details.links) : null,
        rating: details.rating ?? null,
        year: details.year ?? null,
      });
  }

  getMangaBySlug(extensionId: string, slug: string): { id: string; extensionId: string } | undefined {
    const row = this.db
      .prepare(
        `SELECT id, extension_id FROM manga WHERE extension_id = ? AND slug = ? LIMIT 1`,
      )
      .get(extensionId, slug) as { id: string; extension_id: string } | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      extensionId: row.extension_id,
    };
  }

  getSeriesName(mangaId: string): string | undefined {
    const row = this.db
      .prepare("SELECT series_name FROM manga WHERE id = ?")
      .get(mangaId) as { series_name: string | null } | undefined;

    return row?.series_name ?? undefined;
  }

  setSeriesName(mangaId: string, seriesName: string): void {
    this.db.prepare("UPDATE manga SET series_name = ? WHERE id = ?").run(seriesName, mangaId);
  }

  getMangaCoverUrls(extensionId: string, mangaId: string): string[] | undefined {
    const row = this.db
      .prepare("SELECT cover_urls_json FROM manga WHERE extension_id = ? AND id = ?")
      .get(extensionId, mangaId) as { cover_urls_json: string | null } | undefined;

    if (!row?.cover_urls_json) return undefined;

    const parsed = JSON.parse(row.cover_urls_json) as string[];
    return parsed.length > 0 ? parsed : undefined;
  }

  updateMangaCoverUrls(extensionId: string, mangaId: string, urls: string[]): void {
    this.db
      .prepare("UPDATE manga SET cover_urls_json = ? WHERE extension_id = ? AND id = ?")
      .run(JSON.stringify(urls), extensionId, mangaId);
  }

  getMangaWithDetails(mangaId: string): {
    id: string;
    extensionId: string;
    title: string;
    details?: MangaDetails;
    chapters?: ChapterSummary[];
  } | undefined {
    const mangaRow = this.db
      .prepare("SELECT * FROM manga WHERE id = ?")
      .get(mangaId) as {
      id: string;
      extension_id: string;
      title: string;
      alt_titles_json: string | null;
      description: string | null;
      cover_url: string | null;
      status: string | null;
      tags_json: string | null;
      demographic: string | null;
      language_code: string | null;
      updated_at: string | null;
      series_name: string | null;
      slug: string | null;
      cover_urls_json: string | null;
    } | undefined;

    if (!mangaRow) return undefined;

    const detailsRow = this.db
      .prepare("SELECT * FROM manga_details WHERE manga_id = ?")
      .get(mangaId) as {
      authors_json: string | null;
      artists_json: string | null;
      genres_json: string | null;
      links_json: string | null;
      rating: number | null;
      year: number | null;
    } | undefined;

    const chapterRows = this.db
      .prepare("SELECT * FROM chapters WHERE manga_id = ? ORDER BY chapter_number ASC")
      .all(mangaId) as Array<{
      id: string;
      title: string | null;
      chapter_number: string | null;
      volume: string | null;
      language_code: string | null;
      published_at: string | null;
      external_url: string | null;
    }>;

    let details: MangaDetails | undefined;

    if (detailsRow) {
      const status = mangaRow.status as MangaDetails["status"] | null;
      details = {
        id: mangaRow.id,
        title: mangaRow.title,
        altTitles: mangaRow.alt_titles_json ? JSON.parse(mangaRow.alt_titles_json) : undefined,
        description: mangaRow.description ?? undefined,
        coverUrl: mangaRow.cover_url ?? undefined,
        coverUrls: mangaRow.cover_urls_json ? JSON.parse(mangaRow.cover_urls_json) : undefined,
        status: status ?? undefined,
        tags: mangaRow.tags_json ? JSON.parse(mangaRow.tags_json) : undefined,
        demographic: mangaRow.demographic ?? undefined,
        languageCode: mangaRow.language_code ?? undefined,
        updatedAt: mangaRow.updated_at ?? undefined,
        authors: detailsRow.authors_json ? JSON.parse(detailsRow.authors_json) : undefined,
        artists: detailsRow.artists_json ? JSON.parse(detailsRow.artists_json) : undefined,
        genres: detailsRow.genres_json ? JSON.parse(detailsRow.genres_json) : undefined,
        links: detailsRow.links_json ? JSON.parse(detailsRow.links_json) : undefined,
        rating: detailsRow.rating ?? undefined,
        year: detailsRow.year ?? undefined,
      } as MangaDetails;
    }

    const chapters: ChapterSummary[] | undefined =
      chapterRows.length > 0
        ? chapterRows.map((row) => ({
            id: row.id,
            title: row.title ?? undefined,
            number: row.chapter_number ?? undefined,
            volume: row.volume ?? undefined,
            languageCode: row.language_code ?? undefined,
            publishedAt: row.published_at ?? undefined,
            externalUrl: row.external_url ?? undefined,
          }))
        : undefined;

    return {
      id: mangaRow.id,
      extensionId: mangaRow.extension_id,
      title: mangaRow.title,
      details,
      chapters,
    };
  }

  updateSyncState(
    extensionId: string,
    update: { catalogue?: number; full?: number },
  ): void {
    const fields: string[] = [];
    const params: Record<string, number | string> = {
      extension_id: extensionId,
    };

    if (update.catalogue !== undefined) {
      fields.push("last_catalogue_sync = @last_catalogue_sync");
      params.last_catalogue_sync = update.catalogue;
    }

    if (update.full !== undefined) {
      fields.push("last_full_sync = @last_full_sync");
      params.last_full_sync = update.full;
    }

    if (fields.length === 0) return;

    this.db
      .prepare(
        `
        INSERT INTO sync_state (extension_id, ${update.catalogue !== undefined ? "last_catalogue_sync" : "last_full_sync"})
        VALUES (@extension_id, ${update.catalogue !== undefined ? "@last_catalogue_sync" : "@last_full_sync"})
        ON CONFLICT(extension_id) DO UPDATE SET ${fields.join(", ")}
      `,
      )
      .run(params);
  }
}
