function deserialize(value) {
    if (!value)
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch (error) {
        console.warn("Failed to deserialize value from catalog repository", error);
        return undefined;
    }
}
function serialize(value) {
    if (value === undefined || value === null)
        return null;
    return JSON.stringify(value);
}
function now() {
    return Date.now();
}
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
export class CatalogRepository {
    constructor(db) {
        this.db = db;
    }
    upsertExtension(manifest, options = {}) {
        const existing = this.getExtensionRow(manifest.id);
        const entryPath = options.entryPath ?? existing?.entry_path ?? null;
        const previousEnabled = existing ? existing.is_enabled === 1 : undefined;
        const isEnabled = options.enabled ?? previousEnabled ?? true;
        const settingsJson = options.settings !== undefined
            ? serialize(options.settings)
            : (existing?.settings_json ?? null);
        const sourceJson = options.source !== undefined
            ? serialize(options.source)
            : (existing?.source_metadata_json ?? null);
        const updateJson = options.updateState !== undefined
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
    listExtensions(options = {}) {
        const clauses = [];
        const params = {};
        const search = options.search?.trim();
        if (search && search.length > 0) {
            clauses.push(`(
          lower(name) LIKE lower(@search)
          OR lower(author_name) LIKE lower(@search)
          OR lower(description) LIKE lower(@search)
          OR lower(language_codes) LIKE lower(@search)
        )`);
            params.search = `%${search}%`;
        }
        if (options.status === "enabled") {
            clauses.push("is_enabled = 1");
        }
        else if (options.status === "disabled") {
            clauses.push("is_enabled = 0");
        }
        const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        const sortColumnMap = {
            name: "lower(name)",
            installedAt: "installed_at",
            author: "lower(author_name)",
            language: "lower(language_codes)",
        };
        const defaultSort = options.status ? "installedAt" : "name";
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
        const rows = stmt.all(params);
        return rows.map((row) => this.mapExtensionRow(row));
    }
    getExtension(id) {
        const row = this.getExtensionRow(id);
        if (!row)
            return undefined;
        return this.mapExtensionRow(row);
    }
    setExtensionEnabled(id, enabled) {
        const stmt = this.db.prepare(`UPDATE extensions SET is_enabled = @is_enabled WHERE id = @id`);
        stmt.run({ id, is_enabled: enabled ? 1 : 0 });
    }
    removeExtension(id) {
        const stmt = this.db.prepare(`DELETE FROM extensions WHERE id = @id`);
        stmt.run({ id });
    }
    updateExtensionSettings(id, settings) {
        const stmt = this.db.prepare(`UPDATE extensions SET settings_json = @settings_json WHERE id = @id`);
        stmt.run({ id, settings_json: serialize(settings) });
    }
    updateExtensionSourceMetadata(id, source) {
        const stmt = this.db.prepare(`UPDATE extensions SET source_metadata_json = @source_metadata_json WHERE id = @id`);
        stmt.run({ id, source_metadata_json: serialize(source) });
    }
    updateExtensionUpdateState(id, state) {
        const stmt = this.db.prepare(`UPDATE extensions SET update_state_json = @update_state_json WHERE id = @id`);
        stmt.run({ id, update_state_json: serialize(state) });
    }
    getExtensionRow(id) {
        const stmt = this.db.prepare(`SELECT ${EXTENSION_SELECT_COLUMNS} FROM extensions WHERE id = @id`);
        return stmt.get({ id });
    }
    mapExtensionRow(row) {
        const parsedManifest = deserialize(row.manifest_json);
        const fallbackCapabilities = deserialize(row.capabilities_json) ?? {
            catalogue: true,
        };
        const languageCodes = deserialize(row.language_codes) ?? [];
        const sourceMetadata = deserialize(row.source_metadata_json);
        const updateState = deserialize(row.update_state_json);
        const manifest = parsedManifest
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
        const settings = deserialize(row.settings_json);
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
    updateSyncState(extensionId, partial) {
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
    upsertMangaSummaries(extensionId, items) {
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
        last_synced_at
      ) VALUES (@id, @extension_id, @title, @alt_titles_json, @description, @cover_url, @status,
        @tags_json, @demographic, @language_code, @updated_at, @last_synced_at)
      ON CONFLICT(id) DO UPDATE SET
        extension_id = excluded.extension_id,
        title = excluded.title,
        alt_titles_json = excluded.alt_titles_json,
        description = excluded.description,
        cover_url = excluded.cover_url,
        status = excluded.status,
        tags_json = excluded.tags_json,
        demographic = excluded.demographic,
        language_code = excluded.language_code,
        updated_at = excluded.updated_at,
        last_synced_at = excluded.last_synced_at;
    `);
        const run = this.db.transaction((entries) => {
            for (const item of entries) {
                stmt.run({
                    id: item.id,
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
                });
            }
        });
        run(items);
    }
    upsertMangaDetails(extensionId, details) {
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
    upsertChapters(extensionId, mangaId, chapters) {
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
        const run = this.db.transaction((entries) => {
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
    replaceChapterPages(extensionId, mangaId, payload) {
        const deleteStmt = this.db.prepare(`DELETE FROM chapter_pages WHERE chapter_id = @chapter_id`);
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
}
