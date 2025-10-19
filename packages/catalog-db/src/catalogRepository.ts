import type Database from "better-sqlite3";
import type {
  ChapterPages,
  ChapterSummary,
  ExtensionManifest,
  MangaDetails,
  MangaSummary,
} from "@jamra/extension-sdk";
import type { ExtensionArtifactSignature } from "@jamra/extension-registry";
import {
  ExtensionRepository,
  MangaRepository,
  ChapterRepository,
  ReadingProgressRepository,
  CoverCacheRepository,
  SettingsRepository,
  LibraryRepository,
  HistoryRepository,
} from "./repositories/index.js";

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

interface RawCoverCacheRow {
  coverUrl: string;
  dataBase64: string;
  mimeType: string | null;
  bytes: number | null;
  metadataJson: string | null;
  updatedAt: number;
  expiresAt: number | null;
}

export interface CoverCacheRecord {
  coverUrl: string;
  dataBase64: string;
  mimeType?: string;
  bytes?: number;
  metadata?: unknown;
  updatedAt: number;
  expiresAt?: number | null;
}

export class CatalogRepository {
  // Domain repositories for modular data access
  private readonly extensions: ExtensionRepository;
  private readonly manga: MangaRepository;
  private readonly chapters: ChapterRepository;
  private readonly readingProgress: ReadingProgressRepository;
  private readonly coverCache: CoverCacheRepository;
  private readonly settings: SettingsRepository;
  private readonly library: LibraryRepository;
  private readonly history: HistoryRepository;

  constructor(private readonly db: Database.Database) {
    this.extensions = new ExtensionRepository(db);
    this.manga = new MangaRepository(db);
    this.chapters = new ChapterRepository(db);
    this.readingProgress = new ReadingProgressRepository(db);
    this.coverCache = new CoverCacheRepository(db);
    this.settings = new SettingsRepository(db);
    this.library = new LibraryRepository(db);
    this.history = new HistoryRepository(db);
  }

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
        cover_urls_json,
        status,
        tags_json,
        demographic,
        language_code,
        updated_at,
        last_synced_at,
        series_name
      ) VALUES (@id, @slug, @extension_id, @title, @alt_titles_json, @description, @cover_url, @cover_urls_json, @status,
        @tags_json, @demographic, @language_code, @updated_at, @last_synced_at, @series_name)
      ON CONFLICT(id) DO UPDATE SET
        extension_id = excluded.extension_id,
        slug = COALESCE(excluded.slug, manga.slug),
        title = excluded.title,
        alt_titles_json = excluded.alt_titles_json,
        description = excluded.description,
        cover_url = excluded.cover_url,
        cover_urls_json = excluded.cover_urls_json,
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
          cover_urls_json: serialize(item.coverUrls ?? (item.coverUrl ? [item.coverUrl] : undefined)),
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
    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid chapter pages payload: expected object');
    }

    if (!payload.pages || !Array.isArray(payload.pages)) {
      throw new Error(`Invalid chapter pages payload: pages is not iterable (got ${typeof payload.pages})`);
    }

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
      for (const page of payload.pages) {
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
          cover_urls_json as coverUrlsJson,
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
          coverUrlsJson: string | null;
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
      coverUrls: deserialize<string[]>(mangaRow.coverUrlsJson) ?? undefined,
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

  getMangaCoverUrls(extensionId: string, mangaId: string): string[] | undefined {
    const row = this.db
      .prepare(
        `SELECT cover_urls_json as coverUrlsJson
         FROM manga
         WHERE id = @manga_id AND extension_id = @extension_id
         LIMIT 1`
      )
      .get({ manga_id: mangaId, extension_id: extensionId }) as
      | { coverUrlsJson: string | null }
      | undefined;

    if (!row) return undefined;
    return deserialize<string[]>(row.coverUrlsJson) ?? undefined;
  }

  updateMangaCoverUrls(extensionId: string, mangaId: string, urls: string[]): void {
    const stmt = this.db.prepare(
      `UPDATE manga
       SET cover_urls_json = @cover_urls_json,
           cover_url = COALESCE(@cover_url, cover_url)
       WHERE id = @manga_id AND extension_id = @extension_id`
    );

    stmt.run({
      cover_urls_json: serialize(urls),
      cover_url: urls[0] ?? null,
      manga_id: mangaId,
      extension_id: extensionId,
    });
  }

  getCoverCache(extensionId: string, mangaId: string): CoverCacheRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT
           cover_url as coverUrl,
           data_base64 as dataBase64,
           mime_type as mimeType,
           bytes,
           metadata_json as metadataJson,
           updated_at as updatedAt,
           expires_at as expiresAt
         FROM manga_cover_cache
         WHERE manga_id = @manga_id AND extension_id = @extension_id
         LIMIT 1`
      )
      .get({ manga_id: mangaId, extension_id: extensionId }) as RawCoverCacheRow | undefined;

    if (!row) return undefined;

    return {
      coverUrl: row.coverUrl,
      dataBase64: row.dataBase64,
      mimeType: row.mimeType ?? undefined,
      bytes: row.bytes ?? undefined,
      metadata: deserialize<unknown>(row.metadataJson) ?? undefined,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt ?? undefined,
    };
  }

  upsertCoverCache(
    extensionId: string,
    mangaId: string,
    entry: CoverCacheRecord & { expiresAt?: number | null }
  ): void {
    const stmt = this.db.prepare(
      `INSERT INTO manga_cover_cache (
         manga_id,
         extension_id,
         cover_url,
         data_base64,
         mime_type,
         bytes,
         metadata_json,
         updated_at,
         expires_at
       ) VALUES (@manga_id, @extension_id, @cover_url, @data_base64, @mime_type, @bytes,
         @metadata_json, @updated_at, @expires_at)
       ON CONFLICT(manga_id, extension_id) DO UPDATE SET
         cover_url = excluded.cover_url,
         data_base64 = excluded.data_base64,
         mime_type = excluded.mime_type,
         bytes = excluded.bytes,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at,
         expires_at = excluded.expires_at;
      `
    );

    stmt.run({
      manga_id: mangaId,
      extension_id: extensionId,
      cover_url: entry.coverUrl,
      data_base64: entry.dataBase64,
      mime_type: entry.mimeType ?? null,
      bytes: entry.bytes ?? null,
      metadata_json: serialize(entry.metadata),
      updated_at: entry.updatedAt,
      expires_at: entry.expiresAt ?? null,
    });
  }

  deleteCoverCache(extensionId: string, mangaId: string): void {
    this.db
      .prepare(
        `DELETE FROM manga_cover_cache
         WHERE manga_id = @manga_id AND extension_id = @extension_id`
      )
      .run({ manga_id: mangaId, extension_id: extensionId });
  }

  trimCoverCache(maxEntries: number): void {
    if (maxEntries <= 0) {
      this.db.exec(`DELETE FROM manga_cover_cache`);
      return;
    }

    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM manga_cover_cache`)
      .get() as { count: number };

    const total = row?.count ?? 0;
    if (total <= maxEntries) return;

    const toDelete = total - maxEntries;
    this.db
      .prepare(
        `DELETE FROM manga_cover_cache
         WHERE rowid IN (
           SELECT rowid
           FROM manga_cover_cache
           ORDER BY updated_at ASC
           LIMIT @limit
         )`
      )
      .run({ limit: toDelete });
  }

  purgeExpiredCoverCache(nowTs: number = now()): number {
    const result = this.db
      .prepare(
        `DELETE FROM manga_cover_cache
         WHERE expires_at IS NOT NULL AND expires_at <= @now`
      )
      .run({ now: nowTs });

    return result.changes ?? 0;
  }

  getAppSetting<T>(key: string): T | undefined {
    const row = this.db
      .prepare(
        `SELECT value
         FROM app_settings
         WHERE key = @key
         LIMIT 1`
      )
      .get({ key }) as { value: string } | undefined;

    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch (error) {
      console.warn(`Failed to parse app setting for key ${key}`, error);
      return undefined;
    }
  }

  setAppSetting(key: string, value: unknown): void {
    const stmt = this.db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (@key, @value, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    );

    stmt.run({
      key,
      value: JSON.stringify(value ?? null),
      updated_at: now(),
    });
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

  // ==================== Library Management ====================

  addToLibrary(
    mangaId: string,
    extensionId: string,
    status: "reading" | "plan_to_read" | "completed" | "on_hold" | "dropped",
    options?: {
      personalRating?: number;
      favorite?: boolean;
      notes?: string;
      startedAt?: number;
      completedAt?: number;
    }
  ): {
    mangaId: string;
    extensionId: string;
    status: string;
    personalRating: number | null;
    favorite: boolean;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
    startedAt: number | null;
    completedAt: number | null;
  } {
    const timestamp = now();

    this.db
      .prepare(
        `
      INSERT INTO library_entries (
        manga_id,
        extension_id,
        status,
        personal_rating,
        favorite,
        notes,
        added_at,
        updated_at,
        started_at,
        completed_at
      ) VALUES (
        @manga_id,
        @extension_id,
        @status,
        @personal_rating,
        @favorite,
        @notes,
        @added_at,
        @updated_at,
        @started_at,
        @completed_at
      )
      ON CONFLICT(manga_id) DO UPDATE SET
        extension_id = excluded.extension_id,
        status = excluded.status,
        personal_rating = excluded.personal_rating,
        favorite = excluded.favorite,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at;
    `
      )
      .run({
        manga_id: mangaId,
        extension_id: extensionId,
        status,
        personal_rating: options?.personalRating ?? null,
        favorite: options?.favorite ? 1 : 0,
        notes: options?.notes ?? null,
        added_at: timestamp,
        updated_at: timestamp,
        started_at: options?.startedAt ?? null,
        completed_at: options?.completedAt ?? null,
      });

    return {
      mangaId,
      extensionId,
      status,
      personalRating: options?.personalRating ?? null,
      favorite: options?.favorite ?? false,
      notes: options?.notes ?? null,
      addedAt: timestamp,
      updatedAt: timestamp,
      startedAt: options?.startedAt ?? null,
      completedAt: options?.completedAt ?? null,
    };
  }

  updateLibraryEntry(
    mangaId: string,
    updates: {
      status?: "reading" | "plan_to_read" | "completed" | "on_hold" | "dropped";
      personalRating?: number | null;
      favorite?: boolean;
      notes?: string | null;
      startedAt?: number | null;
      completedAt?: number | null;
    }
  ): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { manga_id: mangaId, updated_at: now() };

    if (updates.status !== undefined) {
      fields.push("status = @status");
      params.status = updates.status;
    }
    if (updates.personalRating !== undefined) {
      fields.push("personal_rating = @personal_rating");
      params.personal_rating = updates.personalRating;
    }
    if (updates.favorite !== undefined) {
      fields.push("favorite = @favorite");
      params.favorite = updates.favorite ? 1 : 0;
    }
    if (updates.notes !== undefined) {
      fields.push("notes = @notes");
      params.notes = updates.notes;
    }
    if (updates.startedAt !== undefined) {
      fields.push("started_at = @started_at");
      params.started_at = updates.startedAt;
    }
    if (updates.completedAt !== undefined) {
      fields.push("completed_at = @completed_at");
      params.completed_at = updates.completedAt;
    }

    if (fields.length === 0) return;

    fields.push("updated_at = @updated_at");

    this.db
      .prepare(
        `
      UPDATE library_entries
      SET ${fields.join(", ")}
      WHERE manga_id = @manga_id
    `
      )
      .run(params);
  }

  removeFromLibrary(mangaId: string): void {
    this.db
      .prepare("DELETE FROM library_entries WHERE manga_id = @manga_id")
      .run({ manga_id: mangaId });
  }

  getLibraryEntry(mangaId: string): {
    mangaId: string;
    extensionId: string;
    status: string;
    personalRating: number | null;
    favorite: boolean;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
    startedAt: number | null;
    completedAt: number | null;
  } | undefined {
    const row = this.db
      .prepare(
        `
      SELECT
        manga_id as mangaId,
        extension_id as extensionId,
        status,
        personal_rating as personalRating,
        favorite,
        notes,
        added_at as addedAt,
        updated_at as updatedAt,
        started_at as startedAt,
        completed_at as completedAt
      FROM library_entries
      WHERE manga_id = @manga_id
    `
      )
      .get({ manga_id: mangaId }) as
      | {
          mangaId: string;
          extensionId: string;
          status: string;
          personalRating: number | null;
          favorite: number;
          notes: string | null;
          addedAt: number;
          updatedAt: number;
          startedAt: number | null;
          completedAt: number | null;
        }
      | undefined;

    if (!row) return undefined;

    return {
      ...row,
      favorite: row.favorite === 1,
    };
  }

  getLibraryEntries(filters?: {
    status?: string;
    favorite?: boolean;
  }): Array<{
    mangaId: string;
    extensionId: string;
    status: string;
    personalRating: number | null;
    favorite: boolean;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
    startedAt: number | null;
    completedAt: number | null;
  }> {
    let query = `
      SELECT
        manga_id as mangaId,
        extension_id as extensionId,
        status,
        personal_rating as personalRating,
        favorite,
        notes,
        added_at as addedAt,
        updated_at as updatedAt,
        started_at as startedAt,
        completed_at as completedAt
      FROM library_entries
    `;

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters?.status) {
      conditions.push("status = @status");
      params.status = filters.status;
    }

    if (filters?.favorite !== undefined) {
      conditions.push("favorite = @favorite");
      params.favorite = filters.favorite ? 1 : 0;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY updated_at DESC";

    const rows = this.db.prepare(query).all(params) as Array<{
      mangaId: string;
      extensionId: string;
      status: string;
      personalRating: number | null;
      favorite: number;
      notes: string | null;
      addedAt: number;
      updatedAt: number;
      startedAt: number | null;
      completedAt: number | null;
    }>;

    return rows.map((row) => ({
      ...row,
      favorite: row.favorite === 1,
    }));
  }

  getEnrichedLibraryEntries(filters?: {
    status?: string;
    favorite?: boolean;
  }): Array<{
    mangaId: string;
    extensionId: string;
    status: string;
    personalRating: number | null;
    favorite: boolean;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
    startedAt: number | null;
    completedAt: number | null;
    manga: {
      title: string;
      description: string | null;
      coverUrl: string | null;
      coverUrls: string[] | null;
      status: string | null;
      tags: string[] | null;
    };
    totalChapters: number;
    readChapters: number;
  }> {
    let query = `
      SELECT
        le.manga_id as mangaId,
        le.extension_id as extensionId,
        le.status,
        le.personal_rating as personalRating,
        le.favorite,
        le.notes,
        le.added_at as addedAt,
        le.updated_at as updatedAt,
        le.started_at as startedAt,
        le.completed_at as completedAt,
        m.title,
        m.description,
        m.cover_url as coverUrl,
        m.cover_urls_json as coverUrlsJson,
        m.status as mangaStatus,
        m.tags_json as tagsJson,
        (SELECT COUNT(*) FROM chapters WHERE manga_id = le.manga_id) as totalChapters,
        (SELECT COUNT(DISTINCT chapter_id) FROM reading_progress WHERE manga_id = le.manga_id) as readChapters
      FROM library_entries le
      LEFT JOIN manga m ON le.manga_id = m.id
    `;

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters?.status) {
      conditions.push("le.status = @status");
      params.status = filters.status;
    }

    if (filters?.favorite !== undefined) {
      conditions.push("le.favorite = @favorite");
      params.favorite = filters.favorite ? 1 : 0;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY le.updated_at DESC";

    const rows = this.db.prepare(query).all(params) as Array<{
      mangaId: string;
      extensionId: string;
      status: string;
      personalRating: number | null;
      favorite: number;
      notes: string | null;
      addedAt: number;
      updatedAt: number;
      startedAt: number | null;
      completedAt: number | null;
      title: string | null;
      description: string | null;
      coverUrl: string | null;
      coverUrlsJson: string | null;
      mangaStatus: string | null;
      tagsJson: string | null;
      totalChapters: number;
      readChapters: number;
    }>;

    return rows.map((row) => ({
      mangaId: row.mangaId,
      extensionId: row.extensionId,
      status: row.status,
      personalRating: row.personalRating,
      favorite: row.favorite === 1,
      notes: row.notes,
      addedAt: row.addedAt,
      updatedAt: row.updatedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      manga: {
        title: row.title ?? "Unknown Title",
        description: row.description,
        coverUrl: row.coverUrl,
        coverUrls: deserialize<string[]>(row.coverUrlsJson) ?? null,
        status: row.mangaStatus,
        tags: deserialize<string[]>(row.tagsJson) ?? null,
      },
      totalChapters: row.totalChapters,
      readChapters: row.readChapters,
    }));
  }

  getLibraryStats(): {
    totalManga: number;
    byStatus: {
      reading: number;
      plan_to_read: number;
      completed: number;
      on_hold: number;
      dropped: number;
    };
    totalChaptersRead: number;
    favorites: number;
  } {
    const totalRow = this.db
      .prepare("SELECT COUNT(*) as count FROM library_entries")
      .get() as { count: number };

    const statusRows = this.db
      .prepare(
        `
      SELECT status, COUNT(*) as count
      FROM library_entries
      GROUP BY status
    `
      )
      .all() as Array<{ status: string; count: number }>;

    const favoritesRow = this.db
      .prepare("SELECT COUNT(*) as count FROM library_entries WHERE favorite = 1")
      .get() as { count: number };

    const chaptersRow = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT chapter_id) as count
      FROM reading_progress
      WHERE manga_id IN (SELECT manga_id FROM library_entries)
    `
      )
      .get() as { count: number };

    const byStatus = {
      reading: 0,
      plan_to_read: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
    };

    for (const row of statusRows) {
      if (row.status in byStatus) {
        byStatus[row.status as keyof typeof byStatus] = row.count;
      }
    }

    return {
      totalManga: totalRow.count,
      byStatus,
      totalChaptersRead: chaptersRow.count,
      favorites: favoritesRow.count,
    };
  }

  // ==================== Library Tags ====================

  createLibraryTag(name: string, color?: string): {
    id: number;
    name: string;
    color: string | null;
    createdAt: number;
  } {
    const result = this.db
      .prepare(
        `
      INSERT INTO library_tags (name, color, created_at)
      VALUES (@name, @color, @created_at)
      ON CONFLICT(name) DO UPDATE SET
        color = excluded.color
      RETURNING id, name, color, created_at as createdAt
    `
      )
      .get({
        name,
        color: color ?? null,
        created_at: now(),
      }) as {
      id: number;
      name: string;
      color: string | null;
      createdAt: number;
    };

    return result;
  }

  deleteLibraryTag(tagId: number): void {
    this.db.prepare("DELETE FROM library_tags WHERE id = @tag_id").run({ tag_id: tagId });
  }

  getLibraryTags(): Array<{
    id: number;
    name: string;
    color: string | null;
    createdAt: number;
    mangaCount: number;
  }> {
    const rows = this.db
      .prepare(
        `
      SELECT
        lt.id,
        lt.name,
        lt.color,
        lt.created_at as createdAt,
        COUNT(let.manga_id) as mangaCount
      FROM library_tags lt
      LEFT JOIN library_entry_tags let ON lt.id = let.tag_id
      GROUP BY lt.id
      ORDER BY lt.name ASC
    `
      )
      .all() as Array<{
      id: number;
      name: string;
      color: string | null;
      createdAt: number;
      mangaCount: number;
    }>;

    return rows;
  }

  addTagToLibraryEntry(mangaId: string, tagId: number): void {
    this.db
      .prepare(
        `
      INSERT INTO library_entry_tags (manga_id, tag_id)
      VALUES (@manga_id, @tag_id)
      ON CONFLICT DO NOTHING
    `
      )
      .run({ manga_id: mangaId, tag_id: tagId });
  }

  removeTagFromLibraryEntry(mangaId: string, tagId: number): void {
    this.db
      .prepare("DELETE FROM library_entry_tags WHERE manga_id = @manga_id AND tag_id = @tag_id")
      .run({ manga_id: mangaId, tag_id: tagId });
  }

  getTagsForLibraryEntry(mangaId: string): Array<{
    id: number;
    name: string;
    color: string | null;
  }> {
    const rows = this.db
      .prepare(
        `
      SELECT lt.id, lt.name, lt.color
      FROM library_tags lt
      INNER JOIN library_entry_tags let ON lt.id = let.tag_id
      WHERE let.manga_id = @manga_id
      ORDER BY lt.name ASC
    `
      )
      .all({ manga_id: mangaId }) as Array<{
      id: number;
      name: string;
      color: string | null;
    }>;

    return rows;
  }

  // ==================== History Management ====================

  logHistoryEntry(entry: {
    mangaId: string;
    chapterId?: string;
    actionType: string;
    timestamp?: number;
    extensionId?: string;
    metadata?: Record<string, unknown>;
  }): number {
    const result = this.db
      .prepare(
        `
      INSERT INTO history_entries (
        manga_id,
        chapter_id,
        action_type,
        timestamp,
        extension_id,
        metadata
      ) VALUES (@manga_id, @chapter_id, @action_type, @timestamp, @extension_id, @metadata)
    `
      )
      .run({
        manga_id: entry.mangaId,
        chapter_id: entry.chapterId ?? null,
        action_type: entry.actionType,
        timestamp: entry.timestamp ?? now(),
        extension_id: entry.extensionId ?? null,
        metadata: serialize(entry.metadata),
      });

    return result.lastInsertRowid as number;
  }

  getHistory(options?: {
    limit?: number;
    offset?: number;
    mangaId?: string;
    actionType?: string;
    startDate?: number;
    endDate?: number;
  }): Array<{
    id: number;
    mangaId: string;
    chapterId: string | null;
    actionType: string;
    timestamp: number;
    extensionId: string | null;
    metadata: Record<string, unknown> | null;
  }> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.mangaId) {
      conditions.push("manga_id = @manga_id");
      params.manga_id = options.mangaId;
    }

    if (options?.actionType) {
      conditions.push("action_type = @action_type");
      params.action_type = options.actionType;
    }

    if (options?.startDate) {
      conditions.push("timestamp >= @start_date");
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      conditions.push("timestamp <= @end_date");
      params.end_date = options.endDate;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let query = `
      SELECT
        id,
        manga_id as mangaId,
        chapter_id as chapterId,
        action_type as actionType,
        timestamp,
        extension_id as extensionId,
        metadata
      FROM history_entries
      ${whereClause}
      ORDER BY timestamp DESC
    `;

    if (options?.limit) {
      query += ` LIMIT @limit`;
      params.limit = options.limit;
    }

    if (options?.offset) {
      query += ` OFFSET @offset`;
      params.offset = options.offset;
    }

    const rows = this.db.prepare(query).all(params) as Array<{
      id: number;
      mangaId: string;
      chapterId: string | null;
      actionType: string;
      timestamp: number;
      extensionId: string | null;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      ...row,
      metadata: deserialize<Record<string, unknown>>(row.metadata) ?? null,
    }));
  }

  getEnrichedHistory(options?: {
    limit?: number;
    offset?: number;
    mangaId?: string;
    actionType?: string;
    startDate?: number;
    endDate?: number;
  }): Array<{
    id: number;
    mangaId: string;
    chapterId: string | null;
    actionType: string;
    timestamp: number;
    extensionId: string | null;
    metadata: Record<string, unknown> | null;
    manga: {
      title: string;
      coverUrl: string | null;
      slug: string | null;
    } | null;
    chapter: {
      title: string | null;
      chapterNumber: string | null;
    } | null;
  }> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.mangaId) {
      conditions.push("h.manga_id = @manga_id");
      params.manga_id = options.mangaId;
    }

    if (options?.actionType) {
      conditions.push("h.action_type = @action_type");
      params.action_type = options.actionType;
    }

    if (options?.startDate) {
      conditions.push("h.timestamp >= @start_date");
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      conditions.push("h.timestamp <= @end_date");
      params.end_date = options.endDate;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let query = `
      SELECT
        h.id,
        h.manga_id as mangaId,
        h.chapter_id as chapterId,
        h.action_type as actionType,
        h.timestamp,
        h.extension_id as extensionId,
        h.metadata,
        m.title as mangaTitle,
        m.cover_url as mangaCoverUrl,
        m.slug as mangaSlug,
        c.title as chapterTitle,
        c.chapter_number as chapterNumber
      FROM history_entries h
      LEFT JOIN manga m ON h.manga_id = m.id
      LEFT JOIN chapters c ON h.chapter_id = c.id
      ${whereClause}
      ORDER BY h.timestamp DESC
    `;

    if (options?.limit) {
      query += ` LIMIT @limit`;
      params.limit = options.limit;
    }

    if (options?.offset) {
      query += ` OFFSET @offset`;
      params.offset = options.offset;
    }

    const rows = this.db.prepare(query).all(params) as Array<{
      id: number;
      mangaId: string;
      chapterId: string | null;
      actionType: string;
      timestamp: number;
      extensionId: string | null;
      metadata: string | null;
      mangaTitle: string | null;
      mangaCoverUrl: string | null;
      mangaSlug: string | null;
      chapterTitle: string | null;
      chapterNumber: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      mangaId: row.mangaId,
      chapterId: row.chapterId,
      actionType: row.actionType,
      timestamp: row.timestamp,
      extensionId: row.extensionId,
      metadata: deserialize<Record<string, unknown>>(row.metadata) ?? null,
      manga: row.mangaTitle
        ? {
            title: row.mangaTitle,
            coverUrl: row.mangaCoverUrl,
            slug: row.mangaSlug,
          }
        : null,
      chapter: row.chapterId
        ? {
            title: row.chapterTitle,
            chapterNumber: row.chapterNumber,
          }
        : null,
    }));
  }

  getHistoryByManga(
    mangaId: string,
    limit?: number
  ): Array<{
    id: number;
    mangaId: string;
    chapterId: string | null;
    actionType: string;
    timestamp: number;
    extensionId: string | null;
    metadata: Record<string, unknown> | null;
  }> {
    return this.getHistory({ mangaId, limit });
  }

  clearHistory(beforeTimestamp?: number): number {
    if (beforeTimestamp) {
      const result = this.db
        .prepare("DELETE FROM history_entries WHERE timestamp <= @timestamp")
        .run({ timestamp: beforeTimestamp });
      return result.changes ?? 0;
    } else {
      const result = this.db.prepare("DELETE FROM history_entries").run();
      return result.changes ?? 0;
    }
  }

  deleteHistoryEntry(id: number): void {
    this.db.prepare("DELETE FROM history_entries WHERE id = @id").run({ id });
  }

  getHistoryStats(options?: {
    startDate?: number;
    endDate?: number;
  }): {
    totalEntries: number;
    chaptersRead: number;
    mangaStarted: number;
    libraryAdditions: number;
    actionCounts: Record<string, number>;
    mostReadManga: Array<{ mangaId: string; title: string; count: number }>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.startDate) {
      conditions.push("timestamp >= @start_date");
      params.start_date = options.startDate;
    }

    if (options?.endDate) {
      conditions.push("timestamp <= @end_date");
      params.end_date = options.endDate;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM history_entries ${whereClause}`)
      .get(params) as { count: number };

    const chaptersReadRow = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM history_entries ${whereClause} ${whereClause ? "AND" : "WHERE"} action_type = 'read'`
      )
      .get(params) as { count: number };

    const mangaStartedRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT manga_id) as count FROM history_entries ${whereClause} ${whereClause ? "AND" : "WHERE"} action_type = 'read'`
      )
      .get(params) as { count: number };

    const libraryAdditionsRow = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM history_entries ${whereClause} ${whereClause ? "AND" : "WHERE"} action_type = 'library_add'`
      )
      .get(params) as { count: number };

    const actionCountsRows = this.db
      .prepare(
        `
      SELECT action_type, COUNT(*) as count
      FROM history_entries
      ${whereClause}
      GROUP BY action_type
      ORDER BY count DESC
    `
      )
      .all(params) as Array<{ action_type: string; count: number }>;

    const actionCounts: Record<string, number> = {};
    for (const row of actionCountsRows) {
      actionCounts[row.action_type] = row.count;
    }

    const mostReadMangaRows = this.db
      .prepare(
        `
      SELECT
        h.manga_id as mangaId,
        m.title,
        COUNT(*) as count
      FROM history_entries h
      LEFT JOIN manga m ON h.manga_id = m.id
      ${whereClause} ${whereClause ? "AND" : "WHERE"} h.action_type = 'read'
      GROUP BY h.manga_id
      ORDER BY count DESC
      LIMIT 10
    `
      )
      .all(params) as Array<{ mangaId: string; title: string | null; count: number }>;

    return {
      totalEntries: totalRow.count,
      chaptersRead: chaptersReadRow.count,
      mangaStarted: mangaStartedRow.count,
      libraryAdditions: libraryAdditionsRow.count,
      actionCounts,
      mostReadManga: mostReadMangaRows.map((row) => ({
        mangaId: row.mangaId,
        title: row.title ?? "Unknown",
        count: row.count,
      })),
    };
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
      // Clear history
      this.db.prepare("DELETE FROM history_entries").run();

      // Clear library data
      this.db.prepare("DELETE FROM library_entry_tags").run();
      this.db.prepare("DELETE FROM library_tags").run();
      this.db.prepare("DELETE FROM library_entries").run();

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
