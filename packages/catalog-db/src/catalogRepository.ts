import type Database from "better-sqlite3";
import type {
  ChapterPages,
  ChapterSummary,
  ExtensionManifest,
  MangaDetails,
  MangaSummary,
} from "@jamra/extension-sdk";
import type { ExtensionArtifactSignature } from "@jamra/extension-registry";

function deserialize<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to deserialize value from catalog repository", error);
    return undefined;
  }
}

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function now(): number {
  return Date.now();
}

const ALLOWED_MANGA_STATUSES = new Set<MangaDetails["status"]>([
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
  "unknown",
]);

const EXTENSION_SELECT_COLUMNS = `
  id,
  name,
  version,
  description,
  homepage,
  icon,
  author_name,
  author_url,
  author_contact,
  language_codes,
  capabilities_json,
  manifest_json,
  entry_path,
  is_enabled,
  settings_json,
  installed_at,
  source_metadata_json,
  update_state_json
`;

interface RawExtensionRow {
  id: string;
  name: string;
  version: string;
  description: string | null;
  homepage: string | null;
  icon: string | null;
  author_name: string;
  author_url: string | null;
  author_contact: string | null;
  language_codes: string | null;
  capabilities_json: string | null;
  manifest_json: string | null;
  entry_path: string | null;
  is_enabled: number;
  settings_json: string | null;
  installed_at: number;
  source_metadata_json: string | null;
  update_state_json: string | null;
}

export interface StoredExtensionSourceMetadata {
  registryId?: string;
  manifestUrl?: string;
  downloadUrl?: string;
  checksum?: string;
  signature?: ExtensionArtifactSignature;
  version?: string;
}

export interface StoredExtensionUpdateDetails {
  version: string;
  downloadUrl: string;
  checksum?: string;
  releaseNotes: string;
  publishedAt?: string;
  manifestUrl?: string;
  minHostVersion?: string;
  minSdkVersion?: string;
  compatibilityNotes?: string;
  signature?: ExtensionArtifactSignature;
  registryId?: string;
}

export interface StoredExtensionUpdateState {
  latest?: StoredExtensionUpdateDetails;
  lastCheckedAt?: number;
  acknowledgedVersion?: string;
  acknowledgedAt?: number;
}

export interface StoredExtension {
  id: string;
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  icon?: string;
  author: {
    name: string;
    url?: string;
    contact?: string;
  };
  languageCodes: ExtensionManifest["languageCodes"];
  capabilities: ExtensionManifest["capabilities"];
  manifest: ExtensionManifest;
  installedAt: number;
  entryPath?: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
  source?: StoredExtensionSourceMetadata;
  updateState?: StoredExtensionUpdateState;
}

export interface ExtensionListOptions {
  search?: string;
  status?: "enabled" | "disabled";
  sort?: "name" | "installedAt" | "author" | "language";
  order?: "asc" | "desc";
}

export interface UpsertExtensionOptions {
  entryPath?: string | null;
  enabled?: boolean;
  settings?: Record<string, unknown> | null;
  source?: StoredExtensionSourceMetadata | null;
  updateState?: StoredExtensionUpdateState | null;
}

export class CatalogRepository {
  constructor(private readonly db: Database.Database) {}

  upsertExtension(
    manifest: ExtensionManifest,
    options: UpsertExtensionOptions = {},
  ): void {
    const existing = this.getExtensionRow(manifest.id);

    const entryPath = options.entryPath ?? existing?.entry_path ?? null;
    const previousEnabled = existing ? existing.is_enabled === 1 : undefined;
    const isEnabled = options.enabled ?? previousEnabled ?? true;
    const settingsJson =
      options.settings !== undefined
        ? serialize(options.settings)
        : (existing?.settings_json ?? null);
    const sourceJson =
      options.source !== undefined
        ? serialize(options.source)
        : (existing?.source_metadata_json ?? null);
    const updateJson =
      options.updateState !== undefined
        ? serialize(options.updateState)
        : (existing?.update_state_json ?? null);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE extensions SET
          name = @name,
          version = @version,
          description = @description,
          homepage = @homepage,
          icon = @icon,
          author_name = @author_name,
          author_url = @author_url,
          author_contact = @author_contact,
          language_codes = @language_codes,
          capabilities_json = @capabilities_json,
          manifest_json = @manifest_json,
          entry_path = @entry_path,
          is_enabled = @is_enabled,
          settings_json = @settings_json,
          source_metadata_json = @source_metadata_json,
          update_state_json = @update_state_json
        WHERE id = @id
      `);

      stmt.run({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description ?? null,
        homepage: manifest.homepage ?? null,
        icon: manifest.icon ?? null,
        author_name: manifest.author.name,
        author_url: manifest.author.url ?? null,
        author_contact: manifest.author.contact ?? null,
        language_codes: JSON.stringify(manifest.languageCodes ?? []),
        capabilities_json: JSON.stringify(manifest.capabilities ?? {}),
        manifest_json: JSON.stringify(manifest),
        entry_path: entryPath,
        is_enabled: isEnabled ? 1 : 0,
        settings_json: settingsJson,
        source_metadata_json: sourceJson,
        update_state_json: updateJson,
      });
      return;
    }

    const stmt = this.db.prepare(`
      INSERT INTO extensions (
        id,
        name,
        version,
        description,
        homepage,
        icon,
        author_name,
        author_url,
        author_contact,
        language_codes,
        capabilities_json,
        manifest_json,
        entry_path,
        is_enabled,
        settings_json,
        installed_at,
        source_metadata_json,
        update_state_json
      ) VALUES (@id, @name, @version, @description, @homepage, @icon, @author_name,
        @author_url, @author_contact, @language_codes, @capabilities_json,
        @manifest_json, @entry_path, @is_enabled, @settings_json, @installed_at,
        @source_metadata_json, @update_state_json)
    `);

    stmt.run({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description ?? null,
      homepage: manifest.homepage ?? null,
      icon: manifest.icon ?? null,
      author_name: manifest.author.name,
      author_url: manifest.author.url ?? null,
      author_contact: manifest.author.contact ?? null,
      language_codes: JSON.stringify(manifest.languageCodes ?? []),
      capabilities_json: JSON.stringify(manifest.capabilities ?? {}),
      manifest_json: JSON.stringify(manifest),
      entry_path: entryPath,
      is_enabled: isEnabled ? 1 : 0,
      settings_json: settingsJson,
      installed_at: now(),
      source_metadata_json: sourceJson,
      update_state_json: updateJson,
    });
  }

  listExtensions(options: ExtensionListOptions = {}): StoredExtension[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    const search = options.search?.trim();
    if (search && search.length > 0) {
      clauses.push(
        `(
          lower(name) LIKE lower(@search)
          OR lower(author_name) LIKE lower(@search)
          OR lower(description) LIKE lower(@search)
          OR lower(language_codes) LIKE lower(@search)
        )`,
      );
      params.search = `%${search}%`;
    }

    if (options.status === "enabled") {
      clauses.push("is_enabled = 1");
    } else if (options.status === "disabled") {
      clauses.push("is_enabled = 0");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const sortColumnMap: Record<
      NonNullable<ExtensionListOptions["sort"]>,
      string
    > = {
      name: "lower(name)",
      installedAt: "installed_at",
      author: "lower(author_name)",
      language: "lower(language_codes)",
    };

    const defaultSort: NonNullable<ExtensionListOptions["sort"]> =
      options.status ? "installedAt" : "name";

    const sortKey = options.sort ?? defaultSort;
    const sortColumn = sortColumnMap[sortKey] ?? sortColumnMap.name;
    const direction = options.order === "desc" ? "DESC" : "ASC";

    const sql = `
      SELECT ${EXTENSION_SELECT_COLUMNS}
      FROM extensions
      ${where}
      ORDER BY ${sortColumn} ${direction}, id ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(params) as RawExtensionRow[];
    return rows.map((row) => this.mapExtensionRow(row));
  }

  getExtension(id: string): StoredExtension | undefined {
    const row = this.getExtensionRow(id);
    if (!row) return undefined;
    return this.mapExtensionRow(row);
  }

  setExtensionEnabled(id: string, enabled: boolean): void {
    const stmt = this.db.prepare(
      `UPDATE extensions SET is_enabled = @is_enabled WHERE id = @id`,
    );
    stmt.run({ id, is_enabled: enabled ? 1 : 0 });
  }

  removeExtension(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM extensions WHERE id = @id`);
    stmt.run({ id });
  }

  updateExtensionSettings(
    id: string,
    settings: Record<string, unknown> | null,
  ): void {
    const stmt = this.db.prepare(
      `UPDATE extensions SET settings_json = @settings_json WHERE id = @id`,
    );
    stmt.run({ id, settings_json: serialize(settings) });
  }

  updateExtensionSourceMetadata(
    id: string,
    source: StoredExtensionSourceMetadata | null,
  ): void {
    const stmt = this.db.prepare(
      `UPDATE extensions SET source_metadata_json = @source_metadata_json WHERE id = @id`,
    );
    stmt.run({ id, source_metadata_json: serialize(source) });
  }

  updateExtensionUpdateState(
    id: string,
    state: StoredExtensionUpdateState | null,
  ): void {
    const stmt = this.db.prepare(
      `UPDATE extensions SET update_state_json = @update_state_json WHERE id = @id`,
    );
    stmt.run({ id, update_state_json: serialize(state) });
  }

  private getExtensionRow(id: string): RawExtensionRow | undefined {
    const stmt = this.db.prepare(
      `SELECT ${EXTENSION_SELECT_COLUMNS} FROM extensions WHERE id = @id`,
    );
    return stmt.get({ id }) as RawExtensionRow | undefined;
  }

  private mapExtensionRow(row: RawExtensionRow): StoredExtension {
    const parsedManifest = deserialize<ExtensionManifest>(row.manifest_json);
    const fallbackCapabilities = deserialize<ExtensionManifest["capabilities"]>(
      row.capabilities_json,
    ) ?? {
      catalogue: true,
    };
    const languageCodes =
      deserialize<ExtensionManifest["languageCodes"]>(row.language_codes) ?? [];
    const sourceMetadata = deserialize<StoredExtensionSourceMetadata>(
      row.source_metadata_json,
    );
    const updateState = deserialize<StoredExtensionUpdateState>(
      row.update_state_json,
    );

    const manifest: ExtensionManifest = parsedManifest
      ? {
          ...parsedManifest,
          languageCodes: parsedManifest.languageCodes ?? languageCodes,
          capabilities: parsedManifest.capabilities ?? fallbackCapabilities,
          icon: parsedManifest.icon ?? row.icon ?? undefined,
        }
      : {
          id: row.id,
          name: row.name,
          version: row.version,
          description: row.description ?? undefined,
          homepage: row.homepage ?? undefined,
          icon: row.icon ?? undefined,
          author: {
            name: row.author_name,
            url: row.author_url ?? undefined,
            contact: row.author_contact ?? undefined,
          },
          languageCodes,
          capabilities: fallbackCapabilities,
        };

    const settings = deserialize<Record<string, unknown>>(row.settings_json);

    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description ?? undefined,
      homepage: row.homepage ?? undefined,
      icon: manifest.icon ?? undefined,
      author: {
        name: row.author_name,
        url: row.author_url ?? undefined,
        contact: row.author_contact ?? undefined,
      },
      languageCodes: manifest.languageCodes,
      capabilities: manifest.capabilities,
      manifest,
      installedAt: row.installed_at,
      entryPath: row.entry_path ?? undefined,
      enabled: row.is_enabled === 1,
      settings,
      source: sourceMetadata,
      updateState,
    };
  }

  updateSyncState(
    extensionId: string,
    partial: { catalogue?: number; full?: number },
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_state (extension_id, last_catalogue_sync, last_full_sync)
      VALUES (@extension_id, @last_catalogue_sync, @last_full_sync)
      ON CONFLICT(extension_id) DO UPDATE SET
        last_catalogue_sync = COALESCE(excluded.last_catalogue_sync, sync_state.last_catalogue_sync),
        last_full_sync = COALESCE(excluded.last_full_sync, sync_state.last_full_sync);
    `);

    stmt.run({
      extension_id: extensionId,
      last_catalogue_sync: partial.catalogue ?? null,
      last_full_sync: partial.full ?? null,
    });
  }

  upsertMangaSummaries(
    extensionId: string,
    items: MangaSummary[],
    seriesNames?: Map<string, string>
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO manga (
        id,
        slug,
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
        last_synced_at,
        series_name
      ) VALUES (@id, @slug, @extension_id, @title, @alt_titles_json, @description, @cover_url, @status,
        @tags_json, @demographic, @language_code, @updated_at, @last_synced_at, @series_name)
      ON CONFLICT(id) DO UPDATE SET
        extension_id = excluded.extension_id,
        slug = COALESCE(excluded.slug, manga.slug),
        title = excluded.title,
        alt_titles_json = excluded.alt_titles_json,
        description = excluded.description,
        cover_url = excluded.cover_url,
        status = excluded.status,
        tags_json = excluded.tags_json,
        demographic = excluded.demographic,
        language_code = excluded.language_code,
        updated_at = excluded.updated_at,
        last_synced_at = excluded.last_synced_at,
        series_name = COALESCE(excluded.series_name, manga.series_name);
    `);

    const run = this.db.transaction((entries: MangaSummary[]) => {
      for (const item of entries) {
        const slugSource = item.slug ?? seriesNames?.get(item.id) ?? null;
        stmt.run({
          id: item.id,
          slug: slugSource ? slugSource.trim().toLowerCase() : null,
          extension_id: extensionId,
          title: item.title,
          alt_titles_json: serialize(item.altTitles),
          description: item.description ?? null,
          cover_url: item.coverUrl ?? null,
          status: item.status ?? null,
          tags_json: serialize(item.tags),
          demographic: item.demographic ?? null,
          language_code: item.languageCode ?? null,
          updated_at: item.updatedAt ?? null,
          last_synced_at: now(),
          series_name: seriesNames?.get(item.id) ?? null,
        });
      }
    });

    run(items);
  }

  upsertMangaDetails(extensionId: string, details: MangaDetails): void {
    this.upsertMangaSummaries(extensionId, [details]);

    const stmt = this.db.prepare(`
      INSERT INTO manga_details (
        manga_id,
        extension_id,
        authors_json,
        artists_json,
        genres_json,
        links_json,
        rating,
        year,
        last_synced_at
      ) VALUES (@manga_id, @extension_id, @authors_json, @artists_json,
        @genres_json, @links_json, @rating, @year, @last_synced_at)
      ON CONFLICT(manga_id) DO UPDATE SET
        extension_id = excluded.extension_id,
        authors_json = excluded.authors_json,
        artists_json = excluded.artists_json,
        genres_json = excluded.genres_json,
        links_json = excluded.links_json,
        rating = excluded.rating,
        year = excluded.year,
        last_synced_at = excluded.last_synced_at;
    `);

    stmt.run({
      manga_id: details.id,
      extension_id: extensionId,
      authors_json: serialize(details.authors),
      artists_json: serialize(details.artists),
      genres_json: serialize(details.genres),
      links_json: serialize(details.links),
      rating: details.rating ?? null,
      year: details.year ?? null,
      last_synced_at: now(),
    });
  }

  upsertChapters(
    extensionId: string,
    mangaId: string,
    chapters: ChapterSummary[],
  ): void {
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
        external_url,
        last_synced_at
      ) VALUES (@id, @manga_id, @extension_id, @title, @chapter_number, @volume, @language_code,
        @published_at, @external_url, @last_synced_at)
      ON CONFLICT(id) DO UPDATE SET
        manga_id = excluded.manga_id,
        extension_id = excluded.extension_id,
        title = excluded.title,
        chapter_number = excluded.chapter_number,
        volume = excluded.volume,
        language_code = excluded.language_code,
        published_at = excluded.published_at,
        external_url = excluded.external_url,
        last_synced_at = excluded.last_synced_at;
    `);

    const run = this.db.transaction((entries: ChapterSummary[]) => {
      for (const chapter of entries) {
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
          last_synced_at: now(),
        });
      }
    });

    run(chapters);
  }

  deleteChaptersForManga(mangaId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM chapters WHERE manga_id = @manga_id
    `);
    stmt.run({ manga_id: mangaId });
  }

  replaceChapterPages(
    extensionId: string,
    mangaId: string,
    payload: ChapterPages,
  ): void {
    const deleteStmt = this.db.prepare(
      `DELETE FROM chapter_pages WHERE chapter_id = @chapter_id`,
    );

    const insertStmt = this.db.prepare(`
      INSERT INTO chapter_pages (
        chapter_id,
        manga_id,
        extension_id,
        page_index,
        image_url,
        width,
        height,
        bytes
      ) VALUES (@chapter_id, @manga_id, @extension_id, @page_index, @image_url, @width, @height, @bytes)
      ON CONFLICT(chapter_id, page_index) DO UPDATE SET
        image_url = excluded.image_url,
        width = excluded.width,
        height = excluded.height,
        bytes = excluded.bytes;
    `);

    this.db.transaction(() => {
      deleteStmt.run({ chapter_id: payload.chapterId });
      for (const page of payload.images) {
        insertStmt.run({
          chapter_id: payload.chapterId,
          manga_id: mangaId,
          extension_id: extensionId,
          page_index: page.index,
          image_url: page.url,
          width: page.width ?? null,
          height: page.height ?? null,
          bytes: page.bytes ?? null,
        });
      }
    })();
  }

  saveReadingProgress(
    mangaId: string,
    chapterId: string,
    currentPage: number,
    totalPages: number,
    scrollPosition?: number
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
      ) VALUES (@manga_id, @chapter_id, @current_page, @total_pages, @scroll_position, @last_read_at)
      ON CONFLICT(manga_id, chapter_id) DO UPDATE SET
        current_page = excluded.current_page,
        total_pages = excluded.total_pages,
        scroll_position = excluded.scroll_position,
        last_read_at = excluded.last_read_at;
    `
      )
      .run({
        manga_id: mangaId,
        chapter_id: chapterId,
        current_page: currentPage,
        total_pages: totalPages,
        scroll_position: scrollPosition ?? 0,
        last_read_at: now(),
      });
  }

  getReadingProgress(
    mangaId: string,
    chapterId: string
  ): {
    mangaId: string;
    chapterId: string;
    currentPage: number;
    totalPages: number;
    scrollPosition: number;
    lastReadAt: number;
  } | undefined {
    const row = this.db
      .prepare(
        `
      SELECT
        manga_id as mangaId,
        chapter_id as chapterId,
        current_page as currentPage,
        total_pages as totalPages,
        scroll_position as scrollPosition,
        last_read_at as lastReadAt
      FROM reading_progress
      WHERE manga_id = @manga_id AND chapter_id = @chapter_id
    `
      )
      .get({
        manga_id: mangaId,
        chapter_id: chapterId,
      }) as
      | {
          mangaId: string;
          chapterId: string;
          currentPage: number;
          totalPages: number;
          scrollPosition: number;
          lastReadAt: number;
        }
      | undefined;

    return row;
  }

  getAllReadingProgress(): Array<{
    mangaId: string;
    chapterId: string;
    currentPage: number;
    totalPages: number;
    scrollPosition: number;
    lastReadAt: number;
  }> {
    return this.db
      .prepare(
        `
      SELECT
        manga_id as mangaId,
        chapter_id as chapterId,
        current_page as currentPage,
        total_pages as totalPages,
        scroll_position as scrollPosition,
        last_read_at as lastReadAt
      FROM reading_progress
      ORDER BY last_read_at DESC
    `
      )
      .all() as Array<{
      mangaId: string;
      chapterId: string;
      currentPage: number;
      totalPages: number;
      scrollPosition: number;
      lastReadAt: number;
    }>;
  }

  getLatestReadingProgressPerManga(): Array<{
    mangaId: string;
    chapterId: string;
    currentPage: number;
    totalPages: number;
    scrollPosition: number;
    lastReadAt: number;
  }> {
    return this.db
      .prepare(
        `
      SELECT
        mangaId,
        chapterId,
        currentPage,
        totalPages,
        scrollPosition,
        lastReadAt
      FROM (
        SELECT
          manga_id as mangaId,
          chapter_id as chapterId,
          current_page as currentPage,
          total_pages as totalPages,
          scroll_position as scrollPosition,
          last_read_at as lastReadAt,
          ROW_NUMBER() OVER (PARTITION BY manga_id ORDER BY last_read_at DESC) as rn
        FROM reading_progress
      )
      WHERE rn = 1
      ORDER BY lastReadAt DESC
    `
      )
      .all() as Array<{
      mangaId: string;
      chapterId: string;
      currentPage: number;
      totalPages: number;
      scrollPosition: number;
      lastReadAt: number;
    }>;
  }

  getMangaWithDetails(
    mangaId: string
  ): {
    extensionId: string;
    details: MangaDetails;
    chapters: ChapterSummary[];
    summaryLastSyncedAt?: number;
  } | undefined {
    const mangaRow = this.db
      .prepare(
        `
        SELECT
          id,
          extension_id as extensionId,
          slug,
          title,
          alt_titles_json as altTitlesJson,
          description,
          cover_url as coverUrl,
          status,
          tags_json as tagsJson,
          demographic,
          language_code as languageCode,
          updated_at as updatedAt,
          last_synced_at as lastSyncedAt,
          series_name as seriesName
        FROM manga
        WHERE id = @manga_id
        LIMIT 1
      `
      )
      .get({ manga_id: mangaId }) as
      | {
          id: string;
          extensionId: string;
          slug: string | null;
          title: string;
          altTitlesJson: string | null;
          description: string | null;
          coverUrl: string | null;
          status: string | null;
          tagsJson: string | null;
          demographic: string | null;
          languageCode: string | null;
          updatedAt: string | null;
          lastSyncedAt: number | null;
          seriesName: string | null;
        }
      | undefined;

    if (!mangaRow) {
      return undefined;
    }

    const detailsRow = this.db
      .prepare(
        `
        SELECT
          authors_json as authorsJson,
          artists_json as artistsJson,
          genres_json as genresJson,
          links_json as linksJson,
          rating,
          year
        FROM manga_details
        WHERE manga_id = @manga_id
        LIMIT 1
      `
      )
      .get({ manga_id: mangaId }) as
      | {
          authorsJson: string | null;
          artistsJson: string | null;
          genresJson: string | null;
          linksJson: string | null;
          rating: number | null;
          year: number | null;
        }
      | undefined;

    const chapters = this.db
      .prepare(
        `
        SELECT
          id,
          title,
          chapter_number as chapterNumber,
          volume,
          language_code as languageCode,
          published_at as publishedAt,
          external_url as externalUrl
        FROM chapters
        WHERE manga_id = @manga_id
        ORDER BY
          CASE
            WHEN published_at IS NOT NULL THEN 0
            ELSE 1
          END,
          published_at DESC,
          chapter_number DESC,
          id DESC
      `
      )
      .all({ manga_id: mangaId }) as Array<{
      id: string;
      title: string | null;
      chapterNumber: string | null;
      volume: string | null;
      languageCode: string | null;
      publishedAt: string | null;
      externalUrl: string | null;
    }>;

    const normalizedStatus = mangaRow.status?.toLowerCase() as
      | MangaDetails["status"]
      | undefined;
    const status =
      normalizedStatus && ALLOWED_MANGA_STATUSES.has(normalizedStatus)
        ? normalizedStatus
        : undefined;

    const mangaDetails: MangaDetails = {
      id: mangaRow.id,
      slug: mangaRow.slug ?? undefined,
      title: mangaRow.title,
      altTitles: deserialize<string[]>(mangaRow.altTitlesJson) ?? undefined,
      description: mangaRow.description ?? undefined,
      coverUrl: mangaRow.coverUrl ?? undefined,
      status,
      tags: deserialize<string[]>(mangaRow.tagsJson) ?? undefined,
      demographic: mangaRow.demographic ?? undefined,
      languageCode: mangaRow.languageCode ?? undefined,
      updatedAt: mangaRow.updatedAt ?? undefined,
      authors: detailsRow
        ? deserialize<string[]>(detailsRow.authorsJson) ?? undefined
        : undefined,
      artists: detailsRow
        ? deserialize<string[]>(detailsRow.artistsJson) ?? undefined
        : undefined,
      genres: detailsRow
        ? deserialize<string[]>(detailsRow.genresJson) ?? undefined
        : undefined,
      links: detailsRow
        ? deserialize<Record<string, string>>(detailsRow.linksJson) ?? undefined
        : undefined,
      rating: detailsRow?.rating ?? undefined,
      year: detailsRow?.year ?? undefined,
    };

    mangaDetails.chapters = chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title ?? undefined,
      number: chapter.chapterNumber ?? undefined,
      volume: chapter.volume ?? undefined,
      languageCode: chapter.languageCode ?? undefined,
      publishedAt: chapter.publishedAt ?? undefined,
      externalUrl: chapter.externalUrl ?? undefined,
    }));

    return {
      extensionId: mangaRow.extensionId,
      details: mangaDetails,
      chapters: mangaDetails.chapters ?? [],
      summaryLastSyncedAt: mangaRow.lastSyncedAt ?? undefined,
    };
  }

  getMangaBySlug(
    extensionId: string,
    slug: string
  ): {
    id: string;
    extensionId: string;
    slug: string | null;
    title: string;
  } | undefined {
    const lookupSlug = slug.trim().toLowerCase();

    const row = this.db
      .prepare(
        `
      SELECT
        id,
        extension_id as extensionId,
        slug,
        title
      FROM manga
      WHERE extension_id = @extension_id
        AND slug = @slug
      LIMIT 1
    `
      )
      .get({
        extension_id: extensionId,
        slug: lookupSlug,
      }) as
      | {
          id: string;
          extensionId: string;
          slug: string | null;
          title: string;
        }
      | undefined;

    return row ?? undefined;
  }

  getSeriesName(mangaId: string): string | undefined {
    const row = this.db
      .prepare(
        `
      SELECT series_name
      FROM manga
      WHERE id = @manga_id
    `
      )
      .get({ manga_id: mangaId }) as { series_name: string | null } | undefined;

    return row?.series_name ?? undefined;
  }

  setSeriesName(mangaId: string, seriesName: string): void {
    this.db
      .prepare(
        `
      UPDATE manga
      SET series_name = @series_name
      WHERE id = @manga_id
    `
      )
      .run({
        manga_id: mangaId,
        series_name: seriesName,
      });
  }

  /**
   * Nuclear option: Clears all user data (reading progress, cached manga, etc.)
   * but preserves installed extensions.
   *
   * WARNING: This is destructive and cannot be undone!
   */
  nukeUserData(): void {
    // Use a transaction to ensure atomicity
    const transaction = this.db.transaction(() => {
      // Clear reading progress
      this.db.prepare("DELETE FROM reading_progress").run();

      // Clear cached content
      this.db.prepare("DELETE FROM chapter_pages").run();
      this.db.prepare("DELETE FROM chapters").run();
      this.db.prepare("DELETE FROM manga_details").run();
      this.db.prepare("DELETE FROM manga").run();

      // Clear extension cache
      this.db.prepare("DELETE FROM extension_cache").run();

      // Clear sync state
      this.db.prepare("DELETE FROM sync_state").run();
    });

    transaction();
  }
}
